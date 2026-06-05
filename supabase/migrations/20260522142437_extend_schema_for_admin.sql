/*
  # Extend BikeAI Schema for Admin Dashboard

  1. Changes to `profiles`
    - Add `role` column (admin/dealer/customer)
    - Add `is_active` column
    - Add `updated_at` column

  2. Changes to `service_centers` (dealers)
    - Add `owner_id` referencing profiles
    - Add `status` column (pending/active/suspended/rejected)
    - Add `email`, `pincode`, `gst_number`, `description`, `logo_url` columns
    - Add `total_reviews` column
    - Add `updated_at` column

  3. New policies for admin access
*/

-- Extend profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'dealer', 'customer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE profiles ADD COLUMN email text DEFAULT '';
  END IF;
END $$;

-- Extend service_centers (dealers)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'owner_id') THEN
    ALTER TABLE service_centers ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'status') THEN
    ALTER TABLE service_centers ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'email') THEN
    ALTER TABLE service_centers ADD COLUMN email text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'pincode') THEN
    ALTER TABLE service_centers ADD COLUMN pincode text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'gst_number') THEN
    ALTER TABLE service_centers ADD COLUMN gst_number text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'description') THEN
    ALTER TABLE service_centers ADD COLUMN description text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'logo_url') THEN
    ALTER TABLE service_centers ADD COLUMN logo_url text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'total_reviews') THEN
    ALTER TABLE service_centers ADD COLUMN total_reviews integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_centers' AND column_name = 'updated_at') THEN
    ALTER TABLE service_centers ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update existing is_active to status='active' for service_centers
UPDATE service_centers SET status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END WHERE status = 'pending';

-- Drop old policies if any and recreate cleanly
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'service_centers' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON service_centers', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'service_bookings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON service_bookings', pol.policyname);
  END LOOP;
END $$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Service centers policies
CREATE POLICY "Anyone can view active dealers"
  ON service_centers FOR SELECT TO authenticated
  USING (status = 'active' OR owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "Admins can insert dealers"
  ON service_centers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin')));

CREATE POLICY "Admins can update all dealers"
  ON service_centers FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can delete dealers"
  ON service_centers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Service bookings policies
CREATE POLICY "Customers can view own bookings"
  ON service_bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Customers can create bookings"
  ON service_bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers can update own bookings"
  ON service_bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Dealers can view their shop bookings"
  ON service_bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM service_centers d WHERE d.id = service_center_id AND d.owner_id = auth.uid()));

CREATE POLICY "Dealers can update booking status"
  ON service_bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM service_centers d WHERE d.id = service_center_id AND d.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM service_centers d WHERE d.id = service_center_id AND d.owner_id = auth.uid()));

CREATE POLICY "Admins can view all bookings"
  ON service_bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update all bookings"
  ON service_bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NEW.email, ''),
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_centers_status ON service_centers(status);
CREATE INDEX IF NOT EXISTS idx_service_centers_city ON service_centers(city);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

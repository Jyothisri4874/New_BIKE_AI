-- Base BikeAI schema required by later migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------
-- PROFILES
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'dealer', 'customer')),
  city text DEFAULT '',
  pincode text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Base authenticated select profiles') THEN
    CREATE POLICY "Base authenticated select profiles"
      ON profiles FOR SELECT TO authenticated
      USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Base authenticated insert profiles') THEN
    CREATE POLICY "Base authenticated insert profiles"
      ON profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Base authenticated update profiles') THEN
    CREATE POLICY "Base authenticated update profiles"
      ON profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ---------------------------------------------
-- SERVICE CENTERS
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS service_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  pincode text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  rating numeric(3,2) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  brands text[] DEFAULT '{}',
  services text[] DEFAULT '{}',
  open_time text DEFAULT '',
  close_time text DEFAULT '',
  lat double precision,
  lng double precision,
  is_active boolean DEFAULT true,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_centers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_centers' AND policyname = 'Base authenticated select service_centers') THEN
    CREATE POLICY "Base authenticated select service_centers"
      ON service_centers FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_centers' AND policyname = 'Base authenticated insert service_centers') THEN
    CREATE POLICY "Base authenticated insert service_centers"
      ON service_centers FOR INSERT TO authenticated
      WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_centers' AND policyname = 'Base authenticated update service_centers') THEN
    CREATE POLICY "Base authenticated update service_centers"
      ON service_centers FOR UPDATE TO authenticated
      USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

-- ---------------------------------------------
-- SERVICE BOOKINGS
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  vehicle_number text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  scheduled_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_bookings' AND policyname = 'Base authenticated select service_bookings') THEN
    CREATE POLICY "Base authenticated select service_bookings"
      ON service_bookings FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_bookings' AND policyname = 'Base authenticated insert service_bookings') THEN
    CREATE POLICY "Base authenticated insert service_bookings"
      ON service_bookings FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() OR customer_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_bookings' AND policyname = 'Base authenticated update service_bookings') THEN
    CREATE POLICY "Base authenticated update service_bookings"
      ON service_bookings FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        OR customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        user_id = auth.uid()
        OR customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

-- ---------------------------------------------
-- VEHICLE MASTER DATA
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_oems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  country text DEFAULT 'India',
  is_ev_brand boolean DEFAULT false,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_oems ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_oems' AND policyname = 'Base authenticated select vehicle_oems') THEN
    CREATE POLICY "Base authenticated select vehicle_oems" ON vehicle_oems FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_oems' AND policyname = 'Base authenticated insert vehicle_oems') THEN
    CREATE POLICY "Base authenticated insert vehicle_oems" ON vehicle_oems FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_oems' AND policyname = 'Base authenticated update vehicle_oems') THEN
    CREATE POLICY "Base authenticated update vehicle_oems" ON vehicle_oems FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oem_id uuid NOT NULL REFERENCES vehicle_oems(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  segment text,
  fuel_types text[] DEFAULT ARRAY['petrol'],
  start_year int DEFAULT 2010,
  end_year int,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(oem_id, slug)
);

ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_models' AND policyname = 'Base authenticated select vehicle_models') THEN
    CREATE POLICY "Base authenticated select vehicle_models" ON vehicle_models FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_models' AND policyname = 'Base authenticated insert vehicle_models') THEN
    CREATE POLICY "Base authenticated insert vehicle_models" ON vehicle_models FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_models' AND policyname = 'Base authenticated update vehicle_models') THEN
    CREATE POLICY "Base authenticated update vehicle_models" ON vehicle_models FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  fuel_type text NOT NULL DEFAULT 'petrol',
  displacement_cc int,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_variants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_variants' AND policyname = 'Base authenticated select vehicle_variants') THEN
    CREATE POLICY "Base authenticated select vehicle_variants" ON vehicle_variants FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_variants' AND policyname = 'Base authenticated insert vehicle_variants') THEN
    CREATE POLICY "Base authenticated insert vehicle_variants" ON vehicle_variants FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_variants' AND policyname = 'Base authenticated update vehicle_variants') THEN
    CREATE POLICY "Base authenticated update vehicle_variants" ON vehicle_variants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  interval_km int NOT NULL,
  interval_months int NOT NULL,
  service_type text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_intervals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_intervals' AND policyname = 'Base authenticated select service_intervals') THEN
    CREATE POLICY "Base authenticated select service_intervals" ON service_intervals FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_intervals' AND policyname = 'Base authenticated insert service_intervals') THEN
    CREATE POLICY "Base authenticated insert service_intervals" ON service_intervals FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_intervals' AND policyname = 'Base authenticated update service_intervals') THEN
    CREATE POLICY "Base authenticated update service_intervals" ON service_intervals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------
-- CUSTOMER VEHICLES AND BOOKINGS
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS customer_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname text DEFAULT '',
  registration_number text NOT NULL DEFAULT '',
  oem_id uuid REFERENCES vehicle_oems(id),
  model_id uuid REFERENCES vehicle_models(id),
  variant_id uuid REFERENCES vehicle_variants(id),
  manufacturing_year integer,
  fuel_type text DEFAULT 'petrol',
  color text DEFAULT '',
  odometer_km integer DEFAULT 0,
  purchase_date date,
  insurance_expiry date,
  insurance_company text DEFAULT '',
  insurance_policy_no text DEFAULT '',
  puc_expiry date,
  warranty_expiry date,
  amc_expiry date,
  health_score int DEFAULT 80,
  next_service_date date,
  next_service_km int,
  avg_monthly_km int DEFAULT 500,
  preferred_center_id uuid REFERENCES service_centers(id),
  chassis_number text DEFAULT '',
  engine_number text DEFAULT '',
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_vehicles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_vehicles' AND policyname = 'Base authenticated select customer_vehicles') THEN
    CREATE POLICY "Base authenticated select customer_vehicles"
      ON customer_vehicles FOR SELECT TO authenticated
      USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_vehicles' AND policyname = 'Base authenticated insert customer_vehicles') THEN
    CREATE POLICY "Base authenticated insert customer_vehicles"
      ON customer_vehicles FOR INSERT TO authenticated
      WITH CHECK (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_vehicles' AND policyname = 'Base authenticated update customer_vehicles') THEN
    CREATE POLICY "Base authenticated update customer_vehicles"
      ON customer_vehicles FOR UPDATE TO authenticated
      USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      WITH CHECK (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS customer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE SET NULL,
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  service_type text NOT NULL DEFAULT 'general_service',
  service_category text NOT NULL DEFAULT 'General Service',
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL DEFAULT '10:00',
  pickup_required boolean DEFAULT false,
  pickup_address text DEFAULT '',
  pickup_lat double precision,
  pickup_lng double precision,
  drop_required boolean DEFAULT false,
  drop_address text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  otp_verified boolean DEFAULT false,
  verification_otp text DEFAULT '',
  notes text DEFAULT '',
  estimated_cost numeric(10,2) DEFAULT 0,
  final_cost numeric(10,2) DEFAULT 0,
  tracking_enabled boolean DEFAULT true,
  current_stage text DEFAULT 'booking_confirmed',
  stage_updated_at timestamptz DEFAULT now(),
  cancellation_reason text DEFAULT '',
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_bookings' AND policyname = 'Base authenticated select customer_bookings') THEN
    CREATE POLICY "Base authenticated select customer_bookings"
      ON customer_bookings FOR SELECT TO authenticated
      USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_bookings' AND policyname = 'Base authenticated insert customer_bookings') THEN
    CREATE POLICY "Base authenticated insert customer_bookings"
      ON customer_bookings FOR INSERT TO authenticated
      WITH CHECK (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_bookings' AND policyname = 'Base authenticated update customer_bookings') THEN
    CREATE POLICY "Base authenticated update customer_bookings"
      ON customer_bookings FOR UPDATE TO authenticated
      USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      WITH CHECK (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

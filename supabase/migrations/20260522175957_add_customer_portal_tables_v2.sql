/*
  # Customer Portal Tables v2

  ## Summary
  Extends the platform to support a full customer-facing booking portal.
  Uses IF NOT EXISTS guards on all objects for idempotency.

  1. New Tables
    - `customer_vehicles` - Customer's personal garage of vehicles
    - `customer_bookings` - Customer-initiated service bookings
    - `customer_documents` - Document vault (RC, insurance, PUC, warranty)
    - `customer_otp_sessions` - OTP verification sessions
    - `customer_reviews` - Customer reviews and ratings

  2. Security - RLS on all new tables
*/

-- Customer vehicles (garage)
CREATE TABLE IF NOT EXISTS customer_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname text DEFAULT '',
  registration_number text NOT NULL DEFAULT '',
  oem_id uuid,
  model_id uuid,
  variant_id uuid,
  manufacturing_year integer,
  fuel_type text DEFAULT 'petrol',
  color text DEFAULT '',
  odometer_km integer DEFAULT 0,
  purchase_date date,
  insurance_expiry date,
  puc_expiry date,
  warranty_expiry date,
  amc_expiry date,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_vehicles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_vehicles' AND policyname='Customers can view own vehicles') THEN
    CREATE POLICY "Customers can view own vehicles" ON customer_vehicles FOR SELECT TO authenticated USING (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_vehicles' AND policyname='Customers can insert own vehicles') THEN
    CREATE POLICY "Customers can insert own vehicles" ON customer_vehicles FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_vehicles' AND policyname='Customers can update own vehicles') THEN
    CREATE POLICY "Customers can update own vehicles" ON customer_vehicles FOR UPDATE TO authenticated USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_vehicles' AND policyname='Admins can view all customer vehicles') THEN
    CREATE POLICY "Admins can view all customer vehicles" ON customer_vehicles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- Customer bookings
CREATE TABLE IF NOT EXISTS customer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid,
  service_center_id uuid REFERENCES service_centers(id),
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_bookings' AND policyname='Customers can view own bookings') THEN
    CREATE POLICY "Customers can view own bookings" ON customer_bookings FOR SELECT TO authenticated USING (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_bookings' AND policyname='Customers can insert own bookings') THEN
    CREATE POLICY "Customers can insert own bookings" ON customer_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_bookings' AND policyname='Customers can update own bookings') THEN
    CREATE POLICY "Customers can update own bookings" ON customer_bookings FOR UPDATE TO authenticated USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_bookings' AND policyname='Admins can view all customer bookings') THEN
    CREATE POLICY "Admins can view all customer bookings" ON customer_bookings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_bookings' AND policyname='Admins can update all customer bookings') THEN
    CREATE POLICY "Admins can update all customer bookings" ON customer_bookings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- Customer documents vault
CREATE TABLE IF NOT EXISTS customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid,
  document_type text NOT NULL DEFAULT 'rc',
  document_name text NOT NULL DEFAULT '',
  file_url text DEFAULT '',
  expiry_date date,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_documents' AND policyname='Customers can view own documents') THEN
    CREATE POLICY "Customers can view own documents" ON customer_documents FOR SELECT TO authenticated USING (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_documents' AND policyname='Customers can insert own documents') THEN
    CREATE POLICY "Customers can insert own documents" ON customer_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_documents' AND policyname='Customers can update own documents') THEN
    CREATE POLICY "Customers can update own documents" ON customer_documents FOR UPDATE TO authenticated USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
  END IF;
END $$;

-- Customer OTP sessions
CREATE TABLE IF NOT EXISTS customer_otp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp_code text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  is_verified boolean DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_otp_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_otp_sessions' AND policyname='Authenticated can read otp sessions') THEN
    CREATE POLICY "Authenticated can read otp sessions" ON customer_otp_sessions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_otp_sessions' AND policyname='Anon can insert otp session') THEN
    CREATE POLICY "Anon can insert otp session" ON customer_otp_sessions FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_otp_sessions' AND policyname='Authenticated can insert otp session') THEN
    CREATE POLICY "Authenticated can insert otp session" ON customer_otp_sessions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Customer reviews
CREATE TABLE IF NOT EXISTS customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id uuid,
  service_center_id uuid REFERENCES service_centers(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_reviews' AND policyname='Customers can view own reviews') THEN
    CREATE POLICY "Customers can view own reviews" ON customer_reviews FOR SELECT TO authenticated USING (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_reviews' AND policyname='Customers can insert own reviews') THEN
    CREATE POLICY "Customers can insert own reviews" ON customer_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_reviews' AND policyname='Authenticated can read all reviews') THEN
    CREATE POLICY "Authenticated can read all reviews" ON customer_reviews FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_customer ON customer_vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_bookings_customer ON customer_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_bookings_status ON customer_bookings(status);
CREATE INDEX IF NOT EXISTS idx_customer_bookings_date ON customer_bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_customer_documents_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_otp_phone ON customer_otp_sessions(phone);

/*
  # Vehicle Database: OEMs, Models, Variants

  1. New Tables
    - `vehicle_oems` — brand/manufacturer records (Hero, Honda, TVS, etc.)
      - id, name, slug, logo_url, country, is_ev_brand, is_active
    - `vehicle_models` — models per OEM
      - id, oem_id, name, slug, segment, fuel_types[], start_year, end_year, is_active
    - `vehicle_variants` — optional variants per model
      - id, model_id, name, fuel_type, displacement_cc, is_active
    - `service_intervals` — service km/time intervals per model
      - id, model_id, interval_km, interval_months, service_type, description

  2. Security
    - RLS enabled on all tables
    - Public read-only for authenticated and anon (reference data)
    - Only service_role can write
*/

-- OEM brands
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

CREATE POLICY "Public read vehicle_oems"
  ON vehicle_oems FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Vehicle models
CREATE TABLE IF NOT EXISTS vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oem_id uuid NOT NULL REFERENCES vehicle_oems(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  segment text, -- commuter, sports, scooter, cruiser, adventure, electric
  fuel_types text[] DEFAULT ARRAY['petrol'],
  start_year int DEFAULT 2010,
  end_year int, -- null = still in production
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(oem_id, slug)
);

ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vehicle_models"
  ON vehicle_models FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_oem_id ON vehicle_models(oem_id);

-- Vehicle variants
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

CREATE POLICY "Public read vehicle_variants"
  ON vehicle_variants FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_vehicle_variants_model_id ON vehicle_variants(model_id);

-- Service intervals per model
CREATE TABLE IF NOT EXISTS service_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  interval_km int NOT NULL,
  interval_months int NOT NULL,
  service_type text NOT NULL, -- free_service, general_service, minor_service, major_service
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_intervals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read service_intervals"
  ON service_intervals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_service_intervals_model_id ON service_intervals(model_id);

-- Add vehicle info columns to service_bookings if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_bookings' AND column_name='oem_id') THEN
    ALTER TABLE service_bookings ADD COLUMN oem_id uuid REFERENCES vehicle_oems(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_bookings' AND column_name='model_id') THEN
    ALTER TABLE service_bookings ADD COLUMN model_id uuid REFERENCES vehicle_models(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_bookings' AND column_name='variant_id') THEN
    ALTER TABLE service_bookings ADD COLUMN variant_id uuid REFERENCES vehicle_variants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_bookings' AND column_name='manufacturing_year') THEN
    ALTER TABLE service_bookings ADD COLUMN manufacturing_year int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_bookings' AND column_name='fuel_type') THEN
    ALTER TABLE service_bookings ADD COLUMN fuel_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_bookings' AND column_name='vehicle_number') THEN
    ALTER TABLE service_bookings ADD COLUMN vehicle_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_bookings' AND column_name='odometer_km') THEN
    ALTER TABLE service_bookings ADD COLUMN odometer_km int;
  END IF;
END $$;

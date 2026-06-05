/*
  # Add missing columns to vehicle_models and align vehicle_variants

  The initial migration created vehicle_models with minimal columns.
  This adds the missing ones needed for the full vehicle database.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_models' AND column_name='slug') THEN
    ALTER TABLE vehicle_models ADD COLUMN slug text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_models' AND column_name='fuel_types') THEN
    ALTER TABLE vehicle_models ADD COLUMN fuel_types text[] DEFAULT ARRAY['petrol'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_models' AND column_name='start_year') THEN
    ALTER TABLE vehicle_models ADD COLUMN start_year int DEFAULT 2010;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_models' AND column_name='end_year') THEN
    ALTER TABLE vehicle_models ADD COLUMN end_year int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_models' AND column_name='sort_order') THEN
    ALTER TABLE vehicle_models ADD COLUMN sort_order int DEFAULT 0;
  END IF;

  -- vehicle_variants: rename variant_name -> name and engine_cc -> displacement_cc if needed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_variants' AND column_name='variant_name') THEN
    ALTER TABLE vehicle_variants RENAME COLUMN variant_name TO name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_variants' AND column_name='engine_cc') THEN
    ALTER TABLE vehicle_variants RENAME COLUMN engine_cc TO displacement_cc;
  END IF;
END $$;

-- Now make slug NOT NULL with a unique constraint
UPDATE vehicle_models SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;
ALTER TABLE vehicle_models ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='vehicle_models' AND constraint_name='vehicle_models_oem_id_slug_key'
  ) THEN
    ALTER TABLE vehicle_models ADD CONSTRAINT vehicle_models_oem_id_slug_key UNIQUE (oem_id, slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicle_models_oem_id ON vehicle_models(oem_id);

/*
  # Dealer CRM Service Due Master and WhatsApp Templates

  Adds dealer-scoped service due metadata, interval rules, and keyed WhatsApp
  template configuration for the existing CRM reminder engine.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='date_of_sale') THEN
    ALTER TABLE customer_vehicles ADD COLUMN date_of_sale date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='last_service_date') THEN
    ALTER TABLE customer_vehicles ADD COLUMN last_service_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='last_service_odometer_km') THEN
    ALTER TABLE customer_vehicles ADD COLUMN last_service_odometer_km integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='last_service_type') THEN
    ALTER TABLE customer_vehicles ADD COLUMN last_service_type text DEFAULT 'periodic' CHECK (last_service_type IN ('free', 'paid', 'periodic', 'repair', 'accidental'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='service_interval_days') THEN
    ALTER TABLE customer_vehicles ADD COLUMN service_interval_days integer DEFAULT 90;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='service_interval_km') THEN
    ALTER TABLE customer_vehicles ADD COLUMN service_interval_km integer DEFAULT 3000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='original_dealership') THEN
    ALTER TABLE customer_vehicles ADD COLUMN original_dealership text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='last_serviced_dealership') THEN
    ALTER TABLE customer_vehicles ADD COLUMN last_serviced_dealership text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='customer_status') THEN
    ALTER TABLE customer_vehicles ADD COLUMN customer_status text DEFAULT 'active' CHECK (customer_status IN ('active', 'inactive', 'lost', 'vehicle_sold'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='service_center_id') THEN
    ALTER TABLE message_templates ADD COLUMN service_center_id uuid REFERENCES service_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='template_key') THEN
    ALTER TABLE message_templates ADD COLUMN template_key text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='updated_at') THEN
    ALTER TABLE message_templates ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_service_interval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  name text NOT NULL,
  rule_type text NOT NULL DEFAULT 'periodic' CHECK (rule_type IN ('first_service', 'second_service', 'third_service', 'periodic', 'free_service', 'paid_service')),
  service_type text NOT NULL DEFAULT 'periodic' CHECK (service_type IN ('free', 'paid', 'periodic', 'repair', 'accidental')),
  interval_days integer DEFAULT 90,
  interval_km integer DEFAULT 3000,
  trigger_mode text NOT NULL DEFAULT 'whichever_first' CHECK (trigger_mode IN ('date', 'km', 'whichever_first')),
  is_active boolean DEFAULT true,
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_service_interval_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_service_interval_rules' AND policyname='Dealers manage own interval rules') THEN
    CREATE POLICY "Dealers manage own interval rules"
      ON crm_service_interval_rules FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_templates' AND policyname='Dealers manage own CRM templates') THEN
    CREATE POLICY "Dealers manage own CRM templates"
      ON message_templates FOR ALL TO authenticated
      USING (
        service_center_id IS NULL OR EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      )
      WITH CHECK (
        service_center_id IS NULL OR EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_center_key
  ON message_templates(service_center_id, template_key)
  WHERE service_center_id IS NOT NULL AND template_key <> '';

CREATE INDEX IF NOT EXISTS idx_interval_rules_center ON crm_service_interval_rules(service_center_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_due_master ON customer_vehicles(preferred_center_id, next_service_date, next_service_km, customer_status);

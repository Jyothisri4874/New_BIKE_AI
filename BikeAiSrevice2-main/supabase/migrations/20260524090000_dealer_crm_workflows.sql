/*
  # Dealer CRM Workflows

  Adds dealer-scoped CRM fields and follow-up records while reusing profiles,
  customer_vehicles, customer_bookings, notification_queue, and service_centers.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lead_status') THEN
    ALTER TABLE profiles ADD COLUMN lead_status text NOT NULL DEFAULT 'active'
      CHECK (lead_status IN ('new', 'active', 'warm', 'cold', 'converted', 'lost', 'archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_contacted_at') THEN
    ALTER TABLE profiles ADD COLUMN last_contacted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='archived_at') THEN
    ALTER TABLE profiles ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Follow-up',
  follow_up_type text NOT NULL DEFAULT 'service_due',
  lead_status text NOT NULL DEFAULT 'active'
    CHECK (lead_status IN ('new', 'active', 'warm', 'cold', 'converted', 'lost', 'archived')),
  scheduled_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'completed', 'cancelled')),
  channel text NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'sms', 'call', 'email')),
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Dealers can view assigned customer profiles') THEN
    CREATE POLICY "Dealers can view assigned customer profiles"
      ON profiles FOR SELECT TO authenticated
      USING (
        role = 'customer'
        AND EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = preferred_center_id
          AND sc.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Dealers can create assigned customer profiles') THEN
    CREATE POLICY "Dealers can create assigned customer profiles"
      ON profiles FOR INSERT TO authenticated
      WITH CHECK (
        role = 'customer'
        AND EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = preferred_center_id
          AND sc.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Dealers can update assigned customer profiles') THEN
    CREATE POLICY "Dealers can update assigned customer profiles"
      ON profiles FOR UPDATE TO authenticated
      USING (
        role = 'customer'
        AND EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = preferred_center_id
          AND sc.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        role = 'customer'
        AND EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = preferred_center_id
          AND sc.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_vehicles' AND policyname='Dealers can view assigned customer vehicles') THEN
    CREATE POLICY "Dealers can view assigned customer vehicles"
      ON customer_vehicles FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM profiles p
          JOIN service_centers sc ON sc.id = p.preferred_center_id
          WHERE p.id = customer_id
          AND sc.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_vehicles' AND policyname='Dealers can insert assigned customer vehicles') THEN
    CREATE POLICY "Dealers can insert assigned customer vehicles"
      ON customer_vehicles FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM profiles p
          JOIN service_centers sc ON sc.id = p.preferred_center_id
          WHERE p.id = customer_id
          AND sc.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_vehicles' AND policyname='Dealers can update assigned customer vehicles') THEN
    CREATE POLICY "Dealers can update assigned customer vehicles"
      ON customer_vehicles FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM profiles p
          JOIN service_centers sc ON sc.id = p.preferred_center_id
          WHERE p.id = customer_id
          AND sc.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM profiles p
          JOIN service_centers sc ON sc.id = p.preferred_center_id
          WHERE p.id = customer_id
          AND sc.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_bookings' AND policyname='Dealers can view own customer bookings') THEN
    CREATE POLICY "Dealers can view own customer bookings"
      ON customer_bookings FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_followups' AND policyname='Dealers manage own crm followups') THEN
    CREATE POLICY "Dealers manage own crm followups"
      ON crm_followups FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_preferred_center ON profiles(preferred_center_id);
CREATE INDEX IF NOT EXISTS idx_profiles_lead_status ON profiles(lead_status);
CREATE INDEX IF NOT EXISTS idx_crm_followups_customer ON crm_followups(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_followups_center_status ON crm_followups(service_center_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_followups_scheduled ON crm_followups(scheduled_at);

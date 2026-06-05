/*
  # Dealer Retention and Engagement CRM

  Adds secure booking deep links, retention feedback, and a normalized CRM
  interaction timeline while continuing to use notification_queue for outbound
  communication.
*/

CREATE TABLE IF NOT EXISTS crm_booking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE SET NULL,
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  service_type text NOT NULL DEFAULT 'general_service',
  due_date date,
  due_km int,
  metadata jsonb DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_booking_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS crm_retention_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE SET NULL,
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'other'
    CHECK (reason IN ('too_far', 'high_cost', 'poor_experience', 'serviced_elsewhere', 'busy_no_time', 'vehicle_sold', 'other')),
  details text DEFAULT '',
  competitor_name text DEFAULT '',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'winback_scheduled', 'resolved', 'lost')),
  next_action_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_retention_feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS crm_interaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE SET NULL,
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  body text DEFAULT '',
  entity_type text DEFAULT '',
  entity_id uuid,
  actor_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_interaction_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_booking_links' AND policyname='Dealers manage own booking links') THEN
    CREATE POLICY "Dealers manage own booking links"
      ON crm_booking_links FOR ALL TO authenticated
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

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_booking_links' AND policyname='Customers can use own booking links') THEN
    CREATE POLICY "Customers can use own booking links"
      ON crm_booking_links FOR SELECT TO authenticated
      USING (auth.uid() = customer_id AND expires_at > now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_booking_links' AND policyname='Customers can mark own booking links used') THEN
    CREATE POLICY "Customers can mark own booking links used"
      ON crm_booking_links FOR UPDATE TO authenticated
      USING (auth.uid() = customer_id AND expires_at > now())
      WITH CHECK (auth.uid() = customer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_retention_feedback' AND policyname='Dealers manage own retention feedback') THEN
    CREATE POLICY "Dealers manage own retention feedback"
      ON crm_retention_feedback FOR ALL TO authenticated
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

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_interaction_events' AND policyname='Dealers manage own interaction events') THEN
    CREATE POLICY "Dealers manage own interaction events"
      ON crm_interaction_events FOR ALL TO authenticated
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

CREATE INDEX IF NOT EXISTS idx_crm_booking_links_token ON crm_booking_links(token);
CREATE INDEX IF NOT EXISTS idx_crm_booking_links_customer ON crm_booking_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_retention_center_reason ON crm_retention_feedback(service_center_id, reason);
CREATE INDEX IF NOT EXISTS idx_crm_retention_customer ON crm_retention_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_customer_time ON crm_interaction_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_events_center_time ON crm_interaction_events(service_center_id, created_at DESC);

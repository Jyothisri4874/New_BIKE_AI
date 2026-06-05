CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_job_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  service_booking_id uuid REFERENCES service_bookings(id) ON DELETE SET NULL,
  customer_booking_id uuid REFERENCES customer_bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE SET NULL,
  assigned_technician_id uuid,
  job_number text,
  title text NOT NULL DEFAULT 'Service Job',
  service_type text DEFAULT 'general_service',
  complaint text DEFAULT '',
  diagnosis text DEFAULT '',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'inspection', 'approval_pending', 'in_progress', 'quality_check', 'ready', 'delivered', 'cancelled')),
  odometer_km integer,
  estimated_cost numeric(10,2) DEFAULT 0,
  approved_cost numeric(10,2) DEFAULT 0,
  final_cost numeric(10,2) DEFAULT 0,
  promised_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  delivered_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_center_id, job_number)
);

CREATE TABLE IF NOT EXISTS service_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  role text DEFAULT 'technician',
  skills text[] DEFAULT '{}',
  current_status text DEFAULT 'available' CHECK (current_status IN ('available', 'busy', 'off_duty', 'inactive')),
  is_active boolean DEFAULT true,
  rating numeric(3,2) DEFAULT 5.0,
  total_jobs integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_job_cards_assigned_technician_id_fkey'
  ) THEN
    ALTER TABLE service_job_cards
      ADD CONSTRAINT service_job_cards_assigned_technician_id_fkey
      FOREIGN KEY (assigned_technician_id) REFERENCES service_technicians(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_job_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES service_job_cards(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES service_technicians(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'status_update',
  status_from text,
  status_to text,
  title text NOT NULL DEFAULT '',
  message text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES service_job_cards(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES service_technicians(id) ON DELETE SET NULL,
  inspection_type text NOT NULL DEFAULT 'intake' CHECK (inspection_type IN ('intake', 'diagnosis', 'quality_check', 'delivery')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  checklist jsonb DEFAULT '[]',
  photos jsonb DEFAULT '[]',
  scratch_map jsonb DEFAULT '{}',
  odometer_km integer,
  fuel_level text DEFAULT '',
  notes text DEFAULT '',
  customer_signature text,
  inspected_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES service_job_cards(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  request_type text NOT NULL DEFAULT 'estimate' CHECK (request_type IN ('estimate', 'additional_work', 'parts', 'delay', 'delivery')),
  title text NOT NULL,
  description text DEFAULT '',
  estimate_amount numeric(10,2) DEFAULT 0,
  parts jsonb DEFAULT '[]',
  labor_items jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  customer_notes text DEFAULT '',
  responded_at timestamptz,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_chat_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid REFERENCES service_job_cards(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender_role text DEFAULT 'dealer' CHECK (sender_role IN ('admin', 'dealer', 'technician', 'customer', 'assistant', 'system')),
  channel text DEFAULT 'in_app' CHECK (channel IN ('in_app', 'whatsapp', 'sms', 'email', 'voice')),
  memory_type text DEFAULT 'message' CHECK (memory_type IN ('message', 'summary', 'intent', 'system_note')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  job_card_id uuid REFERENCES service_job_cards(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  template_id uuid,
  channel text NOT NULL DEFAULT 'whatsapp',
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  status text DEFAULT 'pending',
  entity_type text,
  entity_id uuid,
  campaign_id uuid,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid REFERENCES service_centers(id) ON DELETE CASCADE,
  template_key text,
  name text NOT NULL,
  category text DEFAULT 'service',
  channel text DEFAULT 'whatsapp',
  language text DEFAULT 'en',
  subject text,
  body text NOT NULL,
  variables jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_center_id, template_key, channel, language)
);

ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS job_card_id uuid REFERENCES service_job_cards(id) ON DELETE SET NULL;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS service_center_id uuid REFERENCES service_centers(id) ON DELETE CASCADE;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_queue_template_id_fkey'
  ) THEN
    ALTER TABLE notification_queue
      ADD CONSTRAINT notification_queue_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE service_job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_job_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_chat_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Auth insert notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Auth update notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Auth read message_templates" ON message_templates;
DROP POLICY IF EXISTS "Auth insert message_templates" ON message_templates;
DROP POLICY IF EXISTS "Auth update message_templates" ON message_templates;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_job_cards' AND policyname = 'Dealer ops select service_job_cards') THEN
    CREATE POLICY "Dealer ops select service_job_cards" ON service_job_cards FOR SELECT TO authenticated
      USING (
        customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM service_technicians st WHERE st.id = assigned_technician_id AND st.profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_job_cards' AND policyname = 'Dealer ops insert service_job_cards') THEN
    CREATE POLICY "Dealer ops insert service_job_cards" ON service_job_cards FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_job_cards' AND policyname = 'Dealer ops update service_job_cards') THEN
    CREATE POLICY "Dealer ops update service_job_cards" ON service_job_cards FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_technicians' AND policyname = 'Dealer ops select service_technicians') THEN
    CREATE POLICY "Dealer ops select service_technicians" ON service_technicians FOR SELECT TO authenticated
      USING (
        profile_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_technicians' AND policyname = 'Dealer ops insert service_technicians') THEN
    CREATE POLICY "Dealer ops insert service_technicians" ON service_technicians FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_technicians' AND policyname = 'Dealer ops update service_technicians') THEN
    CREATE POLICY "Dealer ops update service_technicians" ON service_technicians FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_job_timeline' AND policyname = 'Dealer ops select service_job_timeline') THEN
    CREATE POLICY "Dealer ops select service_job_timeline" ON service_job_timeline FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM service_job_cards jc WHERE jc.id = job_card_id AND jc.customer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM service_technicians st WHERE st.id = technician_id AND st.profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_job_timeline' AND policyname = 'Dealer ops insert service_job_timeline') THEN
    CREATE POLICY "Dealer ops insert service_job_timeline" ON service_job_timeline FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM service_technicians st WHERE st.id = technician_id AND st.profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_job_timeline' AND policyname = 'Dealer ops update service_job_timeline') THEN
    CREATE POLICY "Dealer ops update service_job_timeline" ON service_job_timeline FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_inspections' AND policyname = 'Dealer ops select service_inspections') THEN
    CREATE POLICY "Dealer ops select service_inspections" ON service_inspections FOR SELECT TO authenticated
      USING (
        customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM service_technicians st WHERE st.id = technician_id AND st.profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_inspections' AND policyname = 'Dealer ops insert service_inspections') THEN
    CREATE POLICY "Dealer ops insert service_inspections" ON service_inspections FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM service_technicians st WHERE st.id = technician_id AND st.profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_inspections' AND policyname = 'Dealer ops update service_inspections') THEN
    CREATE POLICY "Dealer ops update service_inspections" ON service_inspections FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_approval_requests' AND policyname = 'Dealer ops select service_approval_requests') THEN
    CREATE POLICY "Dealer ops select service_approval_requests" ON service_approval_requests FOR SELECT TO authenticated
      USING (
        customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_approval_requests' AND policyname = 'Dealer ops insert service_approval_requests') THEN
    CREATE POLICY "Dealer ops insert service_approval_requests" ON service_approval_requests FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_approval_requests' AND policyname = 'Dealer ops update service_approval_requests') THEN
    CREATE POLICY "Dealer ops update service_approval_requests" ON service_approval_requests FOR UPDATE TO authenticated
      USING (
        customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_chat_memory' AND policyname = 'Dealer ops select service_chat_memory') THEN
    CREATE POLICY "Dealer ops select service_chat_memory" ON service_chat_memory FOR SELECT TO authenticated
      USING (
        customer_id = auth.uid()
        OR sender_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_chat_memory' AND policyname = 'Dealer ops insert service_chat_memory') THEN
    CREATE POLICY "Dealer ops insert service_chat_memory" ON service_chat_memory FOR INSERT TO authenticated
      WITH CHECK (
        customer_id = auth.uid()
        OR sender_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_chat_memory' AND policyname = 'Dealer ops update service_chat_memory') THEN
    CREATE POLICY "Dealer ops update service_chat_memory" ON service_chat_memory FOR UPDATE TO authenticated
      USING (
        sender_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        sender_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_queue' AND policyname = 'Dealer ops select notification_queue') THEN
    CREATE POLICY "Dealer ops select notification_queue" ON notification_queue FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_queue' AND policyname = 'Dealer ops insert notification_queue') THEN
    CREATE POLICY "Dealer ops insert notification_queue" ON notification_queue FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        OR customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_queue' AND policyname = 'Dealer ops update notification_queue') THEN
    CREATE POLICY "Dealer ops update notification_queue" ON notification_queue FOR UPDATE TO authenticated
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_templates' AND policyname = 'Dealer ops select message_templates') THEN
    CREATE POLICY "Dealer ops select message_templates" ON message_templates FOR SELECT TO authenticated
      USING (
        service_center_id IS NULL
        OR EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_templates' AND policyname = 'Dealer ops insert message_templates') THEN
    CREATE POLICY "Dealer ops insert message_templates" ON message_templates FOR INSERT TO authenticated
      WITH CHECK (
        (service_center_id IS NOT NULL AND EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_templates' AND policyname = 'Dealer ops update message_templates') THEN
    CREATE POLICY "Dealer ops update message_templates" ON message_templates FOR UPDATE TO authenticated
      USING (
        (service_center_id IS NOT NULL AND EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        (service_center_id IS NOT NULL AND EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_job_cards_center_status ON service_job_cards(service_center_id, status);
CREATE INDEX IF NOT EXISTS idx_service_job_cards_customer ON service_job_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_job_cards_service_booking ON service_job_cards(service_booking_id);
CREATE INDEX IF NOT EXISTS idx_service_job_cards_customer_booking ON service_job_cards(customer_booking_id);
CREATE INDEX IF NOT EXISTS idx_service_job_cards_technician ON service_job_cards(assigned_technician_id);

CREATE INDEX IF NOT EXISTS idx_service_technicians_center_active ON service_technicians(service_center_id, is_active);
CREATE INDEX IF NOT EXISTS idx_service_technicians_profile ON service_technicians(profile_id);

CREATE INDEX IF NOT EXISTS idx_service_job_timeline_job ON service_job_timeline(job_card_id, created_at);
CREATE INDEX IF NOT EXISTS idx_service_job_timeline_center ON service_job_timeline(service_center_id, created_at);

CREATE INDEX IF NOT EXISTS idx_service_inspections_job ON service_inspections(job_card_id);
CREATE INDEX IF NOT EXISTS idx_service_inspections_center_status ON service_inspections(service_center_id, status);

CREATE INDEX IF NOT EXISTS idx_service_approval_requests_job ON service_approval_requests(job_card_id);
CREATE INDEX IF NOT EXISTS idx_service_approval_requests_center_status ON service_approval_requests(service_center_id, status);
CREATE INDEX IF NOT EXISTS idx_service_approval_requests_customer ON service_approval_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_service_chat_memory_job ON service_chat_memory(job_card_id, created_at);
CREATE INDEX IF NOT EXISTS idx_service_chat_memory_center ON service_chat_memory(service_center_id, created_at);
CREATE INDEX IF NOT EXISTS idx_service_chat_memory_customer ON service_chat_memory(customer_id);

CREATE INDEX IF NOT EXISTS idx_notification_queue_center_status ON notification_queue(service_center_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_job ON notification_queue(job_card_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_customer ON notification_queue(customer_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_center_category ON message_templates(service_center_id, category);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);

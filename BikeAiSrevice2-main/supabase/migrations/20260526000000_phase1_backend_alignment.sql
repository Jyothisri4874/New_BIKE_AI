/*
  # Phase 1 Customer Booking Backend Alignment

  Keeps the root service-operations schema compatible with the CRM/customer
  files merged from the nested app. This intentionally does not add scheduler,
  WhatsApp/SMS worker, or broad security-policy changes.
*/

-- Service manager job-card fields expected by the merged dealer UI.
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES customer_bookings(id) ON DELETE SET NULL;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'customer_bookings';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS fuel_level text DEFAULT 'unknown';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS customer_complaints text DEFAULT '';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS recommended_services text[] DEFAULT '{}';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES service_technicians(id) ON DELETE SET NULL;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS technician_name text DEFAULT '';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS pickup_required boolean DEFAULT false;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS drop_required boolean DEFAULT false;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS internal_remarks text DEFAULT '';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS is_delayed boolean DEFAULT false;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS delay_reason text DEFAULT '';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 0;
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS last_status_at timestamptz DEFAULT now();
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS operational_risk_state text DEFAULT 'normal';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS risk_tags text[] DEFAULT '{}';
ALTER TABLE service_job_cards ADD COLUMN IF NOT EXISTS is_chargeable boolean DEFAULT true;

DO $$
BEGIN
  ALTER TABLE service_job_cards DROP CONSTRAINT IF EXISTS service_job_cards_status_check;
  ALTER TABLE service_job_cards
    ADD CONSTRAINT service_job_cards_status_check
    CHECK (status IN (
      'open',
      'assigned',
      'inspection',
      'approval_pending',
      'booked',
      'confirmed',
      'pickup_assigned',
      'en_route',
      'picked_up',
      'arrived_workshop',
      'diagnosis',
      'awaiting_approval',
      'in_progress',
      'qc_washing',
      'quality_check',
      'ready',
      'ready_for_delivery',
      'delivered',
      'completed',
      'cancelled'
    ));
END $$;

-- Customer-booking fields updated by the service manager conversion flow.
ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE;
ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'bikeai';
ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS is_chargeable boolean DEFAULT true;

-- Timeline fields expected by customer self-service RPCs and dealer timeline writes.
ALTER TABLE service_job_timeline ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE service_job_timeline ADD COLUMN IF NOT EXISTS status text DEFAULT 'status_update';
ALTER TABLE service_job_timeline ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE service_job_timeline ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'customer';

-- Digital inspection fields expected by the merged service manager UI.
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE SET NULL;
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS photo_front text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS photo_rear text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS photo_left text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS photo_right text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS damage_photos text[] DEFAULT '{}';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS scratch_dent_notes text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS accessories jsonb DEFAULT '{}';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS complaint_notes text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS acknowledgement_method text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS acknowledgement_otp text DEFAULT '';
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Customer approval-token fields expected by tokenized approval links.
ALTER TABLE service_approval_requests ADD COLUMN IF NOT EXISTS requested_work text[] DEFAULT '{}';
ALTER TABLE service_approval_requests ADD COLUMN IF NOT EXISTS approval_token text;
ALTER TABLE service_approval_requests ADD COLUMN IF NOT EXISTS customer_note text DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_approval_requests_approval_token
  ON service_approval_requests(approval_token)
  WHERE approval_token IS NOT NULL;

-- Chatbot CRM memory fields expected by the copied AI chat widget and dealer memory panel.
ALTER TABLE service_chat_memory ADD COLUMN IF NOT EXISTS conversation_source text DEFAULT 'chatbot';
ALTER TABLE service_chat_memory ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'internal';
ALTER TABLE service_chat_memory ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE service_chat_memory ADD COLUMN IF NOT EXISTS summary text DEFAULT '';
ALTER TABLE service_chat_memory ADD COLUMN IF NOT EXISTS raw_excerpt text DEFAULT '';
ALTER TABLE service_chat_memory ADD COLUMN IF NOT EXISTS sentiment text DEFAULT 'neutral';
ALTER TABLE service_chat_memory ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_chat_memory'
      AND column_name = 'content'
  ) THEN
    ALTER TABLE service_chat_memory ALTER COLUMN content DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_job_cards_booking_id ON service_job_cards(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_job_cards_tracking_token ON service_job_cards(tracking_token);
CREATE INDEX IF NOT EXISTS idx_service_timeline_visibility ON service_job_timeline(job_card_id, visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_chat_memory_customer ON service_chat_memory(customer_id, created_at DESC);

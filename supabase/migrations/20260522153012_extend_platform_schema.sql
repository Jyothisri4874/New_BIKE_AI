/*
  # Extended BikeAI Platform Schema

  New / extended tables:
  1. customer_vehicles — add insurance, warranty, tags, health score, doc vault
  2. vehicle_specs — engine specs, dimensions, maintenance data per model
  3. crm_campaigns — bulk WhatsApp/SMS campaigns
  4. notification_queue — outbound notification log (WhatsApp, SMS, email)
  5. booking_timeline — audit trail per booking status change
  6. vehicle_documents — doc vault per customer vehicle
  7. customer_tags — taggable taxonomy
  8. whatsapp_templates — reusable message templates
  9. csv_imports — track bulk upload jobs
*/

-- ── Extend customer_vehicles ───────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='insurance_expiry') THEN
    ALTER TABLE customer_vehicles ADD COLUMN insurance_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='insurance_company') THEN
    ALTER TABLE customer_vehicles ADD COLUMN insurance_company text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='insurance_policy_no') THEN
    ALTER TABLE customer_vehicles ADD COLUMN insurance_policy_no text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='warranty_expiry') THEN
    ALTER TABLE customer_vehicles ADD COLUMN warranty_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='purchase_date') THEN
    ALTER TABLE customer_vehicles ADD COLUMN purchase_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='health_score') THEN
    ALTER TABLE customer_vehicles ADD COLUMN health_score int DEFAULT 80;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='next_service_date') THEN
    ALTER TABLE customer_vehicles ADD COLUMN next_service_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='next_service_km') THEN
    ALTER TABLE customer_vehicles ADD COLUMN next_service_km int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='avg_monthly_km') THEN
    ALTER TABLE customer_vehicles ADD COLUMN avg_monthly_km int DEFAULT 500;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='preferred_center_id') THEN
    ALTER TABLE customer_vehicles ADD COLUMN preferred_center_id uuid REFERENCES service_centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='chassis_number') THEN
    ALTER TABLE customer_vehicles ADD COLUMN chassis_number text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_vehicles' AND column_name='engine_number') THEN
    ALTER TABLE customer_vehicles ADD COLUMN engine_number text DEFAULT '';
  END IF;
END $$;

-- ── Extend profiles for customer metadata ─────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='whatsapp_number') THEN
    ALTER TABLE profiles ADD COLUMN whatsapp_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tags') THEN
    ALTER TABLE profiles ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='preferred_center_id') THEN
    ALTER TABLE profiles ADD COLUMN preferred_center_id uuid REFERENCES service_centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='customer_notes') THEN
    ALTER TABLE profiles ADD COLUMN customer_notes text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='date_of_birth') THEN
    ALTER TABLE profiles ADD COLUMN date_of_birth date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='city') THEN
    ALTER TABLE profiles ADD COLUMN city text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='pincode') THEN
    ALTER TABLE profiles ADD COLUMN pincode text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='loyalty_points') THEN
    ALTER TABLE profiles ADD COLUMN loyalty_points int DEFAULT 0;
  END IF;
END $$;

-- ── Vehicle Specs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES vehicle_models(id) ON DELETE CASCADE,
  -- Engine
  engine_cc int,
  power_bhp numeric(6,2),
  torque_nm numeric(6,2),
  compression_ratio text,
  engine_type text,
  -- Fuel
  fuel_tank_litres numeric(5,2),
  reserve_litres numeric(5,2),
  claimed_mileage_kmpl numeric(6,2),
  -- Dimensions
  length_mm int,
  width_mm int,
  height_mm int,
  wheelbase_mm int,
  ground_clearance_mm int,
  seat_height_mm int,
  kerb_weight_kg int,
  -- Tyres
  front_tyre text,
  rear_tyre text,
  tyre_pressure_front text,
  tyre_pressure_rear text,
  -- Maintenance
  engine_oil_grade text,
  oil_capacity_litres numeric(4,2),
  oil_change_interval_km int,
  brake_fluid_type text,
  coolant_type text,
  battery_type text,
  battery_ah int,
  spark_plug_type text,
  air_filter_interval_km int,
  -- Safety
  abs_type text,
  brakes_front text,
  brakes_rear text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(model_id)
);

ALTER TABLE vehicle_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vehicle_specs" ON vehicle_specs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth insert vehicle_specs" ON vehicle_specs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update vehicle_specs" ON vehicle_specs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Vehicle Documents ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id),
  doc_type text NOT NULL,  -- rc, insurance, puc, service_record, warranty
  doc_name text NOT NULL,
  doc_url text,
  expiry_date date,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read vehicle_documents" ON vehicle_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vehicle_documents" ON vehicle_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update vehicle_documents" ON vehicle_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Booking Timeline ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES service_bookings(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text DEFAULT '',
  actor_id uuid REFERENCES profiles(id),
  actor_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE booking_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read booking_timeline" ON booking_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert booking_timeline" ON booking_timeline FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_booking_timeline ON booking_timeline(booking_id);

-- ── CRM Campaigns ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type text DEFAULT 'whatsapp',  -- whatsapp, sms, email
  target_type text DEFAULT 'service_due', -- service_due, insurance, birthday, custom
  template_id uuid,
  message_body text NOT NULL,
  target_count int DEFAULT 0,
  sent_count int DEFAULT 0,
  delivered_count int DEFAULT 0,
  opened_count int DEFAULT 0,
  converted_count int DEFAULT 0,
  status text DEFAULT 'draft',  -- draft, scheduled, running, completed, paused
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read crm_campaigns" ON crm_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert crm_campaigns" ON crm_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update crm_campaigns" ON crm_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Notification Queue ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  channel text NOT NULL,  -- whatsapp, sms, email, push
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  status text DEFAULT 'pending',  -- pending, sent, delivered, failed
  entity_type text,
  entity_id uuid,
  campaign_id uuid REFERENCES crm_campaigns(id),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read notification_queue" ON notification_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert notification_queue" ON notification_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update notification_queue" ON notification_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_notif_queue_status ON notification_queue(status);

-- ── WhatsApp / SMS Templates ──────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'service',  -- service, crm, billing, feedback
  channel text DEFAULT 'whatsapp',
  language text DEFAULT 'en',
  subject text,
  body text NOT NULL,
  variables jsonb DEFAULT '[]',  -- [{key: "name", example: "Ravi"}]
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read message_templates" ON message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert message_templates" ON message_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update message_templates" ON message_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── CSV Import Jobs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS csv_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text DEFAULT 'customers',
  file_name text,
  total_rows int DEFAULT 0,
  imported_rows int DEFAULT 0,
  skipped_rows int DEFAULT 0,
  duplicate_rows int DEFAULT 0,
  error_rows int DEFAULT 0,
  status text DEFAULT 'pending',  -- pending, processing, completed, failed
  errors jsonb DEFAULT '[]',
  imported_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read csv_imports" ON csv_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert csv_imports" ON csv_imports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update csv_imports" ON csv_imports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Seed default message templates ───────────────────────
INSERT INTO message_templates (name, category, channel, language, body, variables) VALUES
('Free Service Reminder', 'crm', 'whatsapp', 'en', 'Hi {{name}}! Your {{bike}} ({{reg}}) is due for FREE service. Book now at BikeAI Service. Reply YES to confirm.', '[{"key":"name"},{"key":"bike"},{"key":"reg"}]'),
('Paid Service Reminder', 'crm', 'whatsapp', 'en', 'Hi {{name}}, time to service your {{bike}}! Avail 10% discount this week. Book now: BikeAI.Service', '[{"key":"name"},{"key":"bike"}]'),
('Insurance Renewal', 'crm', 'whatsapp', 'en', 'Hi {{name}}, your vehicle insurance expires on {{date}}. Renew before it lapses. Need help? Call us.', '[{"key":"name"},{"key":"date"}]'),
('Booking Confirmed', 'service', 'whatsapp', 'en', 'Booking confirmed! {{service}} for {{bike}} on {{date}} at {{time}}. Center: {{center}}. Booking ID: {{id}}', '[{"key":"service"},{"key":"bike"},{"key":"date"},{"key":"time"},{"key":"center"},{"key":"id"}]'),
('Vehicle Ready', 'service', 'whatsapp', 'en', 'Great news {{name}}! Your {{bike}} ({{reg}}) is ready for pickup at {{center}}. Thank you for choosing BikeAI!', '[{"key":"name"},{"key":"bike"},{"key":"reg"},{"key":"center"}]'),
('Invoice Generated', 'billing', 'whatsapp', 'en', 'Invoice #{{invoice_no}} of ₹{{amount}} generated for your {{bike}} service. Pay now: {{link}}', '[{"key":"invoice_no"},{"key":"amount"},{"key":"bike"},{"key":"link"}]'),
('Feedback Request', 'feedback', 'whatsapp', 'en', 'How was your experience at {{center}}? Rate us 1-5: {{link}}. Your feedback helps us improve!', '[{"key":"center"},{"key":"link"}]'),
('Birthday Greeting', 'crm', 'whatsapp', 'en', 'Happy Birthday {{name}}! 🎂 Celebrate with 15% off your next service. Valid for 7 days. BikeAI Team', '[{"key":"name"}]')
ON CONFLICT DO NOTHING;

-- ── Seed sample vehicle specs (Hero Splendor Plus) ────────
INSERT INTO vehicle_specs (
  model_id, engine_cc, power_bhp, torque_nm, engine_type,
  fuel_tank_litres, reserve_litres, claimed_mileage_kmpl,
  length_mm, width_mm, height_mm, wheelbase_mm, ground_clearance_mm, seat_height_mm, kerb_weight_kg,
  front_tyre, rear_tyre, tyre_pressure_front, tyre_pressure_rear,
  engine_oil_grade, oil_capacity_litres, oil_change_interval_km,
  brake_fluid_type, battery_type, battery_ah, spark_plug_type,
  abs_type, brakes_front, brakes_rear
)
SELECT m.id,
  97, 7.91, 8.05, 'Single-cylinder 4-stroke OHC',
  9.8, 1.3, 80.6,
  2000, 726, 1102, 1225, 179, 790, 110,
  '2.75-18', '2.75-18', '24 PSI', '28 PSI',
  '10W30', 0.9, 4000,
  'DOT 4', 'Sealed MF', 3, 'NGK BPR7ES',
  'CBS', 'Drum 130mm', 'Drum 110mm'
FROM vehicle_models m JOIN vehicle_oems o ON o.id = m.oem_id
WHERE o.slug = 'hero' AND m.slug = 'splendor-plus'
ON CONFLICT (model_id) DO NOTHING;

/*
  # Live Vehicle Tracking & Operations Control System

  ## Overview
  Creates all tables required for BikeAI's live operations platform:
  pickup/delivery tracking, rider management, OTP verification,
  vehicle condition capture, RSA (roadside assistance), and geo-fencing events.

  ## New Tables
  1. `riders` - Pickup/delivery/valet/RSA riders with live location
  2. `pickup_deliveries` - Pickup and delivery jobs linked to bookings
  3. `rider_location_pings` - Time-series GPS pings from riders
  4. `vehicle_condition_reports` - Pre/post condition capture (photos, scratch map, odometer)
  5. `otp_verifications` - OTP records for pickup/delivery confirmation
  6. `rsa_requests` - Roadside assistance breakdown requests
  7. `geofence_events` - Auto-triggered events when crossing geo-fences
  8. `live_notifications` - Real-time notification queue for all ops events

  ## Security
  - RLS enabled on all tables
  - Admin users can read/write all rows
  - Riders can update their own location and job status
*/

-- ─────────────────────────────────────────────
-- RIDERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  phone text NOT NULL,
  rider_type text NOT NULL DEFAULT 'pickup_delivery',
  -- pickup_delivery | valet | rsa | test_ride
  is_available boolean DEFAULT true,
  is_active boolean DEFAULT true,
  current_lat numeric(10,7),
  current_lng numeric(10,7),
  last_location_at timestamptz,
  current_job_id uuid,
  vehicle_number text,
  rating numeric(3,2) DEFAULT 5.0,
  total_jobs integer DEFAULT 0,
  avg_pickup_mins integer,
  avg_delivery_mins integer,
  service_center_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage riders"
  ON riders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert riders"
  ON riders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update riders"
  ON riders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- PICKUP & DELIVERY JOBS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pickup_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES service_bookings(id),
  customer_id uuid REFERENCES profiles(id),
  rider_id uuid REFERENCES riders(id),
  job_type text NOT NULL DEFAULT 'pickup',
  -- pickup | delivery | valet | test_ride
  status text NOT NULL DEFAULT 'pending',
  -- pending | assigned | rider_en_route | arrived | picked_up | in_transit | delivered | cancelled
  customer_address text,
  customer_lat numeric(10,7),
  customer_lng numeric(10,7),
  service_center_id uuid,
  service_center_lat numeric(10,7),
  service_center_lng numeric(10,7),
  scheduled_at timestamptz,
  assigned_at timestamptz,
  rider_departed_at timestamptz,
  arrived_at_customer timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  eta_minutes integer,
  distance_km numeric(6,2),
  otp_code text,
  otp_verified boolean DEFAULT false,
  otp_verified_at timestamptz,
  pickup_photos jsonb DEFAULT '[]',
  delivery_photos jsonb DEFAULT '[]',
  customer_signature text,
  odometer_at_pickup integer,
  odometer_at_delivery integer,
  fuel_level_pickup text,
  fuel_level_delivery text,
  condition_notes text,
  customer_rating integer,
  customer_feedback text,
  delay_reason text,
  is_delayed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pickup_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select pickup_deliveries"
  ON pickup_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert pickup_deliveries"
  ON pickup_deliveries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update pickup_deliveries"
  ON pickup_deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- RIDER LOCATION PINGS (time-series GPS)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rider_location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  job_id uuid REFERENCES pickup_deliveries(id),
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  speed_kmph numeric(5,1),
  heading numeric(5,1),
  accuracy_m integer,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE rider_location_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select pings"
  ON rider_location_pings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert pings"
  ON rider_location_pings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- VEHICLE CONDITION REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_condition_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES pickup_deliveries(id),
  booking_id uuid REFERENCES service_bookings(id),
  report_type text NOT NULL DEFAULT 'pickup',
  -- pickup | delivery
  photos jsonb DEFAULT '[]',
  scratch_map jsonb DEFAULT '{}',
  fuel_level text DEFAULT 'full',
  odometer_km integer,
  damage_notes text,
  rider_id uuid REFERENCES riders(id),
  customer_signature text,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_condition_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage condition reports"
  ON vehicle_condition_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert condition reports"
  ON vehicle_condition_reports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- OTP VERIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES pickup_deliveries(id),
  phone text NOT NULL,
  otp_code text NOT NULL,
  purpose text NOT NULL DEFAULT 'pickup',
  -- pickup | delivery | customer_auth | handover
  channel text NOT NULL DEFAULT 'sms',
  -- sms | whatsapp | push
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage otps"
  ON otp_verifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert otps"
  ON otp_verifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update otps"
  ON otp_verifications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- RSA REQUESTS (Roadside Assistance)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rsa_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id),
  rider_id uuid REFERENCES riders(id),
  status text NOT NULL DEFAULT 'open',
  -- open | assigned | en_route | arrived | resolved | cancelled
  breakdown_type text DEFAULT 'breakdown',
  -- breakdown | puncture | battery_dead | fuel_empty | accident | other
  customer_lat numeric(10,7),
  customer_lng numeric(10,7),
  customer_address text,
  vehicle_description text,
  complaint text,
  assigned_at timestamptz,
  arrived_at timestamptz,
  resolved_at timestamptz,
  eta_minutes integer,
  towing_required boolean DEFAULT false,
  towing_vendor text,
  resolution_notes text,
  customer_rating integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rsa_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select rsa_requests"
  ON rsa_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert rsa_requests"
  ON rsa_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update rsa_requests"
  ON rsa_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- GEOFENCE EVENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid REFERENCES riders(id),
  job_id uuid REFERENCES pickup_deliveries(id),
  event_type text NOT NULL,
  -- workshop_entry | workshop_exit | customer_arrived | delivery_zone_entered | pickup_completed
  triggered_at timestamptz DEFAULT now(),
  lat numeric(10,7),
  lng numeric(10,7),
  auto_action text,
  -- status_updated | notification_sent | escalation_triggered
  processed boolean DEFAULT false
);

ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select geofence_events"
  ON geofence_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert geofence_events"
  ON geofence_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- LIVE NOTIFICATIONS (ops events)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES profiles(id),
  job_id uuid REFERENCES pickup_deliveries(id),
  rsa_id uuid REFERENCES rsa_requests(id),
  event_type text NOT NULL,
  -- rider_assigned | rider_arriving | pickup_completed | workshop_arrived |
  -- service_started | delivery_started | delivery_completed | delay_alert | rsa_arrival
  title text NOT NULL,
  body text,
  channel text DEFAULT 'push',
  -- push | whatsapp | sms | voice
  is_sent boolean DEFAULT false,
  sent_at timestamptz,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE live_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select live_notifications"
  ON live_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert live_notifications"
  ON live_notifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update live_notifications"
  ON live_notifications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- SEED: sample riders
-- ─────────────────────────────────────────────
INSERT INTO riders (name, phone, rider_type, is_available, current_lat, current_lng, vehicle_number, rating, total_jobs)
VALUES
  ('Ravi Kumar',     '+91 98765 11001', 'pickup_delivery', true,  12.9716, 77.5946, 'KA01AB1234', 4.8, 143),
  ('Suresh Babu',    '+91 98765 11002', 'pickup_delivery', true,  12.9612, 77.6414, 'KA02CD5678', 4.6,  98),
  ('Dinesh R',       '+91 98765 11003', 'pickup_delivery', false, 12.9352, 77.6244, 'KA03EF9012', 4.7, 212),
  ('Mohan Das',      '+91 98765 11004', 'valet',           true,  12.9816, 77.5800, 'KA04GH3456', 4.9,  67),
  ('Ajith Kumar',    '+91 98765 11005', 'rsa',             true,  12.9500, 77.6100, 'KA05IJ7890', 4.5,  34),
  ('Pradeep T',      '+91 98765 11006', 'rsa',             true,  12.9900, 77.5700, 'KA06KL2345', 4.3,  55),
  ('Venkat Rao',     '+91 98765 11007', 'pickup_delivery', true,  12.9750, 77.6050, 'KA07MN6789', 4.7, 188),
  ('Kiran S',        '+91 98765 11008', 'test_ride',       true,  12.9680, 77.5990, 'KA08OP0123', 4.9,  22)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pickup_deliveries_status    ON pickup_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_pickup_deliveries_rider     ON pickup_deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_pickup_deliveries_booking   ON pickup_deliveries(booking_id);
CREATE INDEX IF NOT EXISTS idx_rider_pings_rider           ON rider_location_pings(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_pings_job             ON rider_location_pings(job_id);
CREATE INDEX IF NOT EXISTS idx_riders_available            ON riders(is_available, is_active);
CREATE INDEX IF NOT EXISTS idx_rsa_status                  ON rsa_requests(status);
CREATE INDEX IF NOT EXISTS idx_live_notifs_recipient       ON live_notifications(recipient_id, is_read);

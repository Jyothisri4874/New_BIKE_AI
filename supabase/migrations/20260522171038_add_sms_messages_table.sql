/*
  # Add sms_messages table for Twilio SMS tracking

  Tracks every SMS/WhatsApp message sent via Twilio.
  Fields: id, to_phone, message_type, body_preview, twilio_sid, status,
          customer_id, booking_id, job_id, sent_at, delivered_at, error_msg

  Security: RLS enabled, authenticated users can read and insert.
*/

CREATE TABLE IF NOT EXISTS sms_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone      text NOT NULL,
  message_type  text NOT NULL DEFAULT 'general',
  body_preview  text DEFAULT '',
  twilio_sid    text,
  status        text NOT NULL DEFAULT 'queued',
  customer_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  booking_id    uuid,
  job_id        uuid,
  error_msg     text,
  sent_at       timestamptz DEFAULT now(),
  delivered_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_messages' AND policyname = 'Authenticated users can view sms_messages'
  ) THEN
    CREATE POLICY "Authenticated users can view sms_messages"
      ON sms_messages FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_messages' AND policyname = 'Authenticated users can insert sms_messages'
  ) THEN
    CREATE POLICY "Authenticated users can insert sms_messages"
      ON sms_messages FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sms_messages_to_phone ON sms_messages(to_phone);
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer_id ON sms_messages(customer_id);

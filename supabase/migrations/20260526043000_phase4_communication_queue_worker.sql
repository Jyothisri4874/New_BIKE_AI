/*
  # Phase 4 Communication Queue Delivery Logging

  Adds outbound communication logs and queue delivery metadata. Replaces the
  service due queue RPC so queued reminder bodies can include CRM booking links
  when a booking-link token can be created or reused.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS provider text DEFAULT 'twilio';
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz;

CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL,
  notification_queue_id uuid UNIQUE REFERENCES notification_queue(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'push', 'in_app')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  message_type text NOT NULL DEFAULT 'service_due_reminder',
  recipient text NOT NULL DEFAULT '',
  body_preview text DEFAULT '',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider text DEFAULT 'twilio',
  provider_message_id text,
  error_message text,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  queued_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'communication_logs_notification_queue_id_key'
  ) THEN
    ALTER TABLE communication_logs
      ADD CONSTRAINT communication_logs_notification_queue_id_key UNIQUE (notification_queue_id);
  END IF;
END $$;

ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view own communication_logs" ON communication_logs;
DROP POLICY IF EXISTS "Dealers manage own communication_logs" ON communication_logs;

CREATE POLICY "Customers view own communication_logs"
  ON communication_logs FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Dealers manage own communication_logs"
  ON communication_logs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM service_centers sc
      WHERE sc.id = service_center_id
        AND (
          sc.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM service_centers sc
      WHERE sc.id = service_center_id
        AND (
          sc.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_communication_logs_center_time
  ON communication_logs(service_center_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_logs_customer_time
  ON communication_logs(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_logs_status
  ON communication_logs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_delivery
  ON notification_queue(status, scheduled_at, service_center_id)
  WHERE entity_type = 'crm_service_due';

CREATE OR REPLACE FUNCTION queue_due_service_reminders(
  p_service_center_id uuid DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
  v_queued integer := 0;
  v_skipped_missing_recipient integer := 0;
  v_stage_counts jsonb := '{}'::jsonb;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = v_actor
        AND p.role = 'admin'
    ) INTO v_is_admin;
  END IF;

  WITH allowed_centers AS (
    SELECT sc.id
    FROM service_centers sc
    WHERE (p_service_center_id IS NULL OR sc.id = p_service_center_id)
      AND (v_actor IS NULL OR v_is_admin OR sc.owner_id = v_actor)
  ),
  eligible AS (
    SELECT
      r.id,
      r.service_center_id,
      r.customer_id,
      r.vehicle_id,
      r.stage,
      r.due_date,
      r.due_km,
      r.dedupe_key,
      regexp_replace(COALESCE(NULLIF(p.whatsapp_number, ''), NULLIF(p.phone, ''), ''), '[^0-9]', '', 'g') AS recipient,
      p.full_name AS customer_name,
      sc.name AS dealer_name,
      cv.registration_number,
      cv.last_service_date,
      cv.last_service_type,
      trim(both from concat_ws(' ', vo.name, vm.name)) AS vehicle_model,
      mt.body AS template_body
    FROM service_due_reminders r
    JOIN allowed_centers ac ON ac.id = r.service_center_id
    JOIN profiles p ON p.id = r.customer_id
    JOIN service_centers sc ON sc.id = r.service_center_id
    JOIN customer_vehicles cv ON cv.id = r.vehicle_id
    LEFT JOIN vehicle_oems vo ON vo.id = cv.oem_id
    LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
    LEFT JOIN LATERAL (
      SELECT t.body
      FROM message_templates t
      WHERE t.category = 'crm'
        AND t.channel = 'whatsapp'
        AND t.is_active = true
        AND t.template_key = CASE r.stage
          WHEN 'n_7' THEN 'n_7_reminder'
          WHEN 'n_3' THEN 'n_3_reminder'
          WHEN 'n_1' THEN 'n_1_reminder'
          WHEN 'due_today' THEN 'due_today'
          WHEN 'overdue' THEN 'overdue_followup'
        END
        AND (t.service_center_id = r.service_center_id OR t.service_center_id IS NULL)
      ORDER BY
        CASE WHEN t.service_center_id = r.service_center_id THEN 0 ELSE 1 END,
        t.updated_at DESC NULLS LAST,
        t.created_at DESC
      LIMIT 1
    ) mt ON true
    WHERE r.status = 'pending'
      AND r.stage IN ('n_7', 'n_3', 'n_1', 'due_today', 'overdue')
      AND r.scheduled_for <= p_now
  ),
  missing_recipient AS (
    UPDATE service_due_reminders r
    SET status = 'skipped',
        skipped_reason = 'missing_recipient',
        updated_at = now()
    FROM eligible e
    WHERE r.id = e.id
      AND e.recipient = ''
      AND r.status = 'pending'
    RETURNING r.stage
  ),
  active_links AS (
    SELECT e.id AS reminder_id, l.token
    FROM eligible e
    JOIN LATERAL (
      SELECT token
      FROM crm_booking_links l
      WHERE l.customer_id = e.customer_id
        AND l.vehicle_id = e.vehicle_id
        AND l.service_center_id = e.service_center_id
        AND l.used_at IS NULL
        AND l.expires_at > p_now
      ORDER BY l.created_at DESC
      LIMIT 1
    ) l ON true
    WHERE e.recipient <> ''
  ),
  new_links AS (
    INSERT INTO crm_booking_links (
      token,
      customer_id,
      vehicle_id,
      service_center_id,
      service_type,
      due_date,
      due_km,
      metadata,
      created_by
    )
    SELECT
      replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      e.customer_id,
      e.vehicle_id,
      e.service_center_id,
      'general_service',
      e.due_date,
      e.due_km,
      jsonb_build_object('source', 'queue_due_service_reminders', 'stage', e.stage, 'service_due_reminder_id', e.id),
      v_actor
    FROM eligible e
    WHERE e.recipient <> ''
      AND NOT EXISTS (SELECT 1 FROM active_links al WHERE al.reminder_id = e.id)
    RETURNING customer_id, vehicle_id, service_center_id, due_date, due_km, token
  ),
  eligible_with_links AS (
    SELECT
      e.*,
      COALESCE(al.token, nl.token) AS booking_token
    FROM eligible e
    LEFT JOIN active_links al ON al.reminder_id = e.id
    LEFT JOIN new_links nl
      ON nl.customer_id = e.customer_id
      AND nl.vehicle_id = e.vehicle_id
      AND nl.service_center_id = e.service_center_id
      AND nl.due_date IS NOT DISTINCT FROM e.due_date
      AND nl.due_km IS NOT DISTINCT FROM e.due_km
  ),
  queue_payload AS (
    SELECT
      e.*,
      CASE
        WHEN e.booking_token IS NULL THEN ''
        ELSE concat(
          '/customer/book/',
          e.booking_token,
          '?service=general_service&center=',
          e.service_center_id,
          '&source=crm&vehicle=',
          e.vehicle_id,
          CASE WHEN e.due_date IS NOT NULL THEN concat('&due_date=', e.due_date) ELSE '' END,
          CASE WHEN e.due_km IS NOT NULL THEN concat('&due_km=', e.due_km) ELSE '' END
        )
      END AS booking_link,
      CASE
        WHEN e.template_body IS NOT NULL THEN
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            e.template_body,
                            '{{customer_name}}', COALESCE(NULLIF(e.customer_name, ''), 'Customer')
                          ),
                          '{{vehicle_number}}', COALESCE(NULLIF(e.registration_number, ''), 'your vehicle')
                        ),
                        '{{vehicle_model}}', COALESCE(NULLIF(e.vehicle_model, ''), NULLIF(e.registration_number, ''), 'your vehicle')
                      ),
                      '{{dealer_name}}', COALESCE(NULLIF(e.dealer_name, ''), 'your service center')
                    ),
                    '{{service_due_date}}', COALESCE(to_char(e.due_date, 'DD Mon YYYY'), '')
                  ),
                  '{{service_due_km}}', COALESCE(e.due_km::text, '')
                ),
                '{{last_service_date}}', COALESCE(to_char(e.last_service_date, 'DD Mon YYYY'), '')
              ),
              '{{last_service_type}}', initcap(replace(COALESCE(e.last_service_type, 'periodic'), '_', ' '))
            ),
            '{{booking_link}}',
            CASE
              WHEN e.booking_token IS NULL THEN ''
              ELSE concat(
                '/customer/book/',
                e.booking_token,
                '?service=general_service&center=',
                e.service_center_id,
                '&source=crm&vehicle=',
                e.vehicle_id,
                CASE WHEN e.due_date IS NOT NULL THEN concat('&due_date=', e.due_date) ELSE '' END,
                CASE WHEN e.due_km IS NOT NULL THEN concat('&due_km=', e.due_km) ELSE '' END
              )
            END
          )
        ELSE
          concat(
            'Hi ',
            COALESCE(NULLIF(e.customer_name, ''), 'Customer'),
            ', your ',
            COALESCE(NULLIF(e.vehicle_model, ''), NULLIF(e.registration_number, ''), 'vehicle'),
            ' service is ',
            CASE
              WHEN e.stage = 'overdue' THEN 'overdue'
              WHEN e.stage = 'due_today' THEN 'due today'
              ELSE 'due soon'
            END,
            CASE WHEN e.due_date IS NOT NULL THEN concat(' on ', to_char(e.due_date, 'DD Mon YYYY')) ELSE '' END,
            '. Book here: ',
            CASE
              WHEN e.booking_token IS NULL THEN ''
              ELSE concat(
                '/customer/book/',
                e.booking_token,
                '?service=general_service&center=',
                e.service_center_id,
                '&source=crm&vehicle=',
                e.vehicle_id,
                CASE WHEN e.due_date IS NOT NULL THEN concat('&due_date=', e.due_date) ELSE '' END,
                CASE WHEN e.due_km IS NOT NULL THEN concat('&due_km=', e.due_km) ELSE '' END
              )
            END
          )
      END AS body
    FROM eligible_with_links e
    WHERE e.recipient <> ''
  ),
  queued AS (
    INSERT INTO notification_queue (
      service_center_id,
      customer_id,
      user_id,
      channel,
      recipient,
      body,
      status,
      entity_type,
      entity_id,
      scheduled_at,
      dedupe_key,
      metadata
    )
    SELECT
      q.service_center_id,
      q.customer_id,
      q.customer_id,
      'whatsapp',
      q.recipient,
      q.body,
      'pending',
      'crm_service_due',
      q.vehicle_id,
      p_now,
      q.dedupe_key,
      jsonb_build_object(
        'source', 'queue_due_service_reminders',
        'service_due_reminder_id', q.id,
        'stage', q.stage,
        'due_date', q.due_date,
        'due_km', q.due_km,
        'booking_link', q.booking_link,
        'booking_token', q.booking_token
      )
    FROM queue_payload q
    ON CONFLICT (dedupe_key) DO UPDATE SET
      body = EXCLUDED.body,
      metadata = COALESCE(notification_queue.metadata, '{}'::jsonb) || EXCLUDED.metadata,
      updated_at = now()
    RETURNING id, dedupe_key
  ),
  updated AS (
    UPDATE service_due_reminders r
    SET status = 'queued',
        queued_at = p_now,
        notification_queue_id = q.id,
        updated_at = now()
    FROM queued q
    WHERE r.dedupe_key = q.dedupe_key
      AND r.status = 'pending'
    RETURNING r.stage
  ),
  stage_counts AS (
    SELECT stage, count(*) AS reminder_count
    FROM updated
    GROUP BY stage
  )
  SELECT
    COALESCE((SELECT sum(reminder_count)::integer FROM stage_counts), 0),
    COALESCE(jsonb_object_agg(stage, reminder_count), '{}'::jsonb),
    COALESCE((SELECT count(*)::integer FROM missing_recipient), 0)
  INTO v_queued, v_stage_counts, v_skipped_missing_recipient
  FROM stage_counts;

  RETURN jsonb_build_object(
    'ok', true,
    'queued', COALESCE(v_queued, 0),
    'skipped_missing_recipient', COALESCE(v_skipped_missing_recipient, 0),
    'stages', COALESCE(v_stage_counts, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION queue_due_service_reminders(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION queue_due_service_reminders(uuid, timestamptz) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION queue_due_service_reminders(uuid, timestamptz) TO service_role';
  END IF;
END $$;

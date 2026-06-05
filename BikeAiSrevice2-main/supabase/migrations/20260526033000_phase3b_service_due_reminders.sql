/*
  # Phase 3B Service Due Reminder Foundation

  Adds backend-only service due reminder staging and queueing. This does not
  send WhatsApp/SMS and does not change CRM UI behavior.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS dedupe_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_queue_dedupe_key_key'
  ) THEN
    ALTER TABLE notification_queue
      ADD CONSTRAINT notification_queue_dedupe_key_key UNIQUE (dedupe_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_due_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES customer_vehicles(id) ON DELETE CASCADE,
  customer_booking_id uuid REFERENCES customer_bookings(id) ON DELETE SET NULL,
  notification_queue_id uuid REFERENCES notification_queue(id) ON DELETE SET NULL,
  stage text NOT NULL CHECK (stage IN ('n_7', 'n_3', 'n_1', 'due_today', 'overdue', 'pre_booked')),
  due_date date,
  due_km integer,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'skipped', 'cancelled')),
  dedupe_key text NOT NULL,
  queued_at timestamptz,
  skipped_reason text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (dedupe_key)
);

ALTER TABLE service_due_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'service_due_reminders'
      AND policyname = 'Dealers manage own service_due_reminders'
  ) THEN
    CREATE POLICY "Dealers manage own service_due_reminders"
      ON service_due_reminders FOR ALL TO authenticated
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
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_due_reminders_center_status
  ON service_due_reminders(service_center_id, status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_service_due_reminders_vehicle_stage
  ON service_due_reminders(vehicle_id, stage, due_date);

CREATE INDEX IF NOT EXISTS idx_service_due_reminders_queue
  ON service_due_reminders(status, scheduled_for)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION generate_service_due_reminders(
  p_service_center_id uuid DEFAULT NULL,
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
  v_generated integer := 0;
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
  due_basis AS (
    SELECT
      v.id AS vehicle_id,
      v.customer_id,
      v.preferred_center_id AS service_center_id,
      v.registration_number,
      v.odometer_km,
      v.last_service_date,
      v.last_service_type,
      COALESCE(v.next_service_date, (COALESCE(v.last_service_date, v.date_of_sale, v.purchase_date) + COALESCE(v.service_interval_days, r.interval_days, 90))) AS due_date,
      COALESCE(v.next_service_km, COALESCE(v.last_service_odometer_km, 0) + COALESCE(v.service_interval_km, r.interval_km, 3000)) AS due_km,
      r.id AS interval_rule_id,
      b.id AS customer_booking_id,
      (COALESCE(v.next_service_date, (COALESCE(v.last_service_date, v.date_of_sale, v.purchase_date) + COALESCE(v.service_interval_days, r.interval_days, 90))) - p_as_of) AS date_gap_days,
      (COALESCE(v.next_service_km, COALESCE(v.last_service_odometer_km, 0) + COALESCE(v.service_interval_km, r.interval_km, 3000)) - COALESCE(v.odometer_km, 0)) AS km_gap
    FROM customer_vehicles v
    JOIN allowed_centers ac ON ac.id = v.preferred_center_id
    JOIN profiles p ON p.id = v.customer_id
    LEFT JOIN LATERAL (
      SELECT rule.id, rule.interval_days, rule.interval_km
      FROM crm_service_interval_rules rule
      WHERE rule.service_center_id = v.preferred_center_id
        AND rule.is_active = true
        AND (
          rule.service_type = COALESCE(v.last_service_type, 'periodic')
          OR rule.rule_type = 'periodic'
        )
      ORDER BY
        CASE WHEN rule.service_type = COALESCE(v.last_service_type, 'periodic') THEN 0 ELSE 1 END,
        rule.created_at DESC
      LIMIT 1
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT cb.id
      FROM customer_bookings cb
      WHERE cb.vehicle_id = v.id
        AND cb.service_center_id = v.preferred_center_id
        AND cb.status IN ('pending', 'confirmed', 'in_progress')
      ORDER BY cb.scheduled_date ASC, cb.created_at ASC
      LIMIT 1
    ) b ON true
    WHERE COALESCE(v.is_active, true) = true
      AND COALESCE(v.customer_status, 'active') = 'active'
      AND COALESCE(p.lead_status, 'active') <> 'archived'
      AND COALESCE(p.is_active, true) = true
  ),
  staged AS (
    SELECT
      db.*,
      CASE
        WHEN db.date_gap_days < 0 THEN 'overdue'
        WHEN db.date_gap_days = 0 THEN 'due_today'
        WHEN db.date_gap_days <= 1 THEN 'n_1'
        WHEN db.date_gap_days <= 3 THEN 'n_3'
        WHEN db.date_gap_days <= 7 THEN 'n_7'
      END AS date_stage,
      CASE
        WHEN db.km_gap <= 0 THEN 'overdue'
        WHEN db.km_gap <= 50 THEN 'due_today'
        WHEN db.km_gap <= 150 THEN 'n_1'
        WHEN db.km_gap <= 300 THEN 'n_3'
        WHEN db.km_gap <= 700 THEN 'n_7'
      END AS km_stage
    FROM due_basis db
  ),
  candidates AS (
    SELECT
      s.*,
      CASE
        WHEN s.customer_booking_id IS NOT NULL AND (s.date_stage IS NOT NULL OR s.km_stage IS NOT NULL) THEN 'pre_booked'
        WHEN s.date_stage = 'overdue' OR s.km_stage = 'overdue' THEN 'overdue'
        WHEN s.date_stage = 'due_today' OR s.km_stage = 'due_today' THEN 'due_today'
        WHEN s.date_stage = 'n_1' OR s.km_stage = 'n_1' THEN 'n_1'
        WHEN s.date_stage = 'n_3' OR s.km_stage = 'n_3' THEN 'n_3'
        WHEN s.date_stage = 'n_7' OR s.km_stage = 'n_7' THEN 'n_7'
      END AS stage
    FROM staged s
  ),
  upserted AS (
    INSERT INTO service_due_reminders (
      service_center_id,
      customer_id,
      vehicle_id,
      customer_booking_id,
      stage,
      due_date,
      due_km,
      scheduled_for,
      status,
      dedupe_key,
      skipped_reason,
      metadata
    )
    SELECT
      c.service_center_id,
      c.customer_id,
      c.vehicle_id,
      c.customer_booking_id,
      c.stage,
      c.due_date,
      c.due_km,
      p_as_of::timestamptz,
      CASE WHEN c.stage = 'pre_booked' THEN 'skipped' ELSE 'pending' END,
      concat_ws(':', 'service_due', c.service_center_id::text, c.vehicle_id::text, c.stage, COALESCE(c.due_date::text, 'no_date'), COALESCE(c.due_km::text, 'no_km')),
      CASE WHEN c.stage = 'pre_booked' THEN 'active_booking_exists' ELSE '' END,
      jsonb_build_object(
        'source', 'generate_service_due_reminders',
        'date_gap_days', c.date_gap_days,
        'km_gap', c.km_gap,
        'date_stage', c.date_stage,
        'km_stage', c.km_stage,
        'interval_rule_id', c.interval_rule_id,
        'customer_booking_id', c.customer_booking_id
      )
    FROM candidates c
    WHERE c.stage IS NOT NULL
    ON CONFLICT (dedupe_key) DO UPDATE SET
      customer_booking_id = EXCLUDED.customer_booking_id,
      due_date = EXCLUDED.due_date,
      due_km = EXCLUDED.due_km,
      scheduled_for = EXCLUDED.scheduled_for,
      skipped_reason = EXCLUDED.skipped_reason,
      metadata = EXCLUDED.metadata,
      updated_at = now(),
      status = CASE
        WHEN service_due_reminders.status IN ('queued', 'cancelled') THEN service_due_reminders.status
        WHEN EXCLUDED.stage = 'pre_booked' THEN 'skipped'
        ELSE 'pending'
      END
    RETURNING stage, status
  ),
  stage_counts AS (
    SELECT stage, count(*) AS reminder_count
    FROM upserted
    GROUP BY stage
  )
  SELECT
    COALESCE((SELECT sum(reminder_count)::integer FROM stage_counts), 0),
    COALESCE(jsonb_object_agg(stage, reminder_count), '{}'::jsonb)
  INTO v_generated, v_stage_counts
  FROM stage_counts;

  RETURN jsonb_build_object(
    'ok', true,
    'generated', COALESCE(v_generated, 0),
    'stages', COALESCE(v_stage_counts, '{}'::jsonb)
  );
END;
$$;

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
  queue_payload AS (
    SELECT
      e.*,
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
            '{{booking_link}}', ''
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
            '. Please book your service with ',
            COALESCE(NULLIF(e.dealer_name, ''), 'your service center'),
            '.'
          )
      END AS body
    FROM eligible e
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
        'due_km', q.due_km
      )
    FROM queue_payload q
    ON CONFLICT (dedupe_key) DO UPDATE SET
      dedupe_key = EXCLUDED.dedupe_key
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

REVOKE ALL ON FUNCTION generate_service_due_reminders(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION queue_due_service_reminders(uuid, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION generate_service_due_reminders(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION queue_due_service_reminders(uuid, timestamptz) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION generate_service_due_reminders(uuid, date) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION queue_due_service_reminders(uuid, timestamptz) TO service_role';
  END IF;
END $$;

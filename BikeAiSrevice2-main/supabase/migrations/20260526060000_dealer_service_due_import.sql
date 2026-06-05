/*
  # Dealer Service Due Import

  Adds dealer-scoped import mapping templates and the minimal customer/vehicle
  metadata needed for OEM service-due imports. The reminder engine remains the
  existing service_due_reminders -> notification_queue flow.
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'dealer', 'customer', 'crm', 'service_manager'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_consent boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_consent boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alternate_phone text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area text DEFAULT '';

ALTER TABLE customer_vehicles ADD COLUMN IF NOT EXISTS service_advisor text DEFAULT '';
ALTER TABLE customer_vehicles ADD COLUMN IF NOT EXISTS branch_name text DEFAULT '';
ALTER TABLE customer_vehicles ADD COLUMN IF NOT EXISTS service_due_type_label text DEFAULT '';

ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS lead_source text DEFAULT 'bikeai';
ALTER TABLE crm_booking_links ADD COLUMN IF NOT EXISTS lead_source text DEFAULT 'crm';

CREATE INDEX IF NOT EXISTS idx_customer_bookings_lead_source ON customer_bookings(lead_source);
CREATE INDEX IF NOT EXISTS idx_crm_booking_links_lead_source ON crm_booking_links(lead_source);

CREATE OR REPLACE FUNCTION public.can_access_dealer_service_center(p_service_center_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_service_center_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM service_centers sc
      WHERE sc.id = p_service_center_id
        AND sc.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('crm', 'service_manager')
        AND COALESCE(p.is_active, true) = true
        AND p.preferred_center_id = p_service_center_id
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_dealer_service_center(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS crm_service_due_import_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_label text DEFAULT '',
  sheet_name text DEFAULT '',
  header_signature text NOT NULL DEFAULT '',
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (service_center_id, name)
);

CREATE TABLE IF NOT EXISTS crm_service_due_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  template_id uuid REFERENCES crm_service_due_import_templates(id) ON DELETE SET NULL,
  file_name text NOT NULL DEFAULT '',
  sheet_name text NOT NULL DEFAULT '',
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  failed_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_service_due_import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_service_due_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dealer staff manage service due import templates" ON crm_service_due_import_templates;
CREATE POLICY "Dealer staff manage service due import templates"
  ON crm_service_due_import_templates FOR ALL TO authenticated
  USING (public.can_access_dealer_service_center(service_center_id))
  WITH CHECK (public.can_access_dealer_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer staff manage service due import batches" ON crm_service_due_import_batches;
CREATE POLICY "Dealer staff manage service due import batches"
  ON crm_service_due_import_batches FOR ALL TO authenticated
  USING (public.can_access_dealer_service_center(service_center_id))
  WITH CHECK (public.can_access_dealer_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer staff can view assigned customer profiles" ON profiles;
CREATE POLICY "Dealer staff can view assigned customer profiles"
  ON profiles FOR SELECT TO authenticated
  USING (role = 'customer' AND public.can_access_dealer_service_center(preferred_center_id));

DROP POLICY IF EXISTS "Dealer staff can create assigned customer profiles" ON profiles;
CREATE POLICY "Dealer staff can create assigned customer profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (role = 'customer' AND public.can_access_dealer_service_center(preferred_center_id));

DROP POLICY IF EXISTS "Dealer staff can update assigned customer profiles" ON profiles;
CREATE POLICY "Dealer staff can update assigned customer profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (role = 'customer' AND public.can_access_dealer_service_center(preferred_center_id))
  WITH CHECK (role = 'customer' AND public.can_access_dealer_service_center(preferred_center_id));

DROP POLICY IF EXISTS "Dealer staff can view assigned customer vehicles" ON customer_vehicles;
CREATE POLICY "Dealer staff can view assigned customer vehicles"
  ON customer_vehicles FOR SELECT TO authenticated
  USING (
    public.can_access_dealer_service_center(preferred_center_id)
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = customer_id
        AND public.can_access_dealer_service_center(p.preferred_center_id)
    )
  );

DROP POLICY IF EXISTS "Dealer staff can create assigned customer vehicles" ON customer_vehicles;
CREATE POLICY "Dealer staff can create assigned customer vehicles"
  ON customer_vehicles FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_dealer_service_center(preferred_center_id)
    AND EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = customer_id
        AND p.role = 'customer'
        AND p.preferred_center_id = customer_vehicles.preferred_center_id
    )
  );

DROP POLICY IF EXISTS "Dealer staff can update assigned customer vehicles" ON customer_vehicles;
CREATE POLICY "Dealer staff can update assigned customer vehicles"
  ON customer_vehicles FOR UPDATE TO authenticated
  USING (public.can_access_dealer_service_center(preferred_center_id))
  WITH CHECK (
    public.can_access_dealer_service_center(preferred_center_id)
    AND EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = customer_id
        AND p.role = 'customer'
        AND p.preferred_center_id = customer_vehicles.preferred_center_id
    )
  );

DROP POLICY IF EXISTS "Dealer staff view own interval rules" ON crm_service_interval_rules;
CREATE POLICY "Dealer staff view own interval rules"
  ON crm_service_interval_rules FOR SELECT TO authenticated
  USING (public.can_access_dealer_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer staff manage own service_due_reminders" ON service_due_reminders;
CREATE POLICY "Dealer staff manage own service_due_reminders"
  ON service_due_reminders FOR ALL TO authenticated
  USING (public.can_access_dealer_service_center(service_center_id))
  WITH CHECK (public.can_access_dealer_service_center(service_center_id));

CREATE INDEX IF NOT EXISTS idx_profiles_import_consent
  ON profiles(preferred_center_id, whatsapp_consent, sms_consent)
  WHERE role = 'customer';

CREATE INDEX IF NOT EXISTS idx_import_templates_center
  ON crm_service_due_import_templates(service_center_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_batches_center
  ON crm_service_due_import_batches(service_center_id, created_at DESC);

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
  v_generated integer := 0;
  v_stage_counts jsonb := '{}'::jsonb;
BEGIN
  WITH allowed_centers AS (
    SELECT sc.id
    FROM service_centers sc
    WHERE (p_service_center_id IS NULL OR sc.id = p_service_center_id)
      AND (v_actor IS NULL OR public.can_access_dealer_service_center(sc.id))
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
  v_queued integer := 0;
  v_skipped_missing_recipient integer := 0;
  v_stage_counts jsonb := '{}'::jsonb;
BEGIN
  WITH allowed_centers AS (
    SELECT sc.id
    FROM service_centers sc
    WHERE (p_service_center_id IS NULL OR sc.id = p_service_center_id)
      AND (v_actor IS NULL OR public.can_access_dealer_service_center(sc.id))
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
      COALESCE(NULLIF(cv.branch_name, ''), sc.name) AS branch_name,
      trim(both from concat_ws(', ', NULLIF(sc.city, ''), NULLIF(sc.state, ''), NULLIF(sc.pincode, ''))) AS dealer_location,
      cv.registration_number,
      cv.last_service_date,
      cv.last_service_type,
      CASE COALESCE(cv.last_service_type, 'periodic')
        WHEN 'free' THEN 'free_service'
        WHEN 'paid' THEN 'paid_service'
        ELSE 'general_service'
      END AS booking_service_type,
      COALESCE(NULLIF(cv.service_due_type_label, ''), initcap(replace(COALESCE(cv.last_service_type, 'periodic'), '_', ' '))) AS service_type_label,
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
        AND COALESCE(l.lead_source, l.metadata->>'lead_source', '') = 'service_bikeai'
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
      lead_source,
      metadata,
      created_by
    )
    SELECT
      replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      e.customer_id,
      e.vehicle_id,
      e.service_center_id,
      e.booking_service_type,
      e.due_date,
      e.due_km,
      'service_bikeai',
      jsonb_build_object(
        'source', 'queue_due_service_reminders',
        'lead_source', 'service_bikeai',
        'stage', e.stage,
        'service_due_reminder_id', e.id,
        'service_type', e.service_type_label,
        'branch_name', e.branch_name,
        'dealer_location', e.dealer_location
      ),
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
  link_payload AS (
    SELECT
      e.*,
      CASE
        WHEN e.booking_token IS NULL THEN ''
        ELSE concat(
          '/customer/book/',
          e.booking_token,
          '?service=',
          e.booking_service_type,
          '&center=',
          e.service_center_id,
          '&source=service_bikeai&lead_source=service_bikeai&vehicle=',
          e.vehicle_id,
          CASE WHEN e.due_date IS NOT NULL THEN concat('&due_date=', e.due_date) ELSE '' END,
          CASE WHEN e.due_km IS NOT NULL THEN concat('&due_km=', e.due_km) ELSE '' END
        )
      END AS booking_link
    FROM eligible_with_links e
    WHERE e.recipient <> ''
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
                    '{{last_service_type}}', e.service_type_label
                  ),
                  '{{service_type}}', e.service_type_label
                ),
                '{{branch_name}}', COALESCE(NULLIF(e.branch_name, ''), NULLIF(e.dealer_name, ''), 'your service center')
              ),
              '{{dealer_location}}', COALESCE(NULLIF(e.dealer_location, ''), '')
            ),
            '{{booking_link}}', e.booking_link
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
            ' at ',
            COALESCE(NULLIF(e.branch_name, ''), NULLIF(e.dealer_name, ''), 'your service center'),
            CASE WHEN NULLIF(e.dealer_location, '') IS NOT NULL THEN concat(', ', e.dealer_location) ELSE '' END,
            '. Book here: ',
            e.booking_link
          )
      END AS body
    FROM link_payload e
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
        'booking_token', q.booking_token,
        'lead_source', 'service_bikeai',
        'service_type', q.service_type_label,
        'branch_name', q.branch_name,
        'dealer_location', q.dealer_location
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

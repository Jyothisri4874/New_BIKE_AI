/*
  # Phase 2 Security Hardening

  Tightens the risky RLS surfaces found in the audit, adds token/OTP hash
  fields, and keeps legacy raw token columns only for temporary route
  compatibility. This does not add reminder automation or provider workers.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.sha256_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT encode(digest(value, 'sha256'), 'hex')
$$;

-- Token hash columns and compatibility backfill.
ALTER TABLE crm_booking_links ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE service_customer_tokens ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE service_approval_requests ADD COLUMN IF NOT EXISTS approval_token_hash text;

UPDATE crm_booking_links
SET token_hash = public.sha256_text(token)
WHERE token IS NOT NULL AND token_hash IS NULL;

UPDATE service_customer_tokens
SET token_hash = public.sha256_text(token)
WHERE token IS NOT NULL AND token_hash IS NULL;

UPDATE service_approval_requests
SET approval_token_hash = public.sha256_text(approval_token)
WHERE approval_token IS NOT NULL AND approval_token_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_booking_links_token_hash
  ON crm_booking_links(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_customer_tokens_token_hash
  ON service_customer_tokens(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_approval_requests_token_hash
  ON service_approval_requests(approval_token_hash)
  WHERE approval_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_crm_booking_link_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token IS NOT NULL THEN
    NEW.token_hash := public.sha256_text(NEW.token);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_service_customer_token_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token IS NOT NULL THEN
    NEW.token_hash := public.sha256_text(NEW.token);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_service_approval_token_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.approval_token IS NOT NULL THEN
    NEW.approval_token_hash := public.sha256_text(NEW.approval_token);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_booking_links_hash ON crm_booking_links;
CREATE TRIGGER trg_crm_booking_links_hash
  BEFORE INSERT OR UPDATE OF token ON crm_booking_links
  FOR EACH ROW EXECUTE FUNCTION public.set_crm_booking_link_hash();

DROP TRIGGER IF EXISTS trg_service_customer_tokens_hash ON service_customer_tokens;
CREATE TRIGGER trg_service_customer_tokens_hash
  BEFORE INSERT OR UPDATE OF token ON service_customer_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_service_customer_token_hash();

DROP TRIGGER IF EXISTS trg_service_approval_requests_hash ON service_approval_requests;
CREATE TRIGGER trg_service_approval_requests_hash
  BEFORE INSERT OR UPDATE OF approval_token ON service_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_service_approval_token_hash();

-- OTP hash fields. Plaintext columns remain only as legacy compatibility
-- sinks and are nulled/blanked by triggers.
ALTER TABLE customer_otp_sessions ADD COLUMN IF NOT EXISTS otp_code_hash text;
ALTER TABLE customer_otp_sessions ALTER COLUMN otp_code DROP NOT NULL;
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS otp_code_hash text;
ALTER TABLE otp_verifications ALTER COLUMN otp_code DROP NOT NULL;
ALTER TABLE pickup_deliveries ADD COLUMN IF NOT EXISTS otp_code_hash text;
ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS verification_otp_hash text;
ALTER TABLE service_inspections ADD COLUMN IF NOT EXISTS acknowledgement_otp_hash text;

UPDATE customer_otp_sessions
SET otp_code_hash = public.sha256_text(otp_code), otp_code = NULL
WHERE otp_code IS NOT NULL AND otp_code <> '';

UPDATE otp_verifications
SET otp_code_hash = public.sha256_text(otp_code), otp_code = NULL
WHERE otp_code IS NOT NULL AND otp_code <> '';

UPDATE pickup_deliveries
SET otp_code_hash = public.sha256_text(otp_code), otp_code = NULL
WHERE otp_code IS NOT NULL AND otp_code <> '';

UPDATE customer_bookings
SET verification_otp_hash = public.sha256_text(verification_otp), verification_otp = ''
WHERE verification_otp IS NOT NULL AND verification_otp <> '';

UPDATE service_inspections
SET acknowledgement_otp_hash = public.sha256_text(acknowledgement_otp), acknowledgement_otp = ''
WHERE acknowledgement_otp IS NOT NULL AND acknowledgement_otp <> '';

CREATE OR REPLACE FUNCTION public.hash_customer_otp_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.otp_code IS NOT NULL AND NEW.otp_code <> '' THEN
    NEW.otp_code_hash := public.sha256_text(NEW.otp_code);
    NEW.otp_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_otp_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.otp_code IS NOT NULL AND NEW.otp_code <> '' THEN
    NEW.otp_code_hash := public.sha256_text(NEW.otp_code);
    NEW.otp_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_pickup_delivery_otp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.otp_code IS NOT NULL AND NEW.otp_code <> '' THEN
    NEW.otp_code_hash := public.sha256_text(NEW.otp_code);
    NEW.otp_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_customer_booking_otp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.verification_otp IS NOT NULL AND NEW.verification_otp <> '' THEN
    NEW.verification_otp_hash := public.sha256_text(NEW.verification_otp);
    NEW.verification_otp := '';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_service_inspection_otp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.acknowledgement_otp IS NOT NULL AND NEW.acknowledgement_otp <> '' THEN
    NEW.acknowledgement_otp_hash := public.sha256_text(NEW.acknowledgement_otp);
    NEW.acknowledgement_otp := '';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_otp_sessions_hash ON customer_otp_sessions;
CREATE TRIGGER trg_customer_otp_sessions_hash
  BEFORE INSERT OR UPDATE OF otp_code ON customer_otp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.hash_customer_otp_session();

DROP TRIGGER IF EXISTS trg_otp_verifications_hash ON otp_verifications;
CREATE TRIGGER trg_otp_verifications_hash
  BEFORE INSERT OR UPDATE OF otp_code ON otp_verifications
  FOR EACH ROW EXECUTE FUNCTION public.hash_otp_verification();

DROP TRIGGER IF EXISTS trg_pickup_deliveries_otp_hash ON pickup_deliveries;
CREATE TRIGGER trg_pickup_deliveries_otp_hash
  BEFORE INSERT OR UPDATE OF otp_code ON pickup_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.hash_pickup_delivery_otp();

DROP TRIGGER IF EXISTS trg_customer_bookings_otp_hash ON customer_bookings;
CREATE TRIGGER trg_customer_bookings_otp_hash
  BEFORE INSERT OR UPDATE OF verification_otp ON customer_bookings
  FOR EACH ROW EXECUTE FUNCTION public.hash_customer_booking_otp();

DROP TRIGGER IF EXISTS trg_service_inspections_otp_hash ON service_inspections;
CREATE TRIGGER trg_service_inspections_otp_hash
  BEFORE INSERT OR UPDATE OF acknowledgement_otp ON service_inspections
  FOR EACH ROW EXECUTE FUNCTION public.hash_service_inspection_otp();

-- Public dealer search can read only active dealer records through RLS.
DROP POLICY IF EXISTS "Anon can view active dealers" ON service_centers;
CREATE POLICY "Anon can view active dealers"
  ON service_centers FOR SELECT TO anon
  USING (is_active = true AND status = 'active');

GRANT SELECT ON service_centers TO anon;
GRANT EXECUTE ON FUNCTION nearby_service_centers(double precision, double precision, double precision, text, text, integer) TO anon, authenticated;

-- notification_queue: remove broad authenticated policies and require scope.
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Auth insert notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Auth update notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Dealer ops select notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Dealer ops insert notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Dealer ops update notification_queue" ON notification_queue;

CREATE POLICY "Customers view own notification_queue"
  ON notification_queue FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Dealers manage own notification_queue"
  ON notification_queue FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM service_job_cards jc
      JOIN service_centers sc ON sc.id = jc.service_center_id
      WHERE jc.id = job_card_id AND sc.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM service_job_cards jc
      JOIN service_centers sc ON sc.id = jc.service_center_id
      WHERE jc.id = job_card_id AND sc.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- sms_messages: service-role function writes after auth; direct reads/writes stay scoped.
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS service_center_id uuid REFERENCES service_centers(id) ON DELETE SET NULL;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view sms_messages" ON sms_messages;
DROP POLICY IF EXISTS "Authenticated users can insert sms_messages" ON sms_messages;
DROP POLICY IF EXISTS "Customers view own sms_messages" ON sms_messages;
DROP POLICY IF EXISTS "Dealers manage own sms_messages" ON sms_messages;
DROP POLICY IF EXISTS "Admins manage sms_messages" ON sms_messages;

UPDATE sms_messages
SET body_preview = regexp_replace(body_preview, '\m[0-9]{4,8}\M', '[redacted]', 'g')
WHERE message_type IN ('otp', 'pickup_arrived');

CREATE POLICY "Customers view own sms_messages"
  ON sms_messages FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Dealers manage own sms_messages"
  ON sms_messages FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
  );

CREATE POLICY "Admins manage sms_messages"
  ON sms_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- customer_otp_sessions: no public/client OTP writes; use a dedicated auth flow later.
ALTER TABLE customer_otp_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read otp sessions" ON customer_otp_sessions;
DROP POLICY IF EXISTS "Anon can insert otp session" ON customer_otp_sessions;
DROP POLICY IF EXISTS "Authenticated can insert otp session" ON customer_otp_sessions;
DROP POLICY IF EXISTS "Admins manage customer otp sessions" ON customer_otp_sessions;

CREATE POLICY "Admins manage customer otp sessions"
  ON customer_otp_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- otp_verifications remain admin/dealer scoped and plaintext-free.
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage otps" ON otp_verifications;
DROP POLICY IF EXISTS "Admins can insert otps" ON otp_verifications;
DROP POLICY IF EXISTS "Admins can update otps" ON otp_verifications;
DROP POLICY IF EXISTS "Admins manage otp_verifications" ON otp_verifications;
DROP POLICY IF EXISTS "Dealers manage own otp_verifications" ON otp_verifications;

CREATE POLICY "Admins manage otp_verifications"
  ON otp_verifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Dealers manage own otp_verifications"
  ON otp_verifications FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM pickup_deliveries pd
      JOIN service_centers sc ON sc.id = pd.service_center_id
      WHERE pd.id = job_id AND sc.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM pickup_deliveries pd
      JOIN service_centers sc ON sc.id = pd.service_center_id
      WHERE pd.id = job_id AND sc.owner_id = auth.uid()
    )
  );

-- service_chat_memory: customers can only see/write customer-visible own rows.
DROP POLICY IF EXISTS "Dealer ops select service_chat_memory" ON service_chat_memory;
DROP POLICY IF EXISTS "Dealer ops insert service_chat_memory" ON service_chat_memory;
DROP POLICY IF EXISTS "Dealer ops update service_chat_memory" ON service_chat_memory;
DROP POLICY IF EXISTS "Customers view own customer-visible chat memory" ON service_chat_memory;
DROP POLICY IF EXISTS "Customers insert own customer-visible chat memory" ON service_chat_memory;
DROP POLICY IF EXISTS "Dealers manage own service_chat_memory" ON service_chat_memory;

CREATE POLICY "Customers view own customer-visible chat memory"
  ON service_chat_memory FOR SELECT TO authenticated
  USING (customer_id = auth.uid() AND COALESCE(visibility, 'internal') = 'customer');

CREATE POLICY "Customers insert own customer-visible chat memory"
  ON service_chat_memory FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND COALESCE(visibility, 'customer') = 'customer'
    AND (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.preferred_center_id = service_center_id)
      OR EXISTS (SELECT 1 FROM service_job_cards jc WHERE jc.id = job_card_id AND jc.customer_id = auth.uid() AND jc.service_center_id = service_center_id)
    )
  );

CREATE POLICY "Dealers manage own service_chat_memory"
  ON service_chat_memory FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND sc.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Keep booking links and CRM timeline dealer/customer scoped.
DROP POLICY IF EXISTS "Dealers manage own booking links" ON crm_booking_links;
DROP POLICY IF EXISTS "Customers can use own booking links" ON crm_booking_links;
DROP POLICY IF EXISTS "Customers can mark own booking links used" ON crm_booking_links;

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

CREATE POLICY "Customers can use own booking links"
  ON crm_booking_links FOR SELECT TO authenticated
  USING (auth.uid() = customer_id AND expires_at > now());

CREATE POLICY "Customers can mark own booking links used"
  ON crm_booking_links FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id AND expires_at > now())
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Dealers manage own customer tokens" ON service_customer_tokens;
CREATE POLICY "Dealers manage own customer tokens"
  ON service_customer_tokens FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Dealers manage own interaction events" ON crm_interaction_events;
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

-- Public self-service RPCs use token hashes first and no longer echo raw tokens.
CREATE OR REPLACE FUNCTION get_self_service_payload(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok service_customer_tokens%rowtype;
  token_digest text := public.sha256_text(p_token);
  payload jsonb;
BEGIN
  SELECT * INTO tok
  FROM service_customer_tokens
  WHERE (token_hash = token_digest OR token = p_token)
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF tok.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired token');
  END IF;

  UPDATE service_customer_tokens SET used_at = now() WHERE id = tok.id;

  SELECT jsonb_build_object(
    'ok', true,
    'token', jsonb_build_object('type', tok.token_type),
    'customer', (SELECT to_jsonb(p) - 'role' - 'avatar_url' FROM profiles p WHERE p.id = tok.customer_id),
    'booking', (SELECT to_jsonb(b) - 'verification_otp' - 'verification_otp_hash' - 'tracking_token' FROM customer_bookings b WHERE b.id = tok.booking_id),
    'vehicle', (SELECT to_jsonb(v) FROM customer_vehicles v WHERE v.id = (SELECT vehicle_id FROM customer_bookings WHERE id = tok.booking_id)),
    'service_center', (SELECT to_jsonb(sc) - 'owner_id' FROM service_centers sc WHERE sc.id = tok.service_center_id),
    'job_card', (SELECT to_jsonb(j) - 'tracking_token' FROM service_job_cards j WHERE j.id = tok.job_card_id),
    'timeline', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM service_job_timeline t WHERE t.job_card_id = tok.job_card_id AND t.visibility = 'customer'), '[]'::jsonb),
    'inspection', (SELECT to_jsonb(i) - 'acknowledgement_otp' - 'acknowledgement_otp_hash' FROM service_inspections i WHERE i.job_card_id = tok.job_card_id ORDER BY i.created_at DESC LIMIT 1),
    'approvals', COALESCE((SELECT jsonb_agg(to_jsonb(a) - 'approval_token' - 'approval_token_hash' ORDER BY a.created_at DESC) FROM service_approval_requests a WHERE a.job_card_id = tok.job_card_id), '[]'::jsonb),
    'feedback', (SELECT to_jsonb(f) FROM service_feedback_responses f WHERE f.token_id = tok.id ORDER BY f.created_at DESC LIMIT 1)
  ) INTO payload;

  RETURN payload;
END;
$$;

CREATE OR REPLACE FUNCTION submit_service_approval(p_token text, p_status text, p_note text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approval service_approval_requests%rowtype;
  tok service_customer_tokens%rowtype;
  token_digest text := public.sha256_text(p_token);
BEGIN
  SELECT * INTO approval
  FROM service_approval_requests
  WHERE (approval_token_hash = token_digest OR approval_token = p_token)
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF approval.id IS NULL THEN
    SELECT * INTO tok
    FROM service_customer_tokens
    WHERE token_hash = token_digest OR token = p_token
    LIMIT 1;

    IF tok.approval_id IS NOT NULL THEN
      SELECT * INTO approval
      FROM service_approval_requests
      WHERE id = tok.approval_id AND status = 'pending'
      LIMIT 1;
    END IF;
  END IF;

  IF approval.id IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid approval request');
  END IF;

  UPDATE service_approval_requests
  SET status = p_status, customer_note = COALESCE(p_note, ''), responded_at = now(), updated_at = now()
  WHERE id = approval.id;

  INSERT INTO service_job_timeline(job_card_id, customer_id, service_center_id, status, title, notes, visibility)
  VALUES (approval.job_card_id, approval.customer_id, approval.service_center_id, p_status, 'Customer approval ' || p_status, COALESCE(p_note, ''), 'customer');

  INSERT INTO crm_interaction_events(customer_id, service_center_id, event_type, title, body, entity_type, entity_id)
  VALUES (approval.customer_id, approval.service_center_id, 'approval_' || p_status, 'Service estimate ' || p_status, COALESCE(p_note, ''), 'service_approval_request', approval.id);

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION submit_service_feedback(p_token text, p_rating integer, p_comments text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok service_customer_tokens%rowtype;
  token_digest text := public.sha256_text(p_token);
  risk_tags text[] := '{}';
  is_escalation boolean := false;
BEGIN
  SELECT * INTO tok
  FROM service_customer_tokens
  WHERE (token_hash = token_digest OR token = p_token)
    AND token_type IN ('feedback', 'tracking')
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF tok.id IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid feedback link');
  END IF;

  IF p_rating <= 3 THEN
    risk_tags := array_append(risk_tags, 'unhappy_customer');
    risk_tags := array_append(risk_tags, 'retention_risk');
    is_escalation := true;
  END IF;
  IF p_comments ILIKE '%delay%' THEN risk_tags := array_append(risk_tags, 'delay_frustration'); END IF;
  IF p_comments ILIKE '%again%' OR p_comments ILIKE '%repeat%' THEN risk_tags := array_append(risk_tags, 'repeat_issue'); END IF;
  IF p_comments ILIKE '%breakdown%' THEN risk_tags := array_append(risk_tags, 'breakdown_risk'); END IF;

  INSERT INTO service_feedback_responses(token_id, customer_id, booking_id, job_card_id, service_center_id, rating, comments, tags, requires_escalation)
  VALUES (tok.id, tok.customer_id, tok.booking_id, tok.job_card_id, tok.service_center_id, p_rating, COALESCE(p_comments, ''), risk_tags, is_escalation);

  INSERT INTO crm_interaction_events(customer_id, service_center_id, event_type, title, body, entity_type, entity_id)
  VALUES (tok.customer_id, tok.service_center_id, CASE WHEN is_escalation THEN 'negative_feedback' ELSE 'feedback_received' END, 'Customer feedback received', COALESCE(p_comments, ''), 'service_feedback', tok.id);

  IF is_escalation AND tok.job_card_id IS NOT NULL THEN
    UPDATE service_job_cards
    SET operational_risk_state = 'escalated',
        risk_tags = ARRAY(SELECT DISTINCT unnest(risk_tags || service_job_cards.risk_tags)),
        updated_at = now()
    WHERE id = tok.job_card_id;

    INSERT INTO service_job_timeline(job_card_id, customer_id, service_center_id, status, title, notes, visibility)
    VALUES (tok.job_card_id, tok.customer_id, tok.service_center_id, 'escalated', 'Negative feedback escalation', COALESCE(p_comments, ''), 'internal');
  END IF;

  RETURN jsonb_build_object('ok', true, 'requires_escalation', is_escalation);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sms_messages_center ON sms_messages(service_center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_otp_sessions_hash ON customer_otp_sessions(otp_code_hash);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_hash ON otp_verifications(otp_code_hash);

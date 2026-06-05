/*
  # Customer Self-Service and Chatbot Automation Layer

  Adds tokenized customer access, public self-service RPCs, feedback escalation,
  and operational risk metadata without changing the existing booking/job flows.
*/

CREATE TABLE IF NOT EXISTS service_customer_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  token_type text NOT NULL DEFAULT 'tracking' CHECK (token_type IN ('booking', 'tracking', 'approval', 'inspection', 'invoice', 'feedback')),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES customer_bookings(id) ON DELETE CASCADE,
  job_card_id uuid REFERENCES service_job_cards(id) ON DELETE CASCADE,
  approval_id uuid REFERENCES service_approval_requests(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  expires_at timestamptz DEFAULT (now() + interval '45 days'),
  used_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES service_customer_tokens(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES customer_bookings(id) ON DELETE SET NULL,
  job_card_id uuid REFERENCES service_job_cards(id) ON DELETE SET NULL,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments text DEFAULT '',
  tags text[] DEFAULT '{}',
  requires_escalation boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_job_cards' AND column_name='tracking_token') THEN
    ALTER TABLE service_job_cards ADD COLUMN tracking_token text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_job_cards' AND column_name='operational_risk_state') THEN
    ALTER TABLE service_job_cards ADD COLUMN operational_risk_state text DEFAULT 'normal' CHECK (operational_risk_state IN ('normal', 'watch', 'escalated'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_job_cards' AND column_name='risk_tags') THEN
    ALTER TABLE service_job_cards ADD COLUMN risk_tags text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_bookings' AND column_name='tracking_token') THEN
    ALTER TABLE customer_bookings ADD COLUMN tracking_token text UNIQUE;
  END IF;
END $$;

ALTER TABLE service_customer_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_feedback_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_customer_tokens' AND policyname='Dealers manage own customer tokens') THEN
    CREATE POLICY "Dealers manage own customer tokens"
      ON service_customer_tokens FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_feedback_responses' AND policyname='Dealers view own feedback responses') THEN
    CREATE POLICY "Dealers view own feedback responses"
      ON service_feedback_responses FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = service_center_id
          AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      ));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_self_service_payload(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok service_customer_tokens%rowtype;
  payload jsonb;
BEGIN
  SELECT * INTO tok
  FROM service_customer_tokens
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF tok.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired token');
  END IF;

  UPDATE service_customer_tokens SET used_at = now() WHERE id = tok.id;

  SELECT jsonb_build_object(
    'ok', true,
    'token', jsonb_build_object('token', tok.token, 'type', tok.token_type),
    'customer', (SELECT to_jsonb(p) - 'role' - 'avatar_url' FROM profiles p WHERE p.id = tok.customer_id),
    'booking', (SELECT to_jsonb(b) FROM customer_bookings b WHERE b.id = tok.booking_id),
    'vehicle', (SELECT to_jsonb(v) FROM customer_vehicles v WHERE v.id = (SELECT vehicle_id FROM customer_bookings WHERE id = tok.booking_id)),
    'service_center', (SELECT to_jsonb(sc) - 'owner_id' FROM service_centers sc WHERE sc.id = tok.service_center_id),
    'job_card', (SELECT to_jsonb(j) FROM service_job_cards j WHERE j.id = tok.job_card_id),
    'timeline', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM service_job_timeline t WHERE t.job_card_id = tok.job_card_id AND t.visibility = 'customer'), '[]'::jsonb),
    'inspection', (SELECT to_jsonb(i) FROM service_inspections i WHERE i.job_card_id = tok.job_card_id ORDER BY i.created_at DESC LIMIT 1),
    'approvals', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM service_approval_requests a WHERE a.job_card_id = tok.job_card_id), '[]'::jsonb),
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
BEGIN
  SELECT * INTO approval
  FROM service_approval_requests
  WHERE approval_token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF approval.id IS NULL THEN
    SELECT * INTO tok FROM service_customer_tokens WHERE token = p_token LIMIT 1;
    IF tok.approval_id IS NOT NULL THEN
      SELECT * INTO approval FROM service_approval_requests WHERE id = tok.approval_id AND status = 'pending' LIMIT 1;
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
  risk_tags text[] := '{}';
  is_escalation boolean := false;
BEGIN
  SELECT * INTO tok
  FROM service_customer_tokens
  WHERE token = p_token
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

CREATE INDEX IF NOT EXISTS idx_service_customer_tokens_token ON service_customer_tokens(token);
CREATE INDEX IF NOT EXISTS idx_service_customer_tokens_job ON service_customer_tokens(job_card_id, token_type);
CREATE INDEX IF NOT EXISTS idx_service_feedback_center ON service_feedback_responses(service_center_id, created_at DESC);

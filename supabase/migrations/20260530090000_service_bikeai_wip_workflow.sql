/*
  # Service.BikeAI WIP Workflow

  BikeAI stores workshop tracking records linked to official dealer DMS job
  numbers. It does not create dealer job cards.
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

CREATE TABLE IF NOT EXISTS dealer_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  role text NOT NULL DEFAULT 'technician'
    CHECK (role IN ('dealer_admin', 'service_advisor', 'technician', 'washing_staff', 'qc_inspector', 'inventory_manager', 'viewer')),
  permissions text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_center_id, profile_id)
);

CREATE TABLE IF NOT EXISTS wip_tracking_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  dealer_dms_job_no text NOT NULL,
  dealer_dms_invoice_no text DEFAULT '',
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_whatsapp text DEFAULT '',
  vehicle_id uuid REFERENCES customer_vehicles(id) ON DELETE SET NULL,
  vehicle_registration_no text NOT NULL,
  vehicle_model text DEFAULT '',
  odometer_km integer,
  tracking_code text NOT NULL DEFAULT ('wip_' || encode(gen_random_bytes(18), 'hex')),
  tracking_code_hash text,
  customer_tracking_path text NOT NULL DEFAULT '',
  current_status text NOT NULL DEFAULT 'received'
    CHECK (current_status IN ('received', 'inspection', 'approval', 'repair', 'wash', 'qc', 'ready', 'delivered')),
  status_detail text DEFAULT '',
  approval_state text NOT NULL DEFAULT 'not_required'
    CHECK (approval_state IN ('not_required', 'pending', 'approved', 'rejected')),
  technician_id uuid REFERENCES dealer_staff(id) ON DELETE SET NULL,
  assigned_technician_name text DEFAULT '',
  promised_at timestamptz,
  received_at timestamptz DEFAULT now(),
  inspection_started_at timestamptz,
  inspection_completed_at timestamptz,
  approval_requested_at timestamptz,
  repair_started_at timestamptz,
  wash_started_at timestamptz,
  qc_started_at timestamptz,
  invoice_generated_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  closed_at timestamptz,
  notes text DEFAULT '',
  internal_notes text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_center_id, dealer_dms_job_no),
  UNIQUE(tracking_code),
  UNIQUE(tracking_code_hash)
);

CREATE TABLE IF NOT EXISTS wip_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_tracking_record_id uuid NOT NULL REFERENCES wip_tracking_records(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  status_from text CHECK (status_from IS NULL OR status_from IN ('received', 'inspection', 'approval', 'repair', 'wash', 'qc', 'ready', 'delivered')),
  status_to text NOT NULL CHECK (status_to IN ('received', 'inspection', 'approval', 'repair', 'wash', 'qc', 'ready', 'delivered')),
  status_detail text DEFAULT '',
  event_type text NOT NULL DEFAULT 'status_change'
    CHECK (event_type IN ('record_created', 'status_change', 'technician_assigned', 'approval_requested', 'approval_response', 'photo_added', 'note_added', 'notification_queued')),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_staff_id uuid REFERENCES dealer_staff(id) ON DELETE SET NULL,
  customer_visible boolean NOT NULL DEFAULT true,
  note text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wip_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_tracking_record_id uuid NOT NULL REFERENCES wip_tracking_records(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  approval_no text DEFAULT '',
  title text NOT NULL DEFAULT 'Additional work approval',
  description text DEFAULT '',
  estimate_amount numeric(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  customer_response_note text DEFAULT '',
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requested_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_tracking_record_id uuid NOT NULL REFERENCES wip_tracking_records(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  photo_type text NOT NULL DEFAULT 'other'
    CHECK (photo_type IN ('received', 'inspection', 'approval', 'repair', 'wash', 'qc', 'delivery', 'damage', 'other')),
  photo_url text NOT NULL,
  caption text DEFAULT '',
  customer_visible boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS technician_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_tracking_record_id uuid NOT NULL REFERENCES wip_tracking_records(id) ON DELETE CASCADE,
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  technician_staff_id uuid NOT NULL REFERENCES dealer_staff(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  assigned_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  notes text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.can_manage_wip_service_center(p_service_center_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_service_center_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND COALESCE(p.is_active, true) = true
    )
    OR EXISTS (
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
    OR EXISTS (
      SELECT 1
      FROM dealer_staff ds
      WHERE ds.service_center_id = p_service_center_id
        AND ds.profile_id = auth.uid()
        AND ds.is_active = true
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.wip_status_position(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'received' THEN 1
    WHEN 'inspection' THEN 2
    WHEN 'approval' THEN 3
    WHEN 'repair' THEN 4
    WHEN 'wash' THEN 5
    WHEN 'qc' THEN 6
    WHEN 'ready' THEN 7
    WHEN 'delivered' THEN 8
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.can_transition_wip_status(p_current text, p_next text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.wip_status_position(p_next) > 0
    AND (
      p_current = p_next
      OR public.wip_status_position(p_next) = public.wip_status_position(p_current) + 1
    )
$$;

CREATE OR REPLACE FUNCTION public.set_wip_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_wip_tracking_security()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
    NEW.tracking_code := 'wip_' || encode(gen_random_bytes(18), 'hex');
  END IF;

  NEW.tracking_code_hash := public.sha256_text(NEW.tracking_code);
  NEW.customer_tracking_path := '/service/track/' || NEW.tracking_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wip_tracking_security ON wip_tracking_records;
CREATE TRIGGER trg_wip_tracking_security
  BEFORE INSERT OR UPDATE OF tracking_code ON wip_tracking_records
  FOR EACH ROW EXECUTE FUNCTION public.set_wip_tracking_security();

DROP TRIGGER IF EXISTS trg_dealer_staff_updated_at ON dealer_staff;
CREATE TRIGGER trg_dealer_staff_updated_at
  BEFORE UPDATE ON dealer_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_wip_updated_at();

DROP TRIGGER IF EXISTS trg_wip_tracking_records_updated_at ON wip_tracking_records;
CREATE TRIGGER trg_wip_tracking_records_updated_at
  BEFORE UPDATE ON wip_tracking_records
  FOR EACH ROW EXECUTE FUNCTION public.set_wip_updated_at();

DROP TRIGGER IF EXISTS trg_wip_approvals_updated_at ON wip_approvals;
CREATE TRIGGER trg_wip_approvals_updated_at
  BEFORE UPDATE ON wip_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_wip_updated_at();

DROP TRIGGER IF EXISTS trg_technician_assignments_updated_at ON technician_assignments;
CREATE TRIGGER trg_technician_assignments_updated_at
  BEFORE UPDATE ON technician_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_wip_updated_at();

CREATE OR REPLACE FUNCTION public.queue_wip_whatsapp_notification(
  p_record_id uuid,
  p_event_type text DEFAULT 'status_update'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec wip_tracking_records%rowtype;
  center_name text := 'your service center';
  recipient text := '';
  body text := '';
  queue_id uuid;
BEGIN
  SELECT * INTO rec
  FROM wip_tracking_records
  WHERE id = p_record_id;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'WIP tracking record not found';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.can_manage_wip_service_center(rec.service_center_id) THEN
    RAISE EXCEPTION 'WIP service center access required';
  END IF;

  SELECT COALESCE(NULLIF(sc.name, ''), center_name)
  INTO center_name
  FROM service_centers sc
  WHERE sc.id = rec.service_center_id;

  recipient := regexp_replace(COALESCE(NULLIF(rec.customer_whatsapp, ''), rec.customer_phone, ''), '[^0-9]', '', 'g');

  IF recipient = '' THEN
    RETURN NULL;
  END IF;

  body := 'Hi ' || COALESCE(NULLIF(rec.customer_name, ''), 'Customer') ||
    ', your vehicle service for DMS Job ' || rec.dealer_dms_job_no ||
    ' is now ' || initcap(replace(rec.current_status, '_', ' ')) ||
    ' at ' || center_name ||
    '. Track live: https://service.bikeai.in' || rec.customer_tracking_path;

  INSERT INTO notification_queue (
    service_center_id,
    customer_id,
    user_id,
    channel,
    recipient,
    subject,
    body,
    status,
    entity_type,
    entity_id,
    scheduled_at,
    metadata
  )
  VALUES (
    rec.service_center_id,
    rec.customer_id,
    rec.customer_id,
    'whatsapp',
    recipient,
    'BikeAI service tracking update',
    body,
    'pending',
    'wip_tracking_record',
    rec.id,
    now(),
    jsonb_build_object(
      'source', 'queue_wip_whatsapp_notification',
      'event_type', p_event_type,
      'dealer_dms_job_no', rec.dealer_dms_job_no,
      'wip_status', rec.current_status,
      'tracking_path', rec.customer_tracking_path
    )
  )
  RETURNING id INTO queue_id;

  INSERT INTO wip_status_history (
    wip_tracking_record_id,
    service_center_id,
    status_from,
    status_to,
    event_type,
    actor_id,
    customer_visible,
    note,
    metadata
  )
  VALUES (
    rec.id,
    rec.service_center_id,
    rec.current_status,
    rec.current_status,
    'notification_queued',
    auth.uid(),
    false,
    'WhatsApp notification queued.',
    jsonb_build_object('notification_queue_id', queue_id)
  );

  RETURN queue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_wip_tracking_record(
  p_service_center_id uuid,
  p_dealer_dms_job_no text,
  p_customer_name text,
  p_customer_phone text,
  p_vehicle_registration_no text,
  p_vehicle_model text DEFAULT '',
  p_odometer_km integer DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_customer_whatsapp text DEFAULT '',
  p_promised_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec wip_tracking_records%rowtype;
BEGIN
  IF NOT public.can_manage_wip_service_center(p_service_center_id) THEN
    RAISE EXCEPTION 'WIP service center access required';
  END IF;

  IF NULLIF(trim(p_dealer_dms_job_no), '') IS NULL THEN
    RAISE EXCEPTION 'Dealer DMS job number is required';
  END IF;

  INSERT INTO wip_tracking_records (
    service_center_id,
    dealer_dms_job_no,
    customer_id,
    customer_name,
    customer_phone,
    customer_whatsapp,
    vehicle_id,
    vehicle_registration_no,
    vehicle_model,
    odometer_km,
    promised_at,
    notes,
    metadata,
    created_by,
    updated_by
  )
  VALUES (
    p_service_center_id,
    trim(p_dealer_dms_job_no),
    p_customer_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_customer_whatsapp),
    p_vehicle_id,
    upper(trim(p_vehicle_registration_no)),
    trim(p_vehicle_model),
    p_odometer_km,
    p_promised_at,
    p_notes,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('source', 'service_bikeai_wip'),
    auth.uid(),
    auth.uid()
  )
  RETURNING * INTO rec;

  INSERT INTO wip_status_history (
    wip_tracking_record_id,
    service_center_id,
    status_from,
    status_to,
    status_detail,
    event_type,
    actor_id,
    customer_visible,
    note
  )
  VALUES (
    rec.id,
    rec.service_center_id,
    NULL,
    'received',
    'Vehicle received at workshop. Dealer DMS job card already exists.',
    'record_created',
    auth.uid(),
    true,
    COALESCE(p_notes, '')
  );

  PERFORM public.queue_wip_whatsapp_notification(rec.id, 'record_created');

  RETURN jsonb_build_object('ok', true, 'record', to_jsonb(rec));
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_wip_status(
  p_record_id uuid,
  p_next_status text,
  p_status_detail text DEFAULT '',
  p_note text DEFAULT '',
  p_customer_visible boolean DEFAULT true,
  p_dealer_dms_invoice_no text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec wip_tracking_records%rowtype;
  updated_rec wip_tracking_records%rowtype;
  next_status text := lower(trim(p_next_status));
  invoice_no text := NULLIF(trim(COALESCE(p_dealer_dms_invoice_no, '')), '');
BEGIN
  SELECT * INTO rec
  FROM wip_tracking_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'WIP tracking record not found';
  END IF;

  IF NOT public.can_manage_wip_service_center(rec.service_center_id) THEN
    RAISE EXCEPTION 'WIP service center access required';
  END IF;

  IF NOT public.can_transition_wip_status(rec.current_status, next_status) THEN
    RAISE EXCEPTION 'Invalid WIP status transition from % to %', rec.current_status, next_status;
  END IF;

  IF next_status = 'repair' AND EXISTS (
    SELECT 1 FROM wip_approvals a
    WHERE a.wip_tracking_record_id = rec.id
      AND a.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Pending customer approval must be resolved before repair';
  END IF;

  IF next_status = 'ready'
     AND COALESCE(invoice_no, NULLIF(rec.dealer_dms_invoice_no, '')) IS NULL
     AND rec.invoice_generated_at IS NULL THEN
    RAISE EXCEPTION 'Dealer DMS invoice number is required before Ready';
  END IF;

  UPDATE wip_tracking_records
  SET current_status = next_status,
      status_detail = COALESCE(NULLIF(p_status_detail, ''), status_detail),
      dealer_dms_invoice_no = COALESCE(invoice_no, dealer_dms_invoice_no),
      approval_state = CASE
        WHEN next_status = 'approval' THEN 'pending'
        WHEN next_status = 'repair' AND approval_state = 'pending' THEN 'approved'
        ELSE approval_state
      END,
      inspection_started_at = CASE WHEN next_status = 'inspection' AND inspection_started_at IS NULL THEN now() ELSE inspection_started_at END,
      inspection_completed_at = CASE WHEN next_status = 'approval' AND inspection_completed_at IS NULL THEN now() ELSE inspection_completed_at END,
      approval_requested_at = CASE WHEN next_status = 'approval' AND approval_requested_at IS NULL THEN now() ELSE approval_requested_at END,
      repair_started_at = CASE WHEN next_status = 'repair' AND repair_started_at IS NULL THEN now() ELSE repair_started_at END,
      wash_started_at = CASE WHEN next_status = 'wash' AND wash_started_at IS NULL THEN now() ELSE wash_started_at END,
      qc_started_at = CASE WHEN next_status = 'qc' AND qc_started_at IS NULL THEN now() ELSE qc_started_at END,
      invoice_generated_at = CASE WHEN next_status = 'ready' AND invoice_generated_at IS NULL THEN now() ELSE invoice_generated_at END,
      ready_at = CASE WHEN next_status = 'ready' AND ready_at IS NULL THEN now() ELSE ready_at END,
      delivered_at = CASE WHEN next_status = 'delivered' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
      closed_at = CASE WHEN next_status = 'delivered' AND closed_at IS NULL THEN now() ELSE closed_at END,
      updated_by = auth.uid()
  WHERE id = rec.id
  RETURNING * INTO updated_rec;

  INSERT INTO wip_status_history (
    wip_tracking_record_id,
    service_center_id,
    status_from,
    status_to,
    status_detail,
    event_type,
    actor_id,
    customer_visible,
    note
  )
  VALUES (
    rec.id,
    rec.service_center_id,
    rec.current_status,
    next_status,
    COALESCE(NULLIF(p_status_detail, ''), ''),
    'status_change',
    auth.uid(),
    COALESCE(p_customer_visible, true),
    COALESCE(p_note, '')
  );

  PERFORM public.queue_wip_whatsapp_notification(rec.id, 'status_update');

  RETURN jsonb_build_object('ok', true, 'record', to_jsonb(updated_rec));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_wip_approval(
  p_record_id uuid,
  p_title text,
  p_description text DEFAULT '',
  p_estimate_amount numeric DEFAULT 0,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec wip_tracking_records%rowtype;
  approval wip_approvals%rowtype;
BEGIN
  SELECT * INTO rec
  FROM wip_tracking_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'WIP tracking record not found';
  END IF;

  IF NOT public.can_manage_wip_service_center(rec.service_center_id) THEN
    RAISE EXCEPTION 'WIP service center access required';
  END IF;

  INSERT INTO wip_approvals (
    wip_tracking_record_id,
    service_center_id,
    title,
    description,
    estimate_amount,
    requested_by,
    expires_at
  )
  VALUES (
    rec.id,
    rec.service_center_id,
    COALESCE(NULLIF(trim(p_title), ''), 'Additional work approval'),
    COALESCE(p_description, ''),
    COALESCE(p_estimate_amount, 0),
    auth.uid(),
    p_expires_at
  )
  RETURNING * INTO approval;

  UPDATE wip_tracking_records
  SET current_status = CASE WHEN public.wip_status_position(current_status) < 3 THEN 'approval' ELSE current_status END,
      approval_state = 'pending',
      approval_requested_at = COALESCE(approval_requested_at, now()),
      updated_by = auth.uid()
  WHERE id = rec.id;

  INSERT INTO wip_status_history (
    wip_tracking_record_id,
    service_center_id,
    status_from,
    status_to,
    event_type,
    actor_id,
    customer_visible,
    note,
    metadata
  )
  VALUES (
    rec.id,
    rec.service_center_id,
    rec.current_status,
    'approval',
    'approval_requested',
    auth.uid(),
    true,
    COALESCE(p_description, ''),
    jsonb_build_object('approval_id', approval.id, 'estimate_amount', approval.estimate_amount)
  );

  PERFORM public.queue_wip_whatsapp_notification(rec.id, 'approval_requested');

  RETURN jsonb_build_object('ok', true, 'approval', to_jsonb(approval));
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_wip_approval(
  p_tracking_code text,
  p_approval_id uuid,
  p_status text,
  p_customer_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec wip_tracking_records%rowtype;
  approval wip_approvals%rowtype;
  next_state text := lower(trim(p_status));
BEGIN
  IF next_state NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid approval status');
  END IF;

  SELECT * INTO rec
  FROM wip_tracking_records
  WHERE tracking_code_hash = public.sha256_text(p_tracking_code)
     OR tracking_code = p_tracking_code
  LIMIT 1;

  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid tracking code');
  END IF;

  SELECT * INTO approval
  FROM wip_approvals
  WHERE id = p_approval_id
    AND wip_tracking_record_id = rec.id
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF approval.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Approval is no longer pending');
  END IF;

  UPDATE wip_approvals
  SET status = next_state,
      customer_response_note = COALESCE(p_customer_note, ''),
      responded_at = now()
  WHERE id = approval.id
  RETURNING * INTO approval;

  UPDATE wip_tracking_records
  SET approval_state = CASE
        WHEN EXISTS (
          SELECT 1 FROM wip_approvals a
          WHERE a.wip_tracking_record_id = rec.id
            AND a.status = 'pending'
        ) THEN 'pending'
        ELSE next_state
      END,
      updated_at = now()
  WHERE id = rec.id;

  INSERT INTO wip_status_history (
    wip_tracking_record_id,
    service_center_id,
    status_from,
    status_to,
    event_type,
    customer_visible,
    note,
    metadata
  )
  VALUES (
    rec.id,
    rec.service_center_id,
    'approval',
    'approval',
    'approval_response',
    true,
    COALESCE(p_customer_note, ''),
    jsonb_build_object('approval_id', approval.id, 'status', next_state)
  );

  RETURN jsonb_build_object('ok', true, 'approval', to_jsonb(approval));
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_wip_technician(
  p_record_id uuid,
  p_technician_staff_id uuid,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec wip_tracking_records%rowtype;
  staff dealer_staff%rowtype;
  assignment technician_assignments%rowtype;
BEGIN
  SELECT * INTO rec
  FROM wip_tracking_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'WIP tracking record not found';
  END IF;

  IF NOT public.can_manage_wip_service_center(rec.service_center_id) THEN
    RAISE EXCEPTION 'WIP service center access required';
  END IF;

  SELECT * INTO staff
  FROM dealer_staff
  WHERE id = p_technician_staff_id
    AND service_center_id = rec.service_center_id
    AND role = 'technician'
    AND is_active = true;

  IF staff.id IS NULL THEN
    RAISE EXCEPTION 'Active technician staff member not found';
  END IF;

  UPDATE technician_assignments
  SET status = 'cancelled',
      updated_at = now()
  WHERE wip_tracking_record_id = rec.id
    AND status = 'active';

  INSERT INTO technician_assignments (
    wip_tracking_record_id,
    service_center_id,
    technician_staff_id,
    assigned_by,
    notes
  )
  VALUES (rec.id, rec.service_center_id, staff.id, auth.uid(), COALESCE(p_notes, ''))
  RETURNING * INTO assignment;

  UPDATE wip_tracking_records
  SET technician_id = staff.id,
      assigned_technician_name = staff.full_name,
      updated_by = auth.uid()
  WHERE id = rec.id;

  INSERT INTO wip_status_history (
    wip_tracking_record_id,
    service_center_id,
    status_from,
    status_to,
    event_type,
    actor_id,
    actor_staff_id,
    customer_visible,
    note
  )
  VALUES (
    rec.id,
    rec.service_center_id,
    rec.current_status,
    rec.current_status,
    'technician_assigned',
    auth.uid(),
    staff.id,
    true,
    'Technician assigned: ' || staff.full_name
  );

  RETURN jsonb_build_object('ok', true, 'assignment', to_jsonb(assignment));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wip_customer_tracking(p_tracking_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec wip_tracking_records%rowtype;
  payload jsonb;
BEGIN
  SELECT * INTO rec
  FROM wip_tracking_records
  WHERE tracking_code_hash = public.sha256_text(p_tracking_code)
     OR tracking_code = p_tracking_code
  LIMIT 1;

  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid tracking code');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'record', jsonb_build_object(
      'id', rec.id,
      'dealer_dms_job_no', rec.dealer_dms_job_no,
      'dealer_dms_invoice_no', rec.dealer_dms_invoice_no,
      'customer_name', rec.customer_name,
      'vehicle_registration_no', rec.vehicle_registration_no,
      'vehicle_model', rec.vehicle_model,
      'current_status', rec.current_status,
      'status_detail', rec.status_detail,
      'approval_state', rec.approval_state,
      'promised_at', rec.promised_at,
      'received_at', rec.received_at,
      'ready_at', rec.ready_at,
      'delivered_at', rec.delivered_at,
      'closed_at', rec.closed_at
    ),
    'service_center', (
      SELECT to_jsonb(sc) - 'owner_id'
      FROM service_centers sc
      WHERE sc.id = rec.service_center_id
    ),
    'history', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at ASC)
      FROM wip_status_history h
      WHERE h.wip_tracking_record_id = rec.id
        AND h.customer_visible = true
    ), '[]'::jsonb),
    'approvals', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) - 'service_center_id' ORDER BY a.created_at DESC)
      FROM wip_approvals a
      WHERE a.wip_tracking_record_id = rec.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
      FROM wip_photos p
      WHERE p.wip_tracking_record_id = rec.id
        AND p.customer_visible = true
    ), '[]'::jsonb)
  ) INTO payload;

  RETURN payload;
END;
$$;

ALTER TABLE dealer_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE wip_tracking_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wip_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE wip_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE wip_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dealer staff select own center staff" ON dealer_staff;
CREATE POLICY "Dealer staff select own center staff"
  ON dealer_staff FOR SELECT TO authenticated
  USING (public.can_manage_wip_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer owners manage staff" ON dealer_staff;
CREATE POLICY "Dealer owners manage staff"
  ON dealer_staff FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Dealer staff manage wip tracking records" ON wip_tracking_records;
CREATE POLICY "Dealer staff manage wip tracking records"
  ON wip_tracking_records FOR ALL TO authenticated
  USING (public.can_manage_wip_service_center(service_center_id))
  WITH CHECK (public.can_manage_wip_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer staff manage wip status history" ON wip_status_history;
CREATE POLICY "Dealer staff manage wip status history"
  ON wip_status_history FOR ALL TO authenticated
  USING (public.can_manage_wip_service_center(service_center_id))
  WITH CHECK (public.can_manage_wip_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer staff manage wip approvals" ON wip_approvals;
CREATE POLICY "Dealer staff manage wip approvals"
  ON wip_approvals FOR ALL TO authenticated
  USING (public.can_manage_wip_service_center(service_center_id))
  WITH CHECK (public.can_manage_wip_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer staff manage wip photos" ON wip_photos;
CREATE POLICY "Dealer staff manage wip photos"
  ON wip_photos FOR ALL TO authenticated
  USING (public.can_manage_wip_service_center(service_center_id))
  WITH CHECK (public.can_manage_wip_service_center(service_center_id));

DROP POLICY IF EXISTS "Dealer staff manage technician assignments" ON technician_assignments;
CREATE POLICY "Dealer staff manage technician assignments"
  ON technician_assignments FOR ALL TO authenticated
  USING (public.can_manage_wip_service_center(service_center_id))
  WITH CHECK (public.can_manage_wip_service_center(service_center_id));

CREATE INDEX IF NOT EXISTS idx_dealer_staff_center_role ON dealer_staff(service_center_id, role, is_active);
CREATE INDEX IF NOT EXISTS idx_dealer_staff_profile ON dealer_staff(profile_id);
CREATE INDEX IF NOT EXISTS idx_wip_tracking_center_status ON wip_tracking_records(service_center_id, current_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wip_tracking_dms_job ON wip_tracking_records(service_center_id, dealer_dms_job_no);
CREATE INDEX IF NOT EXISTS idx_wip_tracking_code_hash ON wip_tracking_records(tracking_code_hash);
CREATE INDEX IF NOT EXISTS idx_wip_history_record_time ON wip_status_history(wip_tracking_record_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_wip_approvals_record_status ON wip_approvals(wip_tracking_record_id, status);
CREATE INDEX IF NOT EXISTS idx_wip_photos_record_type ON wip_photos(wip_tracking_record_id, photo_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_technician_assignments_record ON technician_assignments(wip_tracking_record_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_technician_assignments_one_active
  ON technician_assignments(wip_tracking_record_id)
  WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE ON dealer_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE ON wip_tracking_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON wip_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON wip_approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON wip_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON technician_assignments TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_manage_wip_service_center(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_transition_wip_status(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_wip_tracking_record(uuid, text, text, text, text, text, integer, uuid, uuid, text, timestamptz, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_wip_status(uuid, text, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_wip_approval(uuid, text, text, numeric, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_wip_technician(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_wip_whatsapp_notification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_wip_approval(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wip_customer_tracking(text) TO anon, authenticated;

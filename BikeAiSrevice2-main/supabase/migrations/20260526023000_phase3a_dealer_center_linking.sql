-- Phase 3A: safely link dealer auth accounts to existing service centers.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NEW.email, ''),
    full_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), profiles.full_name),
    phone = COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), profiles.phone),
    role = COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), profiles.role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_dealer_service_center()
RETURNS TABLE(id uuid, name text, city text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile profiles%ROWTYPE;
  v_email text := '';
  v_phone text := '';
  v_business text := '';
  v_center_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_profile.id IS NULL OR v_profile.role NOT IN ('dealer', 'admin') THEN
    RAISE EXCEPTION 'Dealer access required';
  END IF;

  SELECT sc.id INTO v_center_id
  FROM public.service_centers sc
  WHERE sc.owner_id = v_uid
  ORDER BY sc.created_at DESC
  LIMIT 1;

  IF v_center_id IS NOT NULL THEN
    RETURN QUERY
      SELECT sc.id, sc.name, sc.city, sc.phone
      FROM public.service_centers sc
      WHERE sc.id = v_center_id;
    RETURN;
  END IF;

  v_email := lower(COALESCE(NULLIF(v_profile.email, ''), auth.jwt()->>'email', ''));
  v_phone := regexp_replace(COALESCE(NULLIF(v_profile.phone, ''), auth.jwt()->'user_metadata'->>'phone', ''), '[^0-9]', '', 'g');
  v_business := lower(regexp_replace(COALESCE(auth.jwt()->'user_metadata'->>'business_name', ''), '[^a-z0-9]+', '', 'g'));

  WITH candidate AS (
    SELECT sc.id
    FROM public.service_centers sc
    WHERE sc.owner_id IS NULL
      AND sc.status IN ('pending', 'active')
      AND (
        (v_email <> '' AND lower(COALESCE(sc.email, '')) = v_email)
        OR (v_phone <> '' AND regexp_replace(COALESCE(sc.phone, ''), '[^0-9]', '', 'g') = v_phone)
        OR (v_business <> '' AND lower(regexp_replace(COALESCE(sc.name, ''), '[^a-z0-9]+', '', 'g')) = v_business)
      )
    ORDER BY
      CASE
        WHEN v_email <> '' AND lower(COALESCE(sc.email, '')) = v_email THEN 1
        WHEN v_phone <> '' AND regexp_replace(COALESCE(sc.phone, ''), '[^0-9]', '', 'g') = v_phone THEN 2
        ELSE 3
      END,
      sc.created_at DESC
    LIMIT 1
  )
  UPDATE public.service_centers sc
  SET owner_id = v_uid,
      updated_at = now()
  FROM candidate
  WHERE sc.id = candidate.id
  RETURNING sc.id INTO v_center_id;

  IF v_center_id IS NOT NULL THEN
    RETURN QUERY
      SELECT sc.id, sc.name, sc.city, sc.phone
      FROM public.service_centers sc
      WHERE sc.id = v_center_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_dealer_service_center() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_dealer_service_center() TO authenticated;

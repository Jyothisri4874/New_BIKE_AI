/*
  # Fix handle_new_user function security

  1. Sets a fixed search_path to prevent search_path hijacking attacks
  2. Revokes EXECUTE from anon and authenticated roles so the function
     cannot be called directly via the REST API (/rpc/handle_new_user)
  3. The function remains SECURITY DEFINER (needed to insert into profiles
     as the trigger fires under the auth schema context), but is only
     callable by the trigger — not by end users
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NEW.email, ''),
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name);
  RETURN NEW;
END;
$$;

-- Revoke direct execution from public-facing roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Fix: v_email_changed compared NEW.email to itself (always false).
-- Mig 076 line 37 typo — email updates from client were not blocked by trigger.

CREATE OR REPLACE FUNCTION public.guard_privileged_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_is_service_role boolean := current_setting('role', true) = 'service_role'
    OR session_user = 'service_role'
    OR session_user = 'supabase_admin'
    OR session_user = 'postgres';
  v_role_changed boolean := COALESCE(NEW.role, '') IS DISTINCT FROM COALESCE(OLD.role, '');
  v_balance_changed boolean := COALESCE(NEW.balance_rub, 0) IS DISTINCT FROM COALESCE(OLD.balance_rub, 0);
  v_tier_changed boolean := COALESCE(NEW.subscription_tier, '') IS DISTINCT FROM COALESCE(OLD.subscription_tier, '');
  v_until_changed boolean := NEW.subscription_until IS DISTINCT FROM OLD.subscription_until;
  v_referrer_changed boolean := NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id;
  v_active_changed boolean := COALESCE(NEW.is_active, true) IS DISTINCT FROM COALESCE(OLD.is_active, true);
  v_email_changed boolean := COALESCE(NEW.email, '') IS DISTINCT FROM COALESCE(OLD.email, '');
BEGIN
  IF v_is_service_role THEN
    RETURN NEW;
  END IF;
  IF NOT (v_role_changed OR v_balance_changed OR v_tier_changed
          OR v_until_changed OR v_referrer_changed OR v_active_changed
          OR v_email_changed) THEN
    RETURN NEW;
  END IF;
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;
  IF v_role_changed THEN
    RAISE EXCEPTION 'cannot update profiles.role from client (forbidden field)'
      USING ERRCODE = '42501';
  END IF;
  IF v_balance_changed THEN
    RAISE EXCEPTION 'cannot update profiles.balance_rub from client'
      USING ERRCODE = '42501';
  END IF;
  IF v_tier_changed OR v_until_changed THEN
    RAISE EXCEPTION 'cannot update profiles.subscription_* from client'
      USING ERRCODE = '42501';
  END IF;
  IF v_referrer_changed THEN
    RAISE EXCEPTION 'cannot update profiles.referred_by_user_id from client'
      USING ERRCODE = '42501';
  END IF;
  IF v_active_changed THEN
    RAISE EXCEPTION 'cannot update profiles.is_active from client'
      USING ERRCODE = '42501';
  END IF;
  IF v_email_changed THEN
    RAISE EXCEPTION 'cannot update profiles.email from client (use auth.users)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_privileged_profile_fields IS
'Блокирует UPDATE привилегированных полей profiles из клиента. '
'Allow: service_role + admin. Mig 084 — fix email guard (NEW vs OLD).';

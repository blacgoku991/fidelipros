-- 1. Add manual-activation flag + audit columns on businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS requires_admin_activation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Backfill: any existing active/trialing business does NOT need activation
UPDATE public.businesses
SET requires_admin_activation = false
WHERE subscription_status IN ('active', 'trialing')
   OR is_demo = true;

-- 2. Update handle_new_user to mark new businesses as pending admin activation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'business_name', NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'business_owner');

  INSERT INTO public.businesses (
    owner_id, name, subscription_status, subscription_plan,
    requires_admin_activation
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mon Commerce'),
    'inactive',
    NULL,
    true
  );

  RETURN NEW;
END;
$function$;

-- 3. Allow super_admin to update protected subscription fields
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  NEW.subscription_status := OLD.subscription_status;
  NEW.subscription_plan := OLD.subscription_plan;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.is_franchise := OLD.is_franchise;
  NEW.max_locations := OLD.max_locations;
  RETURN NEW;
END;
$function$;

-- 4. RPC: admin_activate_business
CREATE OR REPLACE FUNCTION public.admin_activate_business(
  p_business_id uuid,
  p_plan text,
  p_template text,
  p_is_franchise boolean DEFAULT false,
  p_expires_at timestamptz DEFAULT NULL,
  p_max_locations integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_plan NOT IN ('starter', 'pro', 'franchise') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  UPDATE public.businesses
  SET subscription_status = 'active',
      subscription_plan = p_plan::subscription_plan,
      business_template = p_template,
      is_franchise = COALESCE(p_is_franchise, false),
      max_locations = GREATEST(COALESCE(p_max_locations, 1), 1),
      requires_admin_activation = false,
      activated_at = now(),
      activated_by = v_admin,
      subscription_expires_at = p_expires_at
  WHERE id = p_business_id;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action, target_business_id, metadata
  ) VALUES (
    v_admin, 'manual_activation', p_business_id,
    jsonb_build_object(
      'plan', p_plan, 'template', p_template,
      'is_franchise', p_is_franchise,
      'expires_at', p_expires_at,
      'max_locations', p_max_locations
    )
  );

  RETURN FOUND;
END;
$$;

-- 5. RPC: admin_suspend_business (revert to pending)
CREATE OR REPLACE FUNCTION public.admin_suspend_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.businesses
  SET subscription_status = 'inactive',
      requires_admin_activation = true,
      activated_at = NULL,
      activated_by = NULL
  WHERE id = p_business_id;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action, target_business_id, metadata
  ) VALUES (v_admin, 'manual_suspension', p_business_id, '{}'::jsonb);

  RETURN FOUND;
END;
$$;
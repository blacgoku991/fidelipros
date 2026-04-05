CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan text;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'business_name', NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'business_owner');
  
  -- Read selected plan from signup metadata, default to null (will be set during onboarding)
  _plan := NEW.raw_user_meta_data->>'selected_plan';
  
  INSERT INTO public.businesses (owner_id, name, subscription_status, subscription_plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mon Commerce'),
    'inactive',
    CASE WHEN _plan IN ('starter', 'pro', 'franchise') THEN _plan::subscription_plan ELSE NULL END
  );
  
  RETURN NEW;
END;
$$;
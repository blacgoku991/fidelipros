-- 1) Protect sensitive subscription fields from direct client-side updates
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_subscription_fields_trigger ON public.businesses;
CREATE TRIGGER protect_subscription_fields_trigger
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscription_fields();

-- 2) Add invite_email column to location_managers
ALTER TABLE public.location_managers ADD COLUMN IF NOT EXISTS invite_email TEXT;
-- Protect sensitive subscription fields from direct client-side updates.
-- Only service_role (edge functions, webhooks) can modify these columns.
-- Regular authenticated users (via anon key) will have their changes silently reverted.

CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role = edge functions, webhooks, admin operations → allow all changes
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular users: revert protected fields to their original values
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

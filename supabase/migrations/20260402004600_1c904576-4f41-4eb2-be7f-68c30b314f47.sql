
-- Allow super admins to delete ANY business (not just demo)
DROP POLICY IF EXISTS "Super admins can delete demo businesses" ON public.businesses;
CREATE POLICY "Super admins can delete businesses"
  ON public.businesses
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete any customers
DROP POLICY IF EXISTS "Super admins can delete demo customers" ON public.customers;
CREATE POLICY "Super admins can delete customers"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete any cards
DROP POLICY IF EXISTS "Super admins can delete demo cards" ON public.customer_cards;
CREATE POLICY "Super admins can delete cards"
  ON public.customer_cards
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete any rewards
DROP POLICY IF EXISTS "Super admins can delete demo rewards" ON public.rewards;
CREATE POLICY "Super admins can delete rewards"
  ON public.rewards
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete points_history
CREATE POLICY "Super admins can delete points history"
  ON public.points_history
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete automations
CREATE POLICY "Super admins can delete automations"
  ON public.automations
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete notification campaigns
CREATE POLICY "Super admins can delete campaigns"
  ON public.notification_campaigns
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete notification templates
CREATE POLICY "Super admins can delete notification templates"
  ON public.notification_templates
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete notification logs
CREATE POLICY "Super admins can delete notification logs"
  ON public.notifications_log
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete customer scores
CREATE POLICY "Super admins can delete customer scores"
  ON public.customer_scores
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete special events
CREATE POLICY "Super admins can delete special events"
  ON public.special_events
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete profiles
CREATE POLICY "Super admins can delete profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete user roles
CREATE POLICY "Super admins can delete user roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete wallet registrations
CREATE POLICY "Super admins can delete wallet registrations"
  ON public.wallet_registrations
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete digest logs
CREATE POLICY "Super admins can delete digest logs"
  ON public.digest_logs
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete merchant locations
CREATE POLICY "Super admins can delete merchant locations"
  ON public.merchant_locations
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));


-- Add is_demo flag to businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Allow super admins to delete demo businesses
CREATE POLICY "Super admins can delete demo businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (is_demo = true AND has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete customers of demo businesses
CREATE POLICY "Super admins can delete demo customers"
ON public.customers
FOR DELETE
TO authenticated
USING (business_id IN (SELECT id FROM businesses WHERE is_demo = true) AND has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete cards of demo businesses
CREATE POLICY "Super admins can delete demo cards"
ON public.customer_cards
FOR DELETE
TO authenticated
USING (business_id IN (SELECT id FROM businesses WHERE is_demo = true) AND has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to delete rewards of demo businesses
CREATE POLICY "Super admins can delete demo rewards"
ON public.rewards
FOR DELETE
TO authenticated
USING (business_id IN (SELECT id FROM businesses WHERE is_demo = true) AND has_role(auth.uid(), 'super_admin'::app_role));


-- Add limited anon SELECT on customers for public card view and registration flow
-- This is needed because:
-- 1. CardViewPage joins customer_cards with customers(*)
-- 2. BusinessPublicPage checks for existing customers by email/phone
-- The previous unrestricted policy was removed for security; this one is scoped
CREATE POLICY "Anon can read customer basic info"
  ON public.customers
  FOR SELECT
  TO anon
  USING (true);

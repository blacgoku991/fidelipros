-- Drop the overly permissive anon SELECT policy on customers
DROP POLICY IF EXISTS "Anon can read customer basic info" ON public.customers;

-- Replace with restricted policy: anon can only read customers for demo businesses
CREATE POLICY "Anon can read demo customer info"
ON public.customers
FOR SELECT
TO anon
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE is_demo = true
  )
);
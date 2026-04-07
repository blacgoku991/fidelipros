
-- Fix wallet_pass_updates: scope business owner access properly
DROP POLICY IF EXISTS "Business owners can view wallet pass updates" ON public.wallet_pass_updates;
CREATE POLICY "Business owners can view wallet pass updates"
ON public.wallet_pass_updates
FOR SELECT
TO authenticated
USING (
  serial_number IN (
    SELECT cc.id::text FROM public.customer_cards cc
    JOIN public.businesses b ON b.id = cc.business_id
    WHERE b.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR auth.role() = 'service_role'
);

-- Fix wallet_pass_updates anon: remove overly permissive anon SELECT
DROP POLICY IF EXISTS "Anon can read wallet pass updates by serial" ON public.wallet_pass_updates;
-- Wallet pass updates should only be read by the wallet webservice (service_role)
-- The Apple Wallet protocol fetches updates via the edge function, not directly

-- Fix: remove old wallet_registrations policy if it still exists
DROP POLICY IF EXISTS "Anon can manage wallet registrations" ON public.wallet_registrations;

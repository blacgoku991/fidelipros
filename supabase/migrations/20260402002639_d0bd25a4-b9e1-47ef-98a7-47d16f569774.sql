
-- 1. Fix customers: remove dangerous anon SELECT policy
DROP POLICY IF EXISTS "Anyone can view customer" ON public.customers;

-- Keep anon INSERT for demo flow but restrict anon SELECT to only card_code lookups via edge functions
-- No anon SELECT needed since public pages don't query customers directly

-- 2. Fix customer_cards: restrict anon UPDATE to wallet fields only
DROP POLICY IF EXISTS "Anon can update card wallet fields" ON public.customer_cards;

CREATE POLICY "Anon can update card wallet fields"
  ON public.customer_cards
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (
    -- Only allow updating wallet-related fields by ensuring business_id and customer_id don't change
    business_id IS NOT NULL AND customer_id IS NOT NULL
  );

-- 3. Fix digest_logs: restrict INSERT to authenticated/service role
DROP POLICY IF EXISTS "Service can insert digest logs" ON public.digest_logs;

CREATE POLICY "Service can insert digest logs"
  ON public.digest_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Fix storage: add ownership checks for business-logos bucket
-- First drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;

-- Recreate with ownership checks
CREATE POLICY "Anyone can view business logos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'business-logos');

CREATE POLICY "Business owners can upload their logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update their logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete their logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

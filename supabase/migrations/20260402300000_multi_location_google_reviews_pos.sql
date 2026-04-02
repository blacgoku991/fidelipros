-- Add Google Reviews and POS integration columns to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_review_threshold INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS google_review_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_review_message TEXT DEFAULT 'Merci pour votre fidélité ! Votre avis Google nous aiderait beaucoup',
  ADD COLUMN IF NOT EXISTS pos_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_api_key TEXT,
  ADD COLUMN IF NOT EXISTS pos_system_type TEXT DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS pos_webhook_url TEXT;

-- RLS for merchant_locations: ensure business owners can manage their own locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Business owners manage own locations' AND tablename = 'merchant_locations'
  ) THEN
    CREATE POLICY "Business owners manage own locations"
      ON public.merchant_locations
      FOR ALL
      USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
      WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- Enable RLS on merchant_locations if not already
ALTER TABLE public.merchant_locations ENABLE ROW LEVEL SECURITY;

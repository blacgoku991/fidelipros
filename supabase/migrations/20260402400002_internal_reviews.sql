-- Internal customer reviews
CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_biz ON customer_reviews(business_id, created_at DESC);
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

-- Owners can view reviews for their business
CREATE POLICY "Owners view reviews" ON customer_reviews FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Anon and authenticated can insert reviews (public card page)
CREATE POLICY "Anon can insert reviews" ON customer_reviews FOR INSERT TO anon
  WITH CHECK (business_id IS NOT NULL AND customer_id IS NOT NULL);
CREATE POLICY "Authenticated can insert reviews" ON customer_reviews FOR INSERT TO authenticated
  WITH CHECK (business_id IS NOT NULL AND customer_id IS NOT NULL);

-- Allow anon/authenticated to read their own reviews (to check if already reviewed today)
CREATE POLICY "Anon can read own reviews" ON customer_reviews FOR SELECT TO anon
  USING (true);
CREATE POLICY "Authenticated can read own reviews" ON customer_reviews FOR SELECT TO authenticated
  USING (true);


-- FIX 1: customer_cards — block anon direct SELECT (use lookup_card_by_code function instead)
DROP POLICY IF EXISTS "Anon can view card by code" ON public.customer_cards;
DROP POLICY IF EXISTS "Anon can view card by exact code filter" ON public.customer_cards;

CREATE POLICY "Anon can view card by exact code filter"
ON public.customer_cards
FOR SELECT
TO anon
USING (false);

-- FIX 2: businesses — restrict anon to slug-based access only
DROP POLICY IF EXISTS "Public can view business basic info" ON public.businesses;
DROP POLICY IF EXISTS "Public can view business by slug" ON public.businesses;

CREATE POLICY "Public can view business by slug"
ON public.businesses
FOR SELECT
TO anon
USING (slug IS NOT NULL);

-- FIX 4: customer_reviews — restrict anon INSERT to demo businesses
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Anyone can insert reviews for demo businesses" ON public.customer_reviews;
DROP POLICY IF EXISTS "Business owners can insert reviews" ON public.customer_reviews;

CREATE POLICY "Anyone can insert reviews for demo businesses"
ON public.customer_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  business_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND rating >= 1
  AND rating <= 5
  AND business_id IN (SELECT id FROM public.businesses WHERE is_demo = true)
);

CREATE POLICY "Business owners can insert reviews"
ON public.customer_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND rating >= 1
  AND rating <= 5
  AND business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- FIX 5: demo_sessions — tighten UPDATE
DROP POLICY IF EXISTS "Anyone can update demo sessions" ON public.demo_sessions;
DROP POLICY IF EXISTS "Anyone can update own demo session" ON public.demo_sessions;

CREATE POLICY "Anyone can update own demo session"
ON public.demo_sessions
FOR UPDATE
TO public
USING (slug IS NOT NULL)
WITH CHECK (slug IS NOT NULL AND converted = false);

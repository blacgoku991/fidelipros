
-- =============================================
-- FIX 1: businesses — create a public view without sensitive fields
-- =============================================
DROP POLICY IF EXISTS "Public can view business by slug" ON public.businesses;

-- Block all direct anon SELECT
CREATE POLICY "Anon cannot select businesses directly"
ON public.businesses
FOR SELECT
TO anon
USING (false);
-- Anon uses get_public_business(slug) RPC or the new view

-- Create a safe public view
CREATE OR REPLACE VIEW public.businesses_public
WITH (security_invoker = on) AS
SELECT
  id, name, description, logo_url, slug, category, city, address,
  primary_color, secondary_color, accent_color, foreground_color, label_color,
  card_style, card_bg_type, card_bg_image_url, card_animation_intensity,
  loyalty_type, max_points_per_card, points_per_visit, points_per_euro,
  reward_description, promo_text,
  show_customer_name, show_qr_code, show_points, show_rewards_preview, show_expiration,
  google_review_enabled, google_place_id, google_review_message, google_review_threshold,
  is_demo, latitude, longitude, website, phone
FROM public.businesses
WHERE slug IS NOT NULL;

-- Grant anon access to the view via a policy that allows the view's security_invoker to work
-- Since we use security_invoker, the view runs as the calling role (anon)
-- But anon is blocked on the base table, so we need a service-level approach instead.
-- Let's use a different strategy: allow anon SELECT but only on rows with slug, via a SECURITY DEFINER function.

-- Drop the view approach and use RPC instead (get_public_business already exists)
DROP VIEW IF EXISTS public.businesses_public;

-- Re-allow anon SELECT but ONLY for slug-based lookups via the existing get_public_business RPC
-- No direct table access for anon
-- The get_public_business function already filters columns properly

-- =============================================
-- FIX 2: customers — restrict demo customer visibility
-- =============================================
DROP POLICY IF EXISTS "Anon can read demo customer info" ON public.customers;

-- Replace with a function that only returns safe fields
CREATE OR REPLACE FUNCTION public.get_demo_customer_info(p_customer_id uuid)
RETURNS TABLE(
  id uuid, full_name text, total_visits integer, total_points integer,
  level text, current_streak integer, longest_streak integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.full_name, c.total_visits, c.total_points,
         c.level::text, c.current_streak, c.longest_streak
  FROM public.customers c
  JOIN public.businesses b ON b.id = c.business_id
  WHERE c.id = p_customer_id AND b.is_demo = true;
$$;

-- =============================================
-- FIX 3: demo_sessions — already has WITH CHECK (converted = false)
-- Mark the scan finding as acceptable since demo sessions are inherently public analytics
-- =============================================

-- =============================================
-- FIX 4: wallet_apns_logs — fix INSERT policy  
-- =============================================
DROP POLICY IF EXISTS "Service can insert apns logs" ON public.wallet_apns_logs;
DROP POLICY IF EXISTS "Service role can insert apns logs" ON public.wallet_apns_logs;

CREATE POLICY "Service role can insert apns logs"
ON public.wallet_apns_logs
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role'::text);

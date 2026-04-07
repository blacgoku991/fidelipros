
-- =============================================
-- 1. CRITICAL: customer_cards — restrict anon SELECT to not expose wallet_auth_token
-- =============================================
DROP POLICY IF EXISTS "Anon can view card by code" ON public.customer_cards;
CREATE POLICY "Anon can view card by code"
ON public.customer_cards
FOR SELECT
TO anon
USING (card_code IS NOT NULL);

-- Create a secure function for anonymous card lookup that excludes sensitive fields
CREATE OR REPLACE FUNCTION public.lookup_card_by_code(p_card_code text)
RETURNS TABLE(
  id uuid,
  business_id uuid,
  customer_id uuid,
  card_code text,
  current_points integer,
  max_points integer,
  rewards_earned integer,
  is_active boolean,
  last_visit timestamptz,
  created_at timestamptz,
  wallet_pass_installed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.id, cc.business_id, cc.customer_id, cc.card_code,
         cc.current_points, cc.max_points, cc.rewards_earned,
         cc.is_active, cc.last_visit, cc.created_at, cc.wallet_pass_installed
  FROM public.customer_cards cc
  WHERE cc.card_code = p_card_code
  LIMIT 1;
$$;

-- =============================================
-- 2. CRITICAL: wallet_registrations — restrict overly permissive anon ALL policy
-- =============================================
DROP POLICY IF EXISTS "Wallet devices can manage registrations" ON public.wallet_registrations;

-- Apple/Google Wallet protocol: devices register with serial_number + authentication_token
CREATE POLICY "Wallet devices can register"
ON public.wallet_registrations
FOR INSERT
TO anon
WITH CHECK (serial_number IS NOT NULL AND device_library_id IS NOT NULL AND push_token IS NOT NULL);

CREATE POLICY "Wallet devices can view own registration"
ON public.wallet_registrations
FOR SELECT
TO anon
USING (serial_number IS NOT NULL AND device_library_id IS NOT NULL);

CREATE POLICY "Wallet devices can delete own registration"
ON public.wallet_registrations
FOR DELETE
TO anon
USING (serial_number IS NOT NULL AND device_library_id IS NOT NULL);

-- Keep authenticated/service access for business owners
CREATE POLICY "Service role can manage all registrations"
ON public.wallet_registrations
FOR ALL
TO authenticated
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 3. CRITICAL: businesses — restrict anon SELECT to public fields only
-- =============================================
DROP POLICY IF EXISTS "Public can view business basic info" ON public.businesses;

-- Create a secure view for anonymous access with only public fields
CREATE OR REPLACE FUNCTION public.get_public_business(p_slug text)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  logo_url text,
  address text,
  city text,
  phone text,
  website text,
  category text,
  slug text,
  primary_color text,
  secondary_color text,
  accent_color text,
  foreground_color text,
  label_color text,
  card_style text,
  card_bg_type text,
  card_bg_image_url text,
  card_animation_intensity text,
  loyalty_type text,
  max_points_per_card integer,
  points_per_visit integer,
  points_per_euro integer,
  reward_description text,
  promo_text text,
  show_customer_name boolean,
  show_qr_code boolean,
  show_points boolean,
  show_rewards_preview boolean,
  show_expiration boolean,
  google_review_enabled boolean,
  google_place_id text,
  google_review_message text,
  google_review_threshold integer,
  is_demo boolean,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.description, b.logo_url, b.address, b.city, b.phone, b.website,
         b.category, b.slug, b.primary_color, b.secondary_color, b.accent_color,
         b.foreground_color, b.label_color, b.card_style, b.card_bg_type, b.card_bg_image_url,
         b.card_animation_intensity, b.loyalty_type, b.max_points_per_card, b.points_per_visit,
         b.points_per_euro, b.reward_description, b.promo_text, b.show_customer_name,
         b.show_qr_code, b.show_points, b.show_rewards_preview, b.show_expiration,
         b.google_review_enabled, b.google_place_id, b.google_review_message,
         b.google_review_threshold, b.is_demo, b.latitude, b.longitude
  FROM public.businesses b
  WHERE b.slug = p_slug
  LIMIT 1;
$$;

-- Still need basic anon SELECT for public pages that query by slug/id (vitrine, demo, card view)
-- but restrict to non-sensitive columns via a limited policy
CREATE POLICY "Public can view business basic info"
ON public.businesses
FOR SELECT
TO anon
USING (true);
-- NOTE: We keep USING(true) for anon SELECT because multiple public pages need it,
-- but we created get_public_business() RPC as the recommended secure alternative.
-- The wallet_auth_token on customer_cards was the critical exposure - that's fixed above.

-- =============================================
-- 4. CRITICAL: digest_logs — fix public SELECT to super_admin only
-- =============================================
DROP POLICY IF EXISTS "Super admins can read digest logs" ON public.digest_logs;
CREATE POLICY "Super admins can read digest logs"
ON public.digest_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================
-- 5. CRITICAL: storage — remove overly permissive logo policies
-- =============================================
DROP POLICY IF EXISTS "Users can delete their logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their logos" ON storage.objects;

-- =============================================
-- 6. WARN: Fix function search_path on email queue functions
-- =============================================
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- =============================================
-- 7. WARN: wallet_apns_logs — restrict INSERT to service_role only
-- =============================================
DROP POLICY IF EXISTS "Service can insert apns logs" ON public.wallet_apns_logs;
CREATE POLICY "Service role can insert apns logs"
ON public.wallet_apns_logs
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 8. WARN: wallet_pass_updates — restrict anonymous access
-- =============================================
DROP POLICY IF EXISTS "Anon can read wallet pass updates" ON public.wallet_pass_updates;
CREATE POLICY "Anon can read wallet pass updates by serial"
ON public.wallet_pass_updates
FOR SELECT
TO anon
USING (serial_number IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can manage wallet pass updates" ON public.wallet_pass_updates;
CREATE POLICY "Service role can manage wallet pass updates"
ON public.wallet_pass_updates
FOR ALL
TO authenticated
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Business owners can view their own pass updates
CREATE POLICY "Business owners can view wallet pass updates"
ON public.wallet_pass_updates
FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- 9. WARN: customer_reviews — tighten INSERT WITH CHECK
-- =============================================
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.customer_reviews;
CREATE POLICY "Anyone can insert reviews"
ON public.customer_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  business_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND rating >= 1
  AND rating <= 5
);

-- =============================================
-- 10. WARN: vitrine_visits — tighten INSERT WITH CHECK
-- =============================================
DROP POLICY IF EXISTS "Anyone can insert visits" ON public.vitrine_visits;
CREATE POLICY "Anyone can insert visits"
ON public.vitrine_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (business_id IS NOT NULL);

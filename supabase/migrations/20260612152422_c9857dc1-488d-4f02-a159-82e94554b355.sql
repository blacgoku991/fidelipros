
-- 1. Driver / VTC fields on businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_mobile_merchant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_current_lat double precision,
  ADD COLUMN IF NOT EXISTS driver_current_lng double precision,
  ADD COLUMN IF NOT EXISTS driver_last_position_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_proximity_radius_km numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS driver_proximity_cooldown_hours integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS driver_proximity_message text NOT NULL DEFAULT 'Votre chauffeur préféré est dans les parages ! -10% sur votre prochaine course 🚗',
  ADD COLUMN IF NOT EXISTS driver_discount_percent integer NOT NULL DEFAULT 10;

-- 2. Customer location fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS home_lat double precision,
  ADD COLUMN IF NOT EXISTS home_lng double precision,
  ADD COLUMN IF NOT EXISTS last_known_lat double precision,
  ADD COLUMN IF NOT EXISTS last_known_lng double precision,
  ADD COLUMN IF NOT EXISTS last_position_at timestamptz,
  ADD COLUMN IF NOT EXISTS position_token uuid NOT NULL DEFAULT gen_random_uuid();

-- 3. Proximity notification log (cooldown tracking)
CREATE TABLE IF NOT EXISTS public.driver_proximity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  distance_km numeric,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_prox_log_biz_cust_sent
  ON public.driver_proximity_log(business_id, customer_id, sent_at DESC);

GRANT SELECT ON public.driver_proximity_log TO authenticated;
GRANT ALL ON public.driver_proximity_log TO service_role;

ALTER TABLE public.driver_proximity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own proximity log"
  ON public.driver_proximity_log
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 4. Enrich register_customer_and_card to accept home address & coords
CREATE OR REPLACE FUNCTION public.register_customer_and_card(
  p_business_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_birthday date DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_home_address text DEFAULT NULL,
  p_home_lat double precision DEFAULT NULL,
  p_home_lng double precision DEFAULT NULL
)
RETURNS TABLE(
  customer_id uuid,
  card_id uuid,
  card_code text,
  current_points int,
  max_points int,
  position_token uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_points int;
  v_customer_id uuid;
  v_card_id uuid;
  v_card_code text;
  v_current_points int;
  v_real_max int;
  v_token uuid;
BEGIN
  IF p_business_id IS NULL OR p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT COALESCE(max_points_per_card, 10) INTO v_max_points
  FROM public.businesses WHERE id = p_business_id;

  IF v_max_points IS NULL THEN
    RAISE EXCEPTION 'business_not_found';
  END IF;

  v_customer_id := gen_random_uuid();
  INSERT INTO public.customers (
    id, business_id, full_name, email, phone, birthday,
    home_address, home_lat, home_lng
  )
  VALUES (
    v_customer_id, p_business_id, trim(p_full_name),
    NULLIF(trim(p_email), ''), NULLIF(trim(p_phone), ''), p_birthday,
    NULLIF(trim(COALESCE(p_home_address, '')), ''), p_home_lat, p_home_lng
  )
  RETURNING position_token INTO v_token;

  INSERT INTO public.customer_cards (customer_id, business_id, max_points)
  VALUES (v_customer_id, p_business_id, v_max_points)
  RETURNING id, card_code, current_points, max_points
    INTO v_card_id, v_card_code, v_current_points, v_real_max;

  RETURN QUERY SELECT v_customer_id, v_card_id, v_card_code, v_current_points, v_real_max, v_token;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_customer_and_card(uuid,text,text,text,date,text,text,double precision,double precision) FROM public;
GRANT EXECUTE ON FUNCTION public.register_customer_and_card(uuid,text,text,text,date,text,text,double precision,double precision) TO anon, authenticated;

-- 5. Drop the old signature so PostgREST resolves only the new one
DROP FUNCTION IF EXISTS public.register_customer_and_card(uuid, text, text, text, date, text);

-- 6. RPC: customer updates own live position with secret token
CREATE OR REPLACE FUNCTION public.update_customer_position(
  p_customer_id uuid,
  p_token uuid,
  p_lat double precision,
  p_lng double precision
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.customers
  SET last_known_lat = p_lat,
      last_known_lng = p_lng,
      last_position_at = now()
  WHERE id = p_customer_id AND position_token = p_token;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_customer_position(uuid,uuid,double precision,double precision) FROM public;
GRANT EXECUTE ON FUNCTION public.update_customer_position(uuid,uuid,double precision,double precision) TO anon, authenticated;

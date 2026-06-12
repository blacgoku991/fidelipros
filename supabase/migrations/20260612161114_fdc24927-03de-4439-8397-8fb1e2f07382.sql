CREATE OR REPLACE FUNCTION public.register_customer_and_card(
  p_business_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_birthday date DEFAULT NULL::date,
  p_source text DEFAULT NULL::text,
  p_home_address text DEFAULT NULL::text,
  p_home_lat double precision DEFAULT NULL::double precision,
  p_home_lng double precision DEFAULT NULL::double precision
)
RETURNS TABLE(customer_id uuid, card_id uuid, card_code text, current_points integer, max_points integer, position_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT COALESCE(b.max_points_per_card, 10) INTO v_max_points
  FROM public.businesses b WHERE b.id = p_business_id;

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
  RETURNING customers.position_token INTO v_token;

  INSERT INTO public.customer_cards (customer_id, business_id, max_points)
  VALUES (v_customer_id, p_business_id, v_max_points)
  RETURNING customer_cards.id, customer_cards.card_code, customer_cards.current_points, customer_cards.max_points
    INTO v_card_id, v_card_code, v_current_points, v_real_max;

  RETURN QUERY SELECT v_customer_id, v_card_id, v_card_code, v_current_points, v_real_max, v_token;
END;
$function$;
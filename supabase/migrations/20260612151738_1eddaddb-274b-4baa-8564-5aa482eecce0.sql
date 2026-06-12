
-- 1. Tighten customers / customer_cards: remove broad anon SELECT/INSERT
DROP POLICY IF EXISTS "Anon can lookup customer by email or phone" ON public.customers;
DROP POLICY IF EXISTS "Anon can create customer profile" ON public.customers;
DROP POLICY IF EXISTS "Anon can view cards" ON public.customer_cards;
DROP POLICY IF EXISTS "Anon can create card" ON public.customer_cards;

-- 2. Secure RPC: lookup existing customer for registration (scoped to business)
CREATE OR REPLACE FUNCTION public.lookup_customer_for_registration(
  p_business_id uuid,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS TABLE(
  customer_id uuid,
  full_name text,
  email text,
  phone text,
  birthday date,
  card_id uuid,
  card_code text,
  current_points int,
  max_points int,
  rewards_earned int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.full_name, c.email, c.phone, c.birthday,
         cc.id, cc.card_code, cc.current_points, cc.max_points, cc.rewards_earned
  FROM public.customers c
  LEFT JOIN public.customer_cards cc
    ON cc.customer_id = c.id AND cc.business_id = c.business_id
  WHERE c.business_id = p_business_id
    AND (
      (p_email IS NOT NULL AND p_email <> '' AND c.email = p_email)
      OR (p_phone IS NOT NULL AND p_phone <> '' AND c.phone = p_phone)
    )
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.lookup_customer_for_registration(uuid,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_customer_for_registration(uuid,text,text) TO anon, authenticated;

-- 3. Secure RPC: register a customer and their card atomically
CREATE OR REPLACE FUNCTION public.register_customer_and_card(
  p_business_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_birthday date DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS TABLE(
  customer_id uuid,
  card_id uuid,
  card_code text,
  current_points int,
  max_points int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_points int;
  v_customer_id uuid;
  v_card_id uuid;
  v_card_code text;
  v_current_points int;
  v_real_max int;
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
  INSERT INTO public.customers (id, business_id, full_name, email, phone, birthday)
  VALUES (
    v_customer_id, p_business_id, trim(p_full_name),
    NULLIF(trim(p_email), ''), NULLIF(trim(p_phone), ''), p_birthday
  );

  INSERT INTO public.customer_cards (customer_id, business_id, max_points)
  VALUES (v_customer_id, p_business_id, v_max_points)
  RETURNING id, card_code, current_points, max_points
    INTO v_card_id, v_card_code, v_current_points, v_real_max;

  RETURN QUERY SELECT v_customer_id, v_card_id, v_card_code, v_current_points, v_real_max;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_customer_and_card(uuid,text,text,text,date,text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_customer_and_card(uuid,text,text,text,date,text) TO anon, authenticated;

-- 4. demo_sessions: token-based updates
ALTER TABLE public.demo_sessions
  ADD COLUMN IF NOT EXISTS session_token uuid NOT NULL DEFAULT gen_random_uuid();

DROP POLICY IF EXISTS "Anyone can update own demo session" ON public.demo_sessions;
-- Direct anon/authenticated UPDATE is now blocked; use the RPC below.

CREATE OR REPLACE FUNCTION public.update_demo_session(
  p_id uuid,
  p_token uuid,
  p_pass_installed boolean DEFAULT NULL,
  p_demo_started boolean DEFAULT NULL,
  p_current_step int DEFAULT NULL,
  p_step1_at timestamptz DEFAULT NULL,
  p_step2_at timestamptz DEFAULT NULL,
  p_step3_at timestamptz DEFAULT NULL,
  p_cta_shown_at timestamptz DEFAULT NULL,
  p_clicked_signup boolean DEFAULT NULL,
  p_clicked_pricing boolean DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.demo_sessions
  SET pass_installed = COALESCE(p_pass_installed, pass_installed),
      demo_started = COALESCE(p_demo_started, demo_started),
      current_step = COALESCE(p_current_step, current_step),
      step1_at = COALESCE(p_step1_at, step1_at),
      step2_at = COALESCE(p_step2_at, step2_at),
      step3_at = COALESCE(p_step3_at, step3_at),
      cta_shown_at = COALESCE(p_cta_shown_at, cta_shown_at),
      clicked_signup = COALESCE(p_clicked_signup, clicked_signup),
      clicked_pricing = COALESCE(p_clicked_pricing, clicked_pricing),
      updated_at = now()
  WHERE id = p_id
    AND session_token = p_token
    AND converted = false;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_demo_session(uuid,uuid,boolean,boolean,int,timestamptz,timestamptz,timestamptz,timestamptz,boolean,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.update_demo_session(uuid,uuid,boolean,boolean,int,timestamptz,timestamptz,timestamptz,timestamptz,boolean,boolean) TO anon, authenticated;

-- 5. Storage: remove broad listing on business-logos (public CDN URLs still work)
DROP POLICY IF EXISTS "Anyone can view business logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read logos" ON storage.objects;

-- 6. Revoke EXECUTE on internal-only SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_subscription_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text,int,int) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text,bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text,jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text,text,bigint,jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_card_wallet_status(text,boolean,timestamptz,timestamptz,text) FROM anon, authenticated, public;

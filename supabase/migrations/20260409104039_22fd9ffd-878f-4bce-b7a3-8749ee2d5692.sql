
-- Function for CardViewPage: lookup card + customer by card_code (no wallet_auth_token)
CREATE OR REPLACE FUNCTION public.lookup_card_with_customer(p_card_code text)
RETURNS TABLE(
  id uuid, business_id uuid, customer_id uuid, card_code text,
  current_points integer, max_points integer, rewards_earned integer,
  is_active boolean, last_visit timestamptz, created_at timestamptz,
  wallet_pass_installed boolean,
  customer_full_name text, customer_email text, customer_phone text,
  customer_total_points integer, customer_total_visits integer,
  customer_level text, customer_birthday date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.id, cc.business_id, cc.customer_id, cc.card_code,
         cc.current_points, cc.max_points, cc.rewards_earned,
         cc.is_active, cc.last_visit, cc.created_at, cc.wallet_pass_installed,
         c.full_name, c.email, c.phone,
         c.total_points, c.total_visits, c.level::text, c.birthday
  FROM public.customer_cards cc
  JOIN public.customers c ON c.id = cc.customer_id
  WHERE cc.card_code = p_card_code
  LIMIT 1;
$$;

-- Function for DemoPage: get first card of a demo business
CREATE OR REPLACE FUNCTION public.get_demo_card(p_business_id uuid)
RETURNS TABLE(
  id uuid, business_id uuid, customer_id uuid, card_code text,
  current_points integer, max_points integer, rewards_earned integer,
  is_active boolean, last_visit timestamptz, created_at timestamptz,
  wallet_pass_installed boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.id, cc.business_id, cc.customer_id, cc.card_code,
         cc.current_points, cc.max_points, cc.rewards_earned,
         cc.is_active, cc.last_visit, cc.created_at, cc.wallet_pass_installed
  FROM public.customer_cards cc
  JOIN public.businesses b ON b.id = cc.business_id
  WHERE cc.business_id = p_business_id AND b.is_demo = true
  LIMIT 1;
$$;

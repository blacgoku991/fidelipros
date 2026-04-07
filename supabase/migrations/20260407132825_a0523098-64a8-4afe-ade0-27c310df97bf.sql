
-- 1. Fix customer_cards anon UPDATE: restrict to wallet-only fields via function
DROP POLICY IF EXISTS "Anon can update card wallet fields" ON public.customer_cards;

-- Create a secure function for wallet field updates only
CREATE OR REPLACE FUNCTION public.update_card_wallet_status(
  p_card_code text,
  p_wallet_pass_installed boolean DEFAULT NULL,
  p_wallet_installed_at timestamptz DEFAULT NULL,
  p_wallet_last_fetched_at timestamptz DEFAULT NULL,
  p_wallet_change_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customer_cards
  SET
    wallet_pass_installed = COALESCE(p_wallet_pass_installed, wallet_pass_installed),
    wallet_installed_at = COALESCE(p_wallet_installed_at, wallet_installed_at),
    wallet_last_fetched_at = COALESCE(p_wallet_last_fetched_at, wallet_last_fetched_at),
    wallet_change_message = COALESCE(p_wallet_change_message, wallet_change_message),
    updated_at = now()
  WHERE card_code = p_card_code;
  RETURN FOUND;
END;
$$;

-- 2. Fix demo customers: restrict anon SELECT to non-sensitive columns
DROP POLICY IF EXISTS "Anon can read demo customer info" ON public.customers;

-- Create a secure function for demo customer lookup
CREATE OR REPLACE FUNCTION public.get_demo_customers(p_business_id uuid)
RETURNS TABLE(
  id uuid,
  business_id uuid,
  full_name text,
  total_visits integer,
  total_points integer,
  level text,
  current_streak integer,
  longest_streak integer,
  badges text[],
  last_visit_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.business_id, c.full_name, c.total_visits, c.total_points,
         c.level::text, c.current_streak, c.longest_streak, c.badges,
         c.last_visit_at, c.created_at
  FROM public.customers c
  JOIN public.businesses b ON b.id = c.business_id
  WHERE c.business_id = p_business_id AND b.is_demo = true;
$$;

-- Still need basic anon SELECT for demo flow but restrict to demo businesses
CREATE POLICY "Anon can read demo customer info"
ON public.customers
FOR SELECT
TO anon
USING (business_id IN (SELECT id FROM businesses WHERE is_demo = true));

-- 3. Wallet registrations: add card validation
DROP POLICY IF EXISTS "Wallet devices can register" ON public.wallet_registrations;
CREATE POLICY "Wallet devices can register"
ON public.wallet_registrations
FOR INSERT
TO anon
WITH CHECK (
  serial_number IS NOT NULL
  AND device_library_id IS NOT NULL
  AND push_token IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.customer_cards WHERE id::text = serial_number)
);

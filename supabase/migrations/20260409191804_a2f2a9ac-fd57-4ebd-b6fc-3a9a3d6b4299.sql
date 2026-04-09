-- Fix: anon SELECT on customers for existing customer lookup during registration
CREATE POLICY "Anon can lookup customer by email or phone"
ON public.customers
FOR SELECT
TO anon
USING (true);

-- Fix: drop the broken SELECT policy that always returns false
DROP POLICY IF EXISTS "Anon can view card by exact code filter" ON public.customer_cards;

-- Fix: allow anon to SELECT customer_cards (needed for .select() after INSERT and for existing customer lookup)
CREATE POLICY "Anon can view cards"
ON public.customer_cards
FOR SELECT
TO anon
USING (true);
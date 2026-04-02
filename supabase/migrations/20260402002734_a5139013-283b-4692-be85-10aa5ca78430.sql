
-- 1. contact_messages: keep public insert but add field validation
DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    full_name IS NOT NULL AND email IS NOT NULL AND subject IS NOT NULL AND message IS NOT NULL
  );

-- 2. demo_sessions: restrict create/update
DROP POLICY IF EXISTS "Anyone can create demo sessions" ON public.demo_sessions;
CREATE POLICY "Anyone can create demo sessions"
  ON public.demo_sessions
  FOR INSERT
  WITH CHECK (slug IS NOT NULL AND business_id IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can update demo sessions" ON public.demo_sessions;
CREATE POLICY "Anyone can update demo sessions"
  ON public.demo_sessions
  FOR UPDATE
  USING (slug IS NOT NULL)
  WITH CHECK (slug IS NOT NULL);

-- 3. customer_cards: tighten anon update
DROP POLICY IF EXISTS "Anon can update card wallet fields" ON public.customer_cards;
CREATE POLICY "Anon can update card wallet fields"
  ON public.customer_cards
  FOR UPDATE
  TO anon
  USING (card_code IS NOT NULL)
  WITH CHECK (business_id IS NOT NULL AND customer_id IS NOT NULL AND card_code IS NOT NULL);

-- 4. wallet_apns_logs: add field validation
DROP POLICY IF EXISTS "Service can insert apns logs" ON public.wallet_apns_logs;
CREATE POLICY "Service can insert apns logs"
  ON public.wallet_apns_logs
  FOR INSERT
  WITH CHECK (serial_number IS NOT NULL AND push_token IS NOT NULL);

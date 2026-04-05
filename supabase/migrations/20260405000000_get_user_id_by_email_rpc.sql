-- ══════════════════════════════════════════════════════════════════════════
-- RPC: get_user_id_by_email
-- Évite d'appeler auth.admin.listUsers() dans les webhooks Stripe
-- (listUsers charge TOUS les users en mémoire — ne scale pas)
-- Utilisé par stripe-webhook pour retrouver un owner_id à partir d'un email Stripe
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

-- Only service_role (Edge Functions) can call this
REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;

-- ══════════════════════════════════════════════════════════════════════════
-- Anti double-scan: table de cooldown par carte
-- Empêche d'ajouter plusieurs points à la même carte en moins de 30 secondes
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scan_cooldowns (
  card_id     UUID PRIMARY KEY REFERENCES public.customer_cards(id) ON DELETE CASCADE,
  last_scan   TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE public.scan_cooldowns ENABLE ROW LEVEL SECURITY;

-- Service role manages all cooldowns (Edge Functions + scanner backend)
CREATE POLICY "Service role manages scan_cooldowns"
  ON public.scan_cooldowns FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users (merchants) can read + upsert their own cooldowns
CREATE POLICY "Authenticated can upsert scan_cooldowns"
  ON public.scan_cooldowns FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Cleanup function: remove stale cooldowns older than 2 minutes (housekeeping)
CREATE OR REPLACE FUNCTION public.cleanup_scan_cooldowns()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.scan_cooldowns WHERE last_scan < now() - interval '2 minutes';
$$;

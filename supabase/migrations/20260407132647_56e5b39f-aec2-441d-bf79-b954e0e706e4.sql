
-- Remove anon SELECT and DELETE on wallet_registrations
-- The wallet-webservice edge function handles all reads/deletes with service_role
DROP POLICY IF EXISTS "Wallet devices can view own registration" ON public.wallet_registrations;
DROP POLICY IF EXISTS "Wallet devices can delete own registration" ON public.wallet_registrations;

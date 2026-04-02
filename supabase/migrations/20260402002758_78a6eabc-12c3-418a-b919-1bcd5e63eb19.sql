
DROP POLICY IF EXISTS "Service can insert digest logs" ON public.digest_logs;
CREATE POLICY "Service can insert digest logs"
  ON public.digest_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin')
  );

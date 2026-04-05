CREATE TABLE public.scan_cooldowns (
  card_id uuid PRIMARY KEY REFERENCES public.customer_cards(id) ON DELETE CASCADE,
  last_scan timestamp with time zone NOT NULL DEFAULT now(),
  scanned_by uuid
);

ALTER TABLE public.scan_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage scan cooldowns"
ON public.scan_cooldowns FOR ALL
TO authenticated
USING (card_id IN (SELECT cc.id FROM customer_cards cc JOIN businesses b ON b.id = cc.business_id WHERE b.owner_id = auth.uid()))
WITH CHECK (card_id IN (SELECT cc.id FROM customer_cards cc JOIN businesses b ON b.id = cc.business_id WHERE b.owner_id = auth.uid()));
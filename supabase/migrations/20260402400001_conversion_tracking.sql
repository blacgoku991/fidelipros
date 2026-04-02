-- Vitrine visit tracking for conversion funnel
CREATE TABLE IF NOT EXISTS public.vitrine_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'direct',
  referrer TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vitrine_visits_biz ON vitrine_visits(business_id, created_at);
ALTER TABLE vitrine_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view visits" ON vitrine_visits FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "Anon can insert visits" ON vitrine_visits FOR INSERT TO anon WITH CHECK (business_id IS NOT NULL);
CREATE POLICY "Authenticated can insert visits" ON vitrine_visits FOR INSERT TO authenticated WITH CHECK (business_id IS NOT NULL);

-- Track where customers registered from
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'direct';

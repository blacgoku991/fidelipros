
-- Automations table for automated campaigns
CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'inactive_days',
  trigger_value INTEGER DEFAULT 7,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_segment TEXT NOT NULL DEFAULT 'all',
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage their automations"
ON public.automations FOR ALL
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Multi-merchant prep: locations
CREATE TABLE public.merchant_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage their locations"
ON public.merchant_locations FOR ALL
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Multi-merchant prep: per-location points
CREATE TABLE public.user_merchant_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_location_id UUID NOT NULL REFERENCES public.merchant_locations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, merchant_location_id)
);

ALTER TABLE public.user_merchant_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage merchant points"
ON public.user_merchant_points FOR ALL
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

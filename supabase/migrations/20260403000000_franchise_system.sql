-- ============================================
-- Pack Franchise System
-- ============================================

-- 1. Franchise columns on businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_franchise BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_locations INTEGER DEFAULT 1;

-- 2. Extend merchant_locations with manager linkage
ALTER TABLE public.merchant_locations
  ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Location managers (many-to-many)
CREATE TABLE IF NOT EXISTS public.location_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.merchant_locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager',
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(location_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_location_managers_user ON location_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_location_managers_location ON location_managers(location_id);
ALTER TABLE location_managers ENABLE ROW LEVEL SECURITY;

-- Location managers visible to the franchise owner
CREATE POLICY "Franchise owners manage location_managers" ON location_managers FOR ALL
  USING (location_id IN (
    SELECT id FROM merchant_locations WHERE business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  ));

-- Location managers can see their own record
CREATE POLICY "Managers see own record" ON location_managers FOR SELECT
  USING (user_id = auth.uid());

-- 4. Add location_id to points_history for per-location analytics
ALTER TABLE public.points_history
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.merchant_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_points_history_location ON points_history(location_id) WHERE location_id IS NOT NULL;

-- 5. Helper function: get all business IDs accessible to a user
CREATE OR REPLACE FUNCTION public.businesses_for_user(_uid UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Direct ownership
  SELECT id FROM businesses WHERE owner_id = _uid
  UNION
  -- Location manager: return the parent business_id
  SELECT ml.business_id
  FROM location_managers lm
  JOIN merchant_locations ml ON ml.id = lm.location_id
  WHERE lm.user_id = _uid
$$;

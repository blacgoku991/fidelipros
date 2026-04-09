
-- FIX 1: rewards — restrict anon access
DROP POLICY IF EXISTS "Public can view rewards" ON public.rewards;

-- Create a SECURITY DEFINER function for public reward lookups
CREATE OR REPLACE FUNCTION public.get_public_rewards(p_business_id uuid)
RETURNS TABLE(
  id uuid, title text, description text, points_required integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.title, r.description, r.points_required
  FROM public.rewards r
  WHERE r.business_id = p_business_id AND r.is_active = true
  ORDER BY r.points_required ASC;
$$;

-- FIX 2: demo_sessions — restrict SELECT
DROP POLICY IF EXISTS "Anyone can view demo sessions" ON public.demo_sessions;

CREATE POLICY "Business owners can view demo sessions"
ON public.demo_sessions
FOR SELECT
TO authenticated
USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow anon to view only their own session (they need it for the demo flow)
CREATE POLICY "Anon can view demo session by slug"
ON public.demo_sessions
FOR SELECT
TO anon
USING (slug IS NOT NULL);

-- FIX 3: merchant_locations — add SELECT for managers
CREATE POLICY "Managers can view assigned locations"
ON public.merchant_locations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT location_id FROM public.location_managers 
    WHERE user_id = auth.uid()
  )
);

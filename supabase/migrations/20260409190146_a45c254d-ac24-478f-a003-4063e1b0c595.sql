-- Fix infinite recursion on merchant_locations by using a SECURITY DEFINER function
-- to check business ownership without triggering RLS on the businesses table

CREATE OR REPLACE FUNCTION public.is_business_owner(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = _business_id AND owner_id = _user_id
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Business owners can manage their locations" ON public.merchant_locations;

-- Recreate it using the SECURITY DEFINER function
CREATE POLICY "Business owners can manage their locations"
ON public.merchant_locations
FOR ALL
TO authenticated
USING (public.is_business_owner(auth.uid(), business_id))
WITH CHECK (public.is_business_owner(auth.uid(), business_id));

-- Also fix location_managers which has the same recursion issue
DROP POLICY IF EXISTS "Business owners can manage their location managers" ON public.location_managers;

CREATE POLICY "Business owners can manage their location managers"
ON public.location_managers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_locations ml
    WHERE ml.id = location_managers.location_id
    AND public.is_business_owner(auth.uid(), ml.business_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.merchant_locations ml
    WHERE ml.id = location_managers.location_id
    AND public.is_business_owner(auth.uid(), ml.business_id)
  )
);
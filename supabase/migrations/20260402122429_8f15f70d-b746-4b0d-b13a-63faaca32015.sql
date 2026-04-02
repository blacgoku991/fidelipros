
-- Add franchise columns to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS is_franchise boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS max_locations integer NOT NULL DEFAULT 1;

-- Extend app_role enum with location_manager
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'location_manager';

-- Create location_managers table
CREATE TABLE IF NOT EXISTS public.location_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.merchant_locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'manager',
  invited_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(location_id, user_id)
);

-- Enable RLS
ALTER TABLE public.location_managers ENABLE ROW LEVEL SECURITY;

-- Policies for location_managers
CREATE POLICY "Business owners can manage their location managers"
ON public.location_managers FOR ALL
USING (
  location_id IN (
    SELECT ml.id FROM merchant_locations ml
    JOIN businesses b ON b.id = ml.business_id
    WHERE b.owner_id = auth.uid()
  )
)
WITH CHECK (
  location_id IN (
    SELECT ml.id FROM merchant_locations ml
    JOIN businesses b ON b.id = ml.business_id
    WHERE b.owner_id = auth.uid()
  )
);

CREATE POLICY "Managers can view own assignment"
ON public.location_managers FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all location managers"
ON public.location_managers FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Add location_id column to points_history for location scoping
ALTER TABLE public.points_history
ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.merchant_locations(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_points_history_location ON public.points_history(location_id);
CREATE INDEX IF NOT EXISTS idx_location_managers_user ON public.location_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_location_managers_location ON public.location_managers(location_id);

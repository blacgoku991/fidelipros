ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS onboarding_tour_completed BOOLEAN DEFAULT false;

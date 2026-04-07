ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS tier_silver_points integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tier_gold_points integer NOT NULL DEFAULT 25;
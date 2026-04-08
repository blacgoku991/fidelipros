ALTER TABLE public.businesses
  ADD COLUMN reward_next_visit_only boolean DEFAULT false,
  ADD COLUMN reward_min_purchase numeric DEFAULT 0;
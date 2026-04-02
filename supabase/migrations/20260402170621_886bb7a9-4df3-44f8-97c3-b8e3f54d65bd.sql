
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS google_review_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_review_threshold integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS google_review_message text DEFAULT 'Merci pour votre fidélité ! Votre avis Google nous aiderait beaucoup';

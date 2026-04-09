
CREATE OR REPLACE FUNCTION public.get_public_business_by_id(p_id uuid)
RETURNS TABLE(
  id uuid, name text, description text, logo_url text, address text, city text,
  phone text, website text, category text, slug text,
  primary_color text, secondary_color text, accent_color text,
  foreground_color text, label_color text,
  card_style text, card_bg_type text, card_bg_image_url text, card_animation_intensity text,
  loyalty_type text, max_points_per_card integer, points_per_visit integer, points_per_euro integer,
  reward_description text, promo_text text,
  show_customer_name boolean, show_qr_code boolean, show_points boolean,
  show_rewards_preview boolean, show_expiration boolean,
  google_review_enabled boolean, google_place_id text,
  google_review_message text, google_review_threshold integer,
  is_demo boolean, latitude double precision, longitude double precision,
  birthday_notif_enabled boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.description, b.logo_url, b.address, b.city, b.phone, b.website,
         b.category, b.slug, b.primary_color, b.secondary_color, b.accent_color,
         b.foreground_color, b.label_color, b.card_style, b.card_bg_type, b.card_bg_image_url,
         b.card_animation_intensity, b.loyalty_type, b.max_points_per_card, b.points_per_visit,
         b.points_per_euro, b.reward_description, b.promo_text, b.show_customer_name,
         b.show_qr_code, b.show_points, b.show_rewards_preview, b.show_expiration,
         b.google_review_enabled, b.google_place_id, b.google_review_message,
         b.google_review_threshold, b.is_demo, b.latitude, b.longitude,
         b.birthday_notif_enabled
  FROM public.businesses b
  WHERE b.id = p_id
  LIMIT 1;
$$;

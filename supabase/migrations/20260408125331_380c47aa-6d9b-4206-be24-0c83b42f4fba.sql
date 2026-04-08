ALTER TABLE public.businesses
ADD COLUMN geofence_cooldown_hours integer NOT NULL DEFAULT 24;
-- Store the email used for the invitation so the frontend can display it
-- (profiles table may not have the email for newly invited managers)
ALTER TABLE public.location_managers ADD COLUMN IF NOT EXISTS invite_email TEXT;

-- Grant table access to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reward_instances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reward_instances TO service_role;

-- Grant usage on the enum type
GRANT USAGE ON TYPE public.reward_instance_status TO authenticated;
GRANT USAGE ON TYPE public.reward_instance_status TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_activate_business(uuid, text, text, boolean, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activate_business(uuid, text, text, boolean, timestamptz, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_business(uuid) TO authenticated;
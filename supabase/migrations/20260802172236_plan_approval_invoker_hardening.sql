-- Harden approve_plan_v1 execution permissions
revoke all on function public.approve_plan_v1(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.approve_plan_v1(text, uuid, jsonb) to service_role;

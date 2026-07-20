-- Phase 1 onboarding compatibility for the foundation schema.
-- Keep this migration separate so a deployed foundation can be upgraded safely.
alter table public.organizations add column if not exists created_by uuid references auth.users(id);
update public.organizations set created_by = (select user_id from public.organization_members where organization_id = organizations.id order by created_at limit 1) where created_by is null;

drop policy if exists organizations_owner_insert on public.organizations;
create policy organizations_owner_insert on public.organizations for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists members_self_insert on public.organization_members;
create policy members_self_insert on public.organization_members for insert to authenticated
with check (user_id = (select auth.uid()) and role = 'owner');

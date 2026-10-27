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

alter table public.projects add column if not exists brief jsonb not null default '{}'::jsonb;

create or replace function private.require_brief_and_approved_plan()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  project_brief jsonb;
begin
  select brief into project_brief from public.projects where id = new.project_id;
  if project_brief is null
    or nullif(trim(project_brief->>'clientName'), '') is null
    or nullif(trim(project_brief->>'projectName'), '') is null
  then
    raise exception using errcode = '23514', message = 'A saved client brief is required before scene creation.';
  end if;

  if not exists (
    select 1 from public.floor_plan_versions
    where id = new.floor_plan_version_id
      and project_id = new.project_id
      and status in ('approved', 'locked')
  ) then
    raise exception using errcode = '23514', message = 'An approved floor plan is required before scene creation.';
  end if;

  return new;
end;
$$;

revoke all on function private.require_brief_and_approved_plan() from public, anon;
grant execute on function private.require_brief_and_approved_plan() to authenticated;

drop trigger if exists scene_creation_gate on public.scene_versions;
create trigger scene_creation_gate
before insert on public.scene_versions
for each row execute function private.require_brief_and_approved_plan();

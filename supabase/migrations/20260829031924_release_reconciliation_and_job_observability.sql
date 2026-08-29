-- Release reconciliation checkpoint.
--
-- The production schema predates the repository's current timestamped
-- migration sequence. This migration is deliberately idempotent: it records
-- the current release contract without replaying historical DDL against live
-- customer data. The accompanying migration manifest documents the legacy
-- timestamp mapping; future releases begin from this checkpoint.

-- Split the former ALL policies so their SELECT scope cannot accidentally
-- combine with the member-read policy. The predicates are unchanged, but the
-- auth value is evaluated once per statement and anonymous callers no longer
-- receive policies intended for signed-in studio members.
drop policy if exists organization_settings_admin_write on public.organization_settings;
drop policy if exists organization_settings_admin_insert on public.organization_settings;
drop policy if exists organization_settings_admin_update on public.organization_settings;
drop policy if exists organization_settings_admin_delete on public.organization_settings;

create policy organization_settings_admin_insert on public.organization_settings
for insert to authenticated
with check (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_settings.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

create policy organization_settings_admin_update on public.organization_settings
for update to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_settings.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_settings.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

create policy organization_settings_admin_delete on public.organization_settings
for delete to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_settings.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

drop policy if exists organization_invites_admin_all on public.organization_invitations;
drop policy if exists organization_invites_admin_select on public.organization_invitations;
drop policy if exists organization_invites_admin_insert on public.organization_invitations;
drop policy if exists organization_invites_admin_update on public.organization_invitations;
drop policy if exists organization_invites_admin_delete on public.organization_invitations;

create policy organization_invites_admin_select on public.organization_invitations
for select to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invitations.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

create policy organization_invites_admin_insert on public.organization_invitations
for insert to authenticated
with check (
  invited_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invitations.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

create policy organization_invites_admin_update on public.organization_invitations
for update to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invitations.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invitations.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

create policy organization_invites_admin_delete on public.organization_invitations
for delete to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invitations.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

-- These support the worker's recovery sweep and project-level job polling.
-- They are partial indexes so completed job history remains inexpensive.
create index if not exists jobs_plan_recovery_idx
  on public.jobs (deadline_at, updated_at)
  where kind = 'plan-analysis' and status = 'running';

create index if not exists jobs_failed_operational_idx
  on public.jobs (kind, last_error_code, failed_at desc)
  where status = 'failed';

-- A security-invoker view gives authorized users an operational summary while
-- preserving the existing jobs RLS policy. It intentionally excludes inputs,
-- outputs, and provider payloads.
create or replace view public.job_operational_health
with (security_invoker = true)
as
select
  organization_id,
  project_id,
  kind,
  status,
  coalesce(last_error_code, error ->> 'code', 'NONE') as outcome_code,
  count(*)::integer as job_count,
  max(updated_at) as latest_at
from public.jobs
group by organization_id, project_id, kind, status,
  coalesce(last_error_code, error ->> 'code', 'NONE');

grant select on public.job_operational_health to authenticated;

select pg_notify('pgrst', 'reload schema');

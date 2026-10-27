-- Reconcile the canonical plan-version contract with older production
-- projects that created floor_plan_versions before organization ownership and
-- the complete plan.v1 payload columns were introduced.
alter table public.floor_plan_versions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists spatial_model jsonb,
  add column if not exists change_reason text not null default 'Plan version imported from the legacy schema';

update public.floor_plan_versions fpv
set organization_id = projects.organization_id
from public.projects projects
where projects.id = fpv.project_id
  and fpv.organization_id is null;

update public.floor_plan_versions
set spatial_model = coalesce(spatial_model, canonical_model, interpretation)
where spatial_model is null;

do $$
begin
  if exists (
    select 1 from public.floor_plan_versions where organization_id is null
  ) then
    raise exception 'FLOOR_PLAN_VERSION_ORGANIZATION_BACKFILL_INCOMPLETE';
  end if;
end
$$;

alter table public.floor_plan_versions
  alter column organization_id set not null;

create index if not exists floor_plan_versions_organization_project_idx
  on public.floor_plan_versions (organization_id, project_id, version_number desc);

drop policy if exists plans_member_all on public.floor_plan_versions;
create policy plans_member_all on public.floor_plan_versions
for all to authenticated
using ((select private.is_org_member(organization_id)))
with check (
  (select private.is_org_member(organization_id))
  and (created_by is null or created_by = (select auth.uid()))
);

notify pgrst, 'reload schema';

-- Align render/drawing artifacts with the scene-linked persistence contract.
-- Older production databases stored only project + scene lineage, which made
-- technical masks and final render writes fail when the API supplied the
-- owning organization, job, creator and stale state.
alter table public.artifacts
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists stale boolean not null default false;

update public.artifacts artifact
set organization_id = project.organization_id
from public.projects project
where project.id = artifact.project_id
  and artifact.organization_id is null;

do $$
begin
  if exists (select 1 from public.artifacts where organization_id is null) then
    raise exception 'ARTIFACT_ORGANIZATION_BACKFILL_INCOMPLETE';
  end if;
end
$$;

alter table public.artifacts
  alter column organization_id set not null;

create index if not exists artifacts_organization_project_created_idx
  on public.artifacts (organization_id, project_id, created_at desc);
create index if not exists artifacts_job_idx
  on public.artifacts (job_id) where job_id is not null;

drop policy if exists artifacts_member_all on public.artifacts;
create policy artifacts_member_all on public.artifacts
for all to authenticated
using ((select private.is_org_member(organization_id)))
with check (
  (select private.is_org_member(organization_id))
  and (created_by is null or created_by = (select auth.uid()))
);

notify pgrst, 'reload schema';

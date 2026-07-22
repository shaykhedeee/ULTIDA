-- Keep the live legacy scene table compatible with the authenticated browser
-- workflow, which records organization context alongside project ownership.
alter table public.scene_versions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.scene_versions scene_version
set organization_id = project.organization_id
from public.projects project
where scene_version.project_id = project.id
  and scene_version.organization_id is null;

select pg_notify('pgrst', 'reload schema');

-- The live schema retains a legacy project_assets shape. Add the organization
-- context used by browser uploads and worker-created visual artifacts.
alter table public.project_assets
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.project_assets asset
set organization_id = project.organization_id
from public.projects project
where asset.project_id = project.id
  and asset.organization_id is null;

select pg_notify('pgrst', 'reload schema');

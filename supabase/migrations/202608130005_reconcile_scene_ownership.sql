-- Backfill and enforce scene ownership so scene.v1 and every downstream
-- render/drawing/cutlist share the same organization boundary.
update public.scene_versions scene
set organization_id = project.organization_id
from public.projects project
where project.id = scene.project_id
  and scene.organization_id is null;

do $$
begin
  if exists (select 1 from public.scene_versions where organization_id is null) then
    raise exception 'SCENE_ORGANIZATION_BACKFILL_INCOMPLETE';
  end if;
end
$$;

alter table public.scene_versions
  alter column organization_id set not null;

create index if not exists scene_versions_organization_project_idx
  on public.scene_versions (organization_id, project_id, branch_name, version_number desc);

drop policy if exists scenes_member_all on public.scene_versions;
create policy scenes_member_all on public.scene_versions
for all to authenticated
using ((select private.is_org_member(organization_id)))
with check (
  (select private.is_org_member(organization_id))
  and (created_by is null or created_by = (select auth.uid()))
);

notify pgrst, 'reload schema';

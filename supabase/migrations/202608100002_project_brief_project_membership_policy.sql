-- Project briefs must be authorized by the canonical project's organisation,
-- not by a potentially missing/stale organisation_id on an older brief row.
-- This is particularly important for UPSERT: PostgreSQL checks the existing
-- row through USING before it can apply the replacement values.

drop policy if exists project_briefs_member_all on public.project_briefs;
drop policy if exists project_briefs_select_member on public.project_briefs;
drop policy if exists project_briefs_insert_member on public.project_briefs;
drop policy if exists project_briefs_update_member on public.project_briefs;
drop policy if exists project_briefs_delete_member on public.project_briefs;

create policy project_briefs_select_member on public.project_briefs
for select to authenticated
using (
  (select private.is_org_member(
    (select p.organization_id from public.projects p where p.id = project_briefs.project_id)
  ))
);

create policy project_briefs_insert_member on public.project_briefs
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select private.is_org_member(
    (select p.organization_id from public.projects p where p.id = project_briefs.project_id)
  ))
);

create policy project_briefs_update_member on public.project_briefs
for update to authenticated
using (
  (select private.is_org_member(
    (select p.organization_id from public.projects p where p.id = project_briefs.project_id)
  ))
)
with check (
  updated_by = (select auth.uid())
  and (select private.is_org_member(
    (select p.organization_id from public.projects p where p.id = project_briefs.project_id)
  ))
);

create policy project_briefs_delete_member on public.project_briefs
for delete to authenticated
using (
  (select private.is_org_member(
    (select p.organization_id from public.projects p where p.id = project_briefs.project_id)
  ))
);

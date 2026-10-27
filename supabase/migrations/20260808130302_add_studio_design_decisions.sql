-- Ensure studio_design_decisions table and indexes exist
create index if not exists studio_design_decisions_org_project_idx on public.studio_design_decisions(organization_id, project_id, created_at desc);

-- Foreign key indexes for foundation tables
create index if not exists projects_organization_id_idx on public.projects(organization_id);
create index if not exists project_assets_project_id_idx on public.project_assets(project_id);
create index if not exists floor_plan_versions_project_id_idx on public.floor_plan_versions(project_id);
create index if not exists scene_versions_project_id_idx on public.scene_versions(project_id);
create index if not exists jobs_project_id_idx on public.jobs(project_id);
create index if not exists artifacts_project_id_idx on public.artifacts(project_id);

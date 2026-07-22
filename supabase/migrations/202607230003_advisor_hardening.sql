-- Keep the plan approval transaction server-only. The function validates
-- membership internally, but browser clients never need direct RPC access.
revoke all on function public.approve_plan_v1(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.approve_plan_v1(text, uuid, jsonb) to service_role;

create index if not exists ai_runs_organization_fk_idx on public.ai_runs (organization_id);
create index if not exists floor_plan_versions_approved_by_fk_idx on public.floor_plan_versions (approved_by);
create index if not exists layout_invalidation_events_created_by_fk_idx on public.layout_invalidation_events (created_by);
create index if not exists layout_invalidation_events_organization_fk_idx on public.layout_invalidation_events (organization_id);
create index if not exists layout_invalidation_events_project_fk_idx on public.layout_invalidation_events (project_id);
create index if not exists layout_invalidation_events_source_layout_fk_idx on public.layout_invalidation_events (source_layout_version_id);
create index if not exists layout_versions_approved_by_fk_idx on public.layout_versions (approved_by);
create index if not exists layout_versions_created_by_fk_idx on public.layout_versions (created_by);
create index if not exists layout_versions_organization_fk_idx on public.layout_versions (organization_id);
create index if not exists layout_versions_source_plan_fk_idx on public.layout_versions (source_plan_version_id);
create index if not exists layout_versions_space_fk_idx on public.layout_versions (space_id);
create index if not exists layouts_approved_by_fk_idx on public.layouts (approved_by);
create index if not exists layouts_created_by_fk_idx on public.layouts (created_by);
create index if not exists layouts_organization_fk_idx on public.layouts (organization_id);
create index if not exists layouts_project_fk_idx on public.layouts (project_id);
create index if not exists layouts_space_fk_idx on public.layouts (space_id);
create index if not exists project_briefs_created_by_fk_idx on public.project_briefs (created_by);
create index if not exists project_briefs_updated_by_fk_idx on public.project_briefs (updated_by);
create index if not exists quotes_approved_by_fk_idx on public.quotes (approved_by);
create index if not exists quotes_created_by_fk_idx on public.quotes (created_by);
create index if not exists quotes_organization_fk_idx on public.quotes (organization_id);
create index if not exists quotes_scene_version_fk_idx on public.quotes (scene_version_id);
create index if not exists scene_versions_organization_fk_idx on public.scene_versions (organization_id);
create index if not exists spaces_created_by_fk_idx on public.spaces (created_by);
create index if not exists workflow_stage_status_organization_fk_idx on public.workflow_stage_status (organization_id);
create index if not exists workflow_stage_status_updated_by_fk_idx on public.workflow_stage_status (updated_by);

-- Migration 12: Render pipeline persistence
-- Adds render jobs/artifacts/QA without modifying existing tables.
create table if not exists public.render_jobs (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  project_id            uuid not null references public.projects(id) on delete cascade,
  plan_version_id       uuid not null references public.floor_plan_versions(id),
  layout_version_id     uuid,
  module_snapshot_id    uuid not null,
  material_version_id   uuid,
  scene_version_id      uuid not null references public.scene_versions(id),
  camera_id             uuid,
  provider              text not null,
  model                 text not null,
  prompt_version        text not null,
  source_scene_graph    jsonb,
  selected_materials    jsonb not null default '[]',
  render_options        jsonb not null,
  state                 text not null default 'waiting_for_geometry',
  qa_result             jsonb,
  failure               jsonb,
  artifacts             jsonb not null default '[]',
  approved              boolean not null default false,
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index render_jobs_project_idx on public.render_jobs(project_id, created_at desc);
create index render_jobs_scene_idx on public.render_jobs(scene_version_id);

alter table public.render_jobs enable row level security;
grant select, insert, update, delete on public.render_jobs to authenticated;

create policy render_jobs_member_all on public.render_jobs for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

comment on table public.render_jobs is 'Production render jobs linked to approved scene versions with QA and approval state';

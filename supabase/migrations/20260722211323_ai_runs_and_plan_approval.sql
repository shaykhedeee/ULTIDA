create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  asset_id uuid references public.project_assets(id) on delete set null,
  task_type text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  asset_hash text,
  output_hash text,
  latency_ms integer not null default 0 check (latency_ms >= 0),
  usage jsonb not null default '{}'::jsonb,
  status text not null check (status in ('succeeded', 'failed')),
  error jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_runs_project_created_idx
  on public.ai_runs(project_id, created_at desc);
create index if not exists ai_runs_job_idx on public.ai_runs(job_id);
create index if not exists ai_runs_asset_idx on public.ai_runs(asset_id);

alter table public.ai_runs enable row level security;
grant select on public.ai_runs to authenticated;
drop policy if exists ai_runs_member_select on public.ai_runs;
create policy ai_runs_member_select on public.ai_runs for select to authenticated
  using ((select private.is_org_member(organization_id)));

create or replace function public.approve_plan_v1(
  requested_project_id text,
  requested_source_asset_id uuid,
  requested_model jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid;
  version_id uuid := gen_random_uuid();
  next_version integer;
  room_count integer;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.organization_id into org_id
  from public.projects p
  where p.id = requested_project_id
    and private.is_org_member(p.organization_id);
  if org_id is null then
    raise exception 'PROJECT_ACCESS_DENIED';
  end if;

  if not exists (
    select 1 from public.project_assets a
    where a.id = requested_source_asset_id
      and a.project_id = requested_project_id
      and a.organization_id = org_id
  ) then
    raise exception 'SOURCE_ASSET_NOT_FOUND';
  end if;

  if requested_model->>'units' <> 'mm'
     or coalesce((requested_model#>>'{scale,mmPerPixel}')::numeric, 0) <= 0 then
    raise exception 'PLAN_SCALE_NOT_VERIFIED';
  end if;
  if jsonb_typeof(requested_model->'rooms') <> 'array'
     or jsonb_array_length(requested_model->'rooms') = 0 then
    raise exception 'PLAN_HAS_NO_VALID_SPACES';
  end if;
  if coalesce(jsonb_array_length(requested_model->'unresolvedItems'), 0) > 0 then
    raise exception 'PLAN_HAS_UNRESOLVED_ISSUES';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.floor_plan_versions where project_id = requested_project_id;

  update public.floor_plan_versions
  set active_version = false, status = 'superseded', review_status = 'superseded'
  where project_id = requested_project_id and active_version = true;

  insert into public.floor_plan_versions (
    id, organization_id, project_id, version_number, status, source_asset_id,
    spatial_model, canonical_model, scale_state, verification_state,
    schema_version, review_status, approved_at, approved_by,
    active_version, change_reason, created_by
  ) values (
    version_id, org_id, requested_project_id, next_version, 'approved', requested_source_asset_id,
    requested_model, requested_model, requested_model->'scale',
    jsonb_build_object('verified', true, 'approvedBy', actor_id, 'approvedAt', now()),
    'plan.v1', 'approved', now(), actor_id, true,
    'Designer-approved canonical plan', actor_id
  );

  insert into public.spaces (
    organization_id, project_id, floor_plan_version_id, space_id, name,
    room_type, area_sqm, ceiling_height_mm, geometry_json,
    requirements_json, settings_json, status, verification_status, created_by
  )
  select
    org_id, requested_project_id, version_id,
    coalesce(nullif(room->>'id', ''), 'space-' || ordinal::text),
    coalesce(nullif(room->>'label', ''), nullif(room->>'name', ''), 'Space ' || ordinal::text),
    case
      when lower(coalesce(room->>'roomType', room->>'type', room->>'label', '')) like '%kitchen%' then 'kitchen'
      when lower(coalesce(room->>'roomType', room->>'type', room->>'label', '')) like '%bed%' then 'bedroom'
      when lower(coalesce(room->>'roomType', room->>'type', room->>'label', '')) like '%dining%' then 'dining'
      when lower(coalesce(room->>'roomType', room->>'type', room->>'label', '')) like '%pooja%' then 'pooja'
      when lower(coalesce(room->>'roomType', room->>'type', room->>'label', '')) like '%utility%' then 'utility'
      when lower(coalesce(room->>'roomType', room->>'type', room->>'label', '')) like '%study%' then 'study'
      when lower(coalesce(room->>'roomType', room->>'type', room->>'label', '')) like '%living%' then 'living'
      else 'other'
    end,
    nullif(room->>'areaSqm', '')::numeric,
    coalesce(nullif(room->>'ceilingHeightMm', '')::integer, nullif(requested_model->>'ceilingHeightMm', '')::integer),
    room,
    jsonb_build_object(
      'dimensionsText', 'Derived from approved plan.v1',
      'usableWalls', coalesce((room->>'usableWalls')::integer, 0),
      'requiredFurniture', '[]'::jsonb,
      'geometryVerified', true
    ),
    '{}'::jsonb,
    'pending', 'verified', actor_id
  from jsonb_array_elements(requested_model->'rooms') with ordinality as rooms(room, ordinal);

  get diagnostics room_count = row_count;

  update public.layouts set status = 'stale'
  where project_id = requested_project_id and status in ('candidate', 'approved');
  update public.scene_versions set status = 'stale'
  where project_id = requested_project_id and status in ('draft', 'approved');

  update public.projects
  set active_floor_plan_version_id = version_id,
      workflow_stage = 'spaces', current_step = 'spaces', updated_at = now()
  where id = requested_project_id;

  return jsonb_build_object(
    'floorPlanVersionId', version_id,
    'versionNumber', next_version,
    'spacesCount', room_count,
    'schemaVersion', 'plan.v1'
  );
end;
$$;

revoke all on function public.approve_plan_v1(text, uuid, jsonb) from public, anon;
grant execute on function public.approve_plan_v1(text, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

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

-- Plan analysis: full vision-provider output + deterministic evidence + reconciliation
create table if not exists public.plan_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  analysis_uuid uuid not null unique,
  provider text not null,
  model text not null,
  prompt_version text not null,
  source_file_name text,
  source_mime_type text,
  input_sha256 text not null,
  preview_sha256 text not null,
  request_payload jsonb not null default '{}'::jsonb,
  deterministic jsonb not null default '{}'::jsonb,
  response_validated jsonb not null default '{}'::jsonb,
  latency_ms integer not null default 0 check (latency_ms >= 0),
  usage jsonb,
  status text not null check (status in ('succeeded', 'failed')),
  error jsonb,
  created_at timestamptz not null default now()
);

create index if not exists plan_analyses_project_created_idx
  on public.plan_analyses(project_id, created_at desc);

alter table public.plan_analyses enable row level security;
grant select, insert, update on public.plan_analyses to authenticated;
drop policy if exists plan_analyses_member_all on public.plan_analyses;
create policy plan_analyses_member_all on public.plan_analyses for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));

-- Editable draft derived from a plan_analysis, used by the review workspace
create table if not exists public.plan_analysis_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  analysis_uuid uuid not null references public.plan_analyses(analysis_uuid) on delete cascade,
  elements jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  scale jsonb,
  ceiling_height_mm integer,
  status text not null check (status in ('draft', 'needs_review', 'approved')),
  updated_at timestamptz not null default now()
);

create index if not exists plan_analysis_drafts_project_idx
  on public.plan_analysis_drafts(project_id, updated_at desc);

alter table public.plan_analysis_drafts enable row level security;
grant select, insert, update on public.plan_analysis_drafts to authenticated;
drop policy if exists plan_analysis_drafts_member_all on public.plan_analysis_drafts;
create policy plan_analysis_drafts_member_all on public.plan_analysis_drafts for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));

notify pgrst, 'reload schema';

-- Align plan approval with the canonical PlanCoreV1 model. This migration is
-- additive/reversible at the function boundary and must be applied to staging
-- before any production rollout.
create or replace function public.approve_plan_v1(
  requested_project_id text,
  requested_source_asset_id uuid,
  requested_model jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid;
  version_id uuid := gen_random_uuid();
  next_version integer;
  room_count integer;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select organization_id into org_id
  from public.projects
  where id = requested_project_id and private.is_org_member(organization_id);
  if org_id is null then raise exception 'PROJECT_ACCESS_DENIED'; end if;

  if not exists (
    select 1 from public.project_assets
    where id = requested_source_asset_id and project_id = requested_project_id and organization_id = org_id
  ) then raise exception 'SOURCE_ASSET_NOT_FOUND'; end if;

  if requested_model->>'schemaVersion' <> 'plan.v1'
    or requested_model->>'state' <> 'approved'
    or coalesce((requested_model#>>'{source,mmPerPixel}')::numeric, 0) <= 0
    or coalesce((requested_model#>>'{scale,verified}')::boolean, false) is not true
  then raise exception 'PLAN_SCALE_NOT_VERIFIED'; end if;

  if coalesce((requested_model#>>'{validation,blockingIssueCount}')::integer, 1) > 0
    or coalesce((requested_model#>>'{validation,isValid}')::boolean, false) is not true
  then raise exception 'PLAN_HAS_UNRESOLVED_ISSUES'; end if;

  if jsonb_typeof(requested_model->'spaces') <> 'array'
    or jsonb_array_length(requested_model->'spaces') = 0
  then raise exception 'PLAN_HAS_NO_VALID_SPACES'; end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.floor_plan_versions where project_id = requested_project_id;

  update public.floor_plan_versions
  set active_version = false, status = 'superseded', review_status = 'superseded'
  where project_id = requested_project_id and active_version = true;

  insert into public.floor_plan_versions (
    id, organization_id, project_id, version_number, status, source_asset_id,
    spatial_model, canonical_model, scale_state, verification_state,
    schema_version, review_status, approved_at, approved_by,
    active_version, change_reason, created_by
  ) values (
    version_id, org_id, requested_project_id, next_version, 'approved', requested_source_asset_id,
    requested_model, requested_model, requested_model->'scale',
    jsonb_build_object('verified', true, 'approvedBy', actor_id, 'approvedAt', now()),
    'plan.v1', 'approved', now(), actor_id, true,
    'Designer-approved canonical plan.v1', actor_id
  );

  insert into public.spaces (
    organization_id, project_id, floor_plan_version_id, space_id, name,
    room_type, area_sqm, ceiling_height_mm, geometry_json,
    requirements_json, settings_json, status, verification_status, created_by
  )
  select
    org_id, requested_project_id, version_id,
    space->>'id',
    coalesce(nullif(space->>'roomName', ''), space->>'roomType', 'Space ' || ordinal::text),
    coalesce(nullif(space->>'roomType', ''), 'other'),
    coalesce((space->>'areaSqm')::numeric, (space->>'areaMm2')::numeric / 1000000),
    coalesce((space->>'ceilingHeightMm')::integer, (requested_model->>'ceilingHeightMm')::integer),
    space,
    jsonb_build_object('requiredFurniture', '[]'::jsonb, 'geometryVerified', true),
    '{}'::jsonb, 'pending', 'verified', actor_id
  from jsonb_array_elements(requested_model->'spaces') with ordinality as spaces(space, ordinal);
  get diagnostics room_count = row_count;

  update public.layouts set status = 'stale' where project_id = requested_project_id and status in ('candidate', 'approved');
  update public.scene_versions set status = 'stale' where project_id = requested_project_id and status in ('draft', 'approved');
  update public.projects set active_floor_plan_version_id = version_id, workflow_stage = 'spaces', current_step = 'spaces', updated_at = now()
  where id = requested_project_id;

  return jsonb_build_object('floorPlanVersionId', version_id, 'versionNumber', next_version, 'spacesCount', room_count, 'schemaVersion', 'plan.v1');
end;
$$;

revoke all on function public.approve_plan_v1(text, uuid, jsonb) from public, anon;
grant execute on function public.approve_plan_v1(text, uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';

-- Additive module-anchor contract. Existing rows remain valid but cannot be
-- compiled until their position_json contains a wallId and millimetre point.
alter table public.module_instances
  add column if not exists space_id uuid references public.spaces(id) on delete cascade;

create index if not exists module_instances_space_idx
  on public.module_instances(project_id, space_id, created_at);

comment on column public.module_instances.position_json is
  'Authoritative wall anchor: wallId, offsetMm, xMm, yMm, zMm, rotationDeg, anchor.';

-- Additive design-library foundation. No existing project geometry is modified.
-- Apply to staging first; all browser access remains organization-scoped by RLS.

create table if not exists public.material_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  supplier text,
  brand text,
  code text not null,
  category text not null,
  finish text,
  texture_asset_id uuid references public.project_assets(id) on delete set null,
  texture_width_mm numeric,
  texture_height_mm numeric,
  grain_direction text not null default 'none',
  roughness numeric,
  metalness numeric,
  transparency numeric,
  thickness_mm numeric,
  unit_cost numeric,
  availability text not null default 'available',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists material_library_items_lookup_idx
  on public.material_library_items (organization_id, category, availability, name);

create table if not exists public.module_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  family text not null,
  name text not null,
  room_types jsonb not null default '[]'::jsonb,
  layout_shapes jsonb not null default '[]'::jsonb,
  preview_asset_id uuid references public.project_assets(id) on delete set null,
  parameter_schema jsonb not null default '{}'::jsonb,
  dimensional_limits jsonb not null default '{}'::jsonb,
  manufacturing_rules jsonb not null default '{}'::jsonb,
  price_metadata jsonb not null default '{}'::jsonb,
  version integer not null,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, family, name, version)
);

create index if not exists module_template_versions_lookup_idx
  on public.module_template_versions (organization_id, family, status, created_at desc);

create table if not exists public.material_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  material_id uuid not null references public.material_library_items(id) on delete restrict,
  module_instance_id uuid references public.module_instances(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  semantic_slot text not null,
  revision integer not null default 1,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, target_kind, target_id, semantic_slot, revision)
);

create index if not exists material_assignments_project_idx
  on public.material_assignments (project_id, module_instance_id, status, created_at desc);

alter table public.material_library_items enable row level security;
alter table public.module_template_versions enable row level security;
alter table public.material_assignments enable row level security;

grant select, insert, update, delete on public.material_library_items, public.module_template_versions, public.material_assignments to authenticated;

create policy material_library_items_member_all on public.material_library_items for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy module_template_versions_member_all on public.module_template_versions for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy material_assignments_member_all on public.material_assignments for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

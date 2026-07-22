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

-- Geometry-mode aware approval. Initial Design is reviewable/provisional; Final
-- Production retains the strict verified-scale and zero-blocker gate.
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
  mode text := coalesce(requested_model->>'geometryMode', 'initial_design');
  strict_mode boolean := mode = 'final_production';
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if mode not in ('initial_design', 'final_production') then raise exception 'INVALID_GEOMETRY_MODE'; end if;
  select organization_id into org_id from public.projects
    where id = requested_project_id and private.is_org_member(organization_id);
  if org_id is null then raise exception 'PROJECT_ACCESS_DENIED'; end if;
  if not exists (select 1 from public.project_assets where id = requested_source_asset_id
    and project_id = requested_project_id and organization_id = org_id) then
    raise exception 'SOURCE_ASSET_NOT_FOUND';
  end if;
  if requested_model->>'schemaVersion' <> 'plan.v1'
    or requested_model->>'state' <> 'approved'
    or coalesce((requested_model#>>'{source,mmPerPixel}')::numeric, 0) <= 0 then
    raise exception 'PLAN_SCALE_NOT_VERIFIED';
  end if;
  if strict_mode and (coalesce((requested_model#>>'{scale,verified}')::boolean, false) is not true
    or coalesce((requested_model#>>'{validation,blockingIssueCount}')::integer, 1) > 0
    or coalesce((requested_model#>>'{validation,isValid}')::boolean, false) is not true) then
    raise exception 'PLAN_HAS_UNRESOLVED_ISSUES';
  end if;
  if jsonb_typeof(requested_model->'spaces') <> 'array' or jsonb_array_length(requested_model->'spaces') = 0 then
    raise exception 'PLAN_HAS_NO_VALID_SPACES';
  end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.floor_plan_versions where project_id = requested_project_id;
  update public.floor_plan_versions set active_version = false, status = 'superseded', review_status = 'superseded'
    where project_id = requested_project_id and active_version = true;
  insert into public.floor_plan_versions (id, organization_id, project_id, version_number, status, source_asset_id,
    spatial_model, canonical_model, scale_state, verification_state, schema_version, review_status, approved_at,
    approved_by, active_version, change_reason, created_by)
  values (version_id, org_id, requested_project_id, next_version, 'approved', requested_source_asset_id,
    requested_model, requested_model, requested_model->'scale',
    jsonb_build_object('verified', strict_mode, 'geometryMode', mode, 'approvedBy', actor_id, 'approvedAt', now()),
    'plan.v1', 'approved', now(), actor_id, true, 'Designer-approved canonical plan.v1 (' || mode || ')', actor_id);
  insert into public.spaces (organization_id, project_id, floor_plan_version_id, space_id, name, room_type, area_sqm,
    ceiling_height_mm, geometry_json, requirements_json, settings_json, status, verification_status, created_by)
  select org_id, requested_project_id, version_id, space->>'id',
    coalesce(nullif(space->>'roomName',''), space->>'roomType', 'Space ' || ordinal::text),
    coalesce(nullif(space->>'roomType',''), 'other'), coalesce((space->>'areaSqm')::numeric, (space->>'areaMm2')::numeric / 1000000),
    coalesce((space->>'ceilingHeightMm')::integer, (requested_model->>'ceilingHeightMm')::integer), space,
    jsonb_build_object('requiredFurniture','[]'::jsonb, 'geometryVerified', strict_mode), '{}', 'pending',
    case when strict_mode then 'verified' else 'provisional' end, actor_id
  from jsonb_array_elements(requested_model->'spaces') with ordinality as spaces(space, ordinal);
  get diagnostics room_count = row_count;
  update public.layouts set status = 'stale' where project_id = requested_project_id and status in ('candidate','approved');
  update public.scene_versions set status = 'stale' where project_id = requested_project_id and status in ('draft','approved');
  update public.projects set active_floor_plan_version_id = version_id, workflow_stage = 'spaces', current_step = 'spaces', updated_at = now() where id = requested_project_id;
  return jsonb_build_object('floorPlanVersionId', version_id, 'versionNumber', next_version, 'spacesCount', room_count,
    'schemaVersion', 'plan.v1', 'geometryMode', mode, 'verificationState', case when strict_mode then 'verified' else 'provisional' end);
end;
$$;
-- The API calls this with the authenticated user's JWT so auth.uid() and the
-- organization membership check remain authoritative. Elevated keys are not
-- required for plan approval.
revoke all on function public.approve_plan_v1(text, uuid, jsonb) from public, anon;
grant execute on function public.approve_plan_v1(text, uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
alter function public.approve_plan_v1(text, uuid, jsonb) security invoker;

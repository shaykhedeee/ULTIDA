-- A narrowly scoped privileged operation is needed because existing UPDATE
-- policies require each output's creator to be the caller. This function can
-- only mark outputs stale for a project in the caller's organization.
create function private.invalidate_studio_outputs(p_project_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare project_org uuid;
begin
 select organization_id into project_org from public.projects where id::text=p_project_id;
 if auth.uid() is null or project_org is null or not private.is_org_member(project_org) then
   raise exception 'Access denied' using errcode='42501';
 end if;
 update public.scene_versions set status='stale' where project_id::text=p_project_id and status in ('draft','approved','locked');
 update public.artifacts set stale=true where project_id::text=p_project_id and stale=false;
 update public.quotes set stale=true where project_id::text=p_project_id and stale=false;
end $$;
revoke all on function private.invalidate_studio_outputs(text) from public,anon;
grant execute on function private.invalidate_studio_outputs(text) to authenticated;

-- Invoker rights retain existing organization RLS; API validation remains mandatory.
-- No grants are revoked from legacy clients during this additive rollout.
create function public.save_room_module_atomic(
 p_project_id text, p_room_id uuid, p_room_updated_at timestamptz,
 p_plan jsonb, p_expected_modules jsonb, p_module jsonb, p_expected_updated_at timestamptz default null, p_setup jsonb default null
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 room public.spaces%rowtype; source public.floor_plan_versions%rowtype;
 prior public.module_instances%rowtype; saved public.module_instances%rowtype;
 version_id uuid; version_number integer; org uuid; module_id uuid=(p_module->>'id')::uuid; active_count integer;
begin
 perform set_config('lock_timeout','5s',true);
 select organization_id into org from public.projects where id::text=p_project_id;
 if auth.uid() is null or org is null or not private.is_org_member(org) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_module->>'project_id' is distinct from p_project_id or p_module->>'space_id' is distinct from p_room_id::text or p_module->>'organization_id' is distinct from org::text or p_module->>'created_by' is distinct from auth.uid()::text then raise exception 'Module scope denied' using errcode='42501'; end if;
 -- Every room write also invalidates project outputs; serialize that boundary.
 perform pg_advisory_xact_lock(hashtextextended('module-save:'||p_project_id,0));
 select * into prior from public.module_instances where id=module_id for update;
 if found and p_expected_updated_at is null then
   if prior.project_id::text=p_project_id and prior.space_id=p_room_id and prior.validation_json->>'requestId'=p_module->'validation_json'->>'requestId' and prior.validation_json->'request'=p_module->'validation_json'->'request' then return to_jsonb(prior); end if;
   raise exception 'Placement request changed' using errcode='40001';
 end if;
 if p_expected_updated_at is not null and (prior.id is null or prior.updated_at is distinct from p_expected_updated_at) then raise exception 'Module changed' using errcode='40001'; end if;
 select * into room from public.spaces where id=p_room_id and project_id::text=p_project_id for update;
 if not found or room.updated_at is distinct from p_room_updated_at then raise exception 'Room changed' using errcode='40001'; end if;
 select * into source from public.floor_plan_versions where id::text=room.floor_plan_version_id::text and project_id::text=p_project_id for share;
 if not found or not source.active_version or source.status<>'approved' or source.canonical_model is distinct from p_plan then raise exception 'Measured plan changed' using errcode='40001'; end if;
 perform 1 from public.layouts where id=(p_module->>'layout_id')::uuid and project_id::text=p_project_id and space_id=p_room_id and status='approved' for share;
 if not found then
   if p_expected_updated_at is not null or p_setup->'candidate'->'validation'->>'valid' is distinct from 'true' or p_setup->'candidate'->>'floorPlanVersionId' is distinct from source.id::text or p_setup->'candidate'->>'spaceId' is distinct from p_room_id::text then raise exception 'Approved layout changed' using errcode='40001'; end if;
   insert into public.layouts(id,organization_id,project_id,space_id,layout_shape,label,candidate_json,rule_score_json,status,created_by,approved_by,approved_at)
   values((p_module->>'layout_id')::uuid,org,p_project_id,p_room_id,coalesce(p_setup->'candidate'->>'shape','balanced'),'Measured room placement',p_setup->'candidate',p_setup->'candidate'->'score','approved',auth.uid(),auth.uid(),clock_timestamp());
   select coalesce(max(v.version_number),0)+1 into version_number from public.layout_versions v where v.project_id::text=p_project_id and v.space_id=p_room_id;
   update public.layout_versions set status='superseded' where project_id::text=p_project_id and space_id=p_room_id and status='approved';
   insert into public.layout_versions(organization_id,project_id,space_id,version_number,status,config,candidate_json,source_plan_version_id,created_by,approved_by,approved_at)
   values(org,p_project_id,p_room_id,version_number,'approved','{}',p_setup->'candidate',source.id,auth.uid(),auth.uid(),clock_timestamp()) returning id into version_id;
   insert into public.layout_invalidation_events(organization_id,project_id,source_layout_version_id,reason,metadata,created_by)
   values(org,p_project_id,version_id,'Measured furniture placement prepared room layout',jsonb_build_object('layoutId',p_module->>'layout_id'),auth.uid());
 end if;
 if p_setup is not null then
   if p_expected_updated_at is not null or jsonb_typeof(p_setup->'requirements') is distinct from 'object' then raise exception 'Invalid placement setup'; end if;
   update public.spaces set requirements_json=p_setup->'requirements',updated_at=clock_timestamp() where id=p_room_id;
 end if;
 perform 1 from public.module_instances where project_id::text=p_project_id and space_id=p_room_id and status in ('validated','approved') for share;
 select count(*) into active_count from public.module_instances where project_id::text=p_project_id and space_id=p_room_id and status in ('validated','approved');
 if jsonb_typeof(p_expected_modules) is distinct from 'array' or active_count<>jsonb_array_length(p_expected_modules) or exists(
   select 1 from public.module_instances m where m.project_id::text=p_project_id and m.space_id=p_room_id and m.status in ('validated','approved') and not exists(
     select 1 from jsonb_array_elements(p_expected_modules) e where e->>'id'=m.id::text and (e->>'updated_at')::timestamptz=m.updated_at
   )
 ) then raise exception 'Room furniture changed; review current furniture before retrying' using errcode='40001'; end if;
 if p_expected_updated_at is null then
   insert into public.module_instances(id,organization_id,project_id,space_id,layout_id,template_id,category,label,config_json,position_json,status,validation_json,created_by)
   values(module_id,org,p_project_id,p_room_id,(p_module->>'layout_id')::uuid,p_module->>'template_id',p_module->>'category',p_module->>'label',p_module->'config_json',p_module->'position_json','validated',p_module->'validation_json',auth.uid()) returning * into saved;
 else
   update public.module_instances set config_json=p_module->'config_json',position_json=p_module->'position_json',validation_json=p_module->'validation_json',status='validated',updated_at=greatest(clock_timestamp(),prior.updated_at+interval '1 millisecond')
   where id=module_id and project_id::text=p_project_id and space_id=p_room_id and updated_at=p_expected_updated_at returning * into saved;
   if not found then raise exception 'Module changed' using errcode='40001'; end if;
 end if;
 perform private.invalidate_studio_outputs(p_project_id);
 return to_jsonb(saved);
end $$;
revoke all on function public.save_room_module_atomic(text,uuid,timestamptz,jsonb,jsonb,jsonb,timestamptz,jsonb) from public,anon;
grant execute on function public.save_room_module_atomic(text,uuid,timestamptz,jsonb,jsonb,jsonb,timestamptz,jsonb) to authenticated;

-- Serialized finish revisions use the same output boundary as furniture edits.
create function public.save_studio_finish_atomic(p_project_id text,p_assignment jsonb,p_expected_revision integer default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare org uuid; prior public.material_assignments%rowtype; saved public.material_assignments%rowtype; latest integer; assignment_id uuid=(p_assignment->>'id')::uuid;
begin
 perform set_config('lock_timeout','5s',true);
 select organization_id into org from public.projects where id::text=p_project_id;
 if auth.uid() is null or org is null or not private.is_org_member(org) then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('module-save:'||p_project_id,0));
 select * into prior from public.material_assignments where id=assignment_id;
 if found then
   if prior.project_id::text=p_project_id and prior.material_id::text=p_assignment->>'material_id' and prior.target_kind=p_assignment->>'target_kind' and prior.target_id=p_assignment->>'target_id' and prior.semantic_slot=p_assignment->>'semantic_slot' and prior.status=p_assignment->>'status' and prior.module_instance_id::text is not distinct from nullif(p_assignment->>'module_instance_id','') then return to_jsonb(prior); end if;
   raise exception 'Finish request changed' using errcode='40001';
 end if;
 perform 1 from public.material_library_items where id=(p_assignment->>'material_id')::uuid and organization_id=org for share;
 if not found then raise exception 'Material scope denied' using errcode='42501'; end if;
 if p_assignment->>'target_kind'='semantic_slot' and p_assignment->>'target_id'<>p_project_id then raise exception 'Project finish scope denied' using errcode='42501'; end if;
 if p_assignment->>'target_kind'='module' then
   perform 1 from public.module_instances where id::text=p_assignment->>'target_id' and project_id::text=p_project_id for share;
   if not found then raise exception 'Module finish scope denied' using errcode='42501'; end if;
 end if;
 if p_assignment->>'target_kind'='room' then
   perform 1 from public.spaces where id::text=p_assignment->>'target_id' and project_id::text=p_project_id for share;
   if not found then raise exception 'Room finish scope denied' using errcode='42501'; end if;
 end if;
 if nullif(p_assignment->>'module_instance_id','') is not null then
   perform 1 from public.module_instances where id::text=p_assignment->>'module_instance_id' and project_id::text=p_project_id for share;
   if not found then raise exception 'Module finish scope denied' using errcode='42501'; end if;
 end if;
 select coalesce(max(revision),0) into latest from public.material_assignments where project_id::text=p_project_id and target_kind=p_assignment->>'target_kind' and target_id=p_assignment->>'target_id' and semantic_slot=p_assignment->>'semantic_slot';
 if p_expected_revision is not null and latest<>p_expected_revision then raise exception 'Saved finish changed' using errcode='40001'; end if;
 insert into public.material_assignments(id,organization_id,project_id,material_id,module_instance_id,target_kind,target_id,semantic_slot,revision,status,created_by)
 values(assignment_id,org,p_project_id,(p_assignment->>'material_id')::uuid,nullif(p_assignment->>'module_instance_id','')::uuid,p_assignment->>'target_kind',p_assignment->>'target_id',p_assignment->>'semantic_slot',latest+1,p_assignment->>'status',auth.uid()) returning * into saved;
 perform private.invalidate_studio_outputs(p_project_id);
 return to_jsonb(saved);
end $$;
revoke all on function public.save_studio_finish_atomic(text,jsonb,integer) from public,anon;
grant execute on function public.save_studio_finish_atomic(text,jsonb,integer) to authenticated;

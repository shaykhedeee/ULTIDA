create function public.append_aura_event_atomic(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; existing public.aura_audit_events%rowtype; saved public.aura_audit_events%rowtype; kind text=p_event->>'eventType';
begin
 perform set_config('lock_timeout','5s',true);
 select organization_id into org from public.projects where id::text=p_event->>'projectId';
 if auth.uid() is null or org is null or not private.is_org_member(org) or p_event->>'actorId' is distinct from auth.uid()::text then raise exception 'Access denied' using errcode='42501'; end if;
 if kind not in ('proposal_created','proposal_approved','proposal_rejected','correction_recorded') or nullif(p_event->>'proposalId','') is null then raise exception 'Invalid event'; end if;
 perform pg_advisory_xact_lock(hashtextextended((p_event->>'projectId')||':'||(p_event->>'proposalId'),0));
 select * into existing from public.aura_audit_events where project_id=p_event->>'projectId' and proposal_id=p_event->>'proposalId' and event_type='proposal_created' limit 1;
 if kind='proposal_created' then
   if found then raise exception 'Proposal already exists' using errcode='40001'; end if;
   if p_event->>'toolId'='place_modular_kitchen' and (p_event->'payload'->'proposal'->>'sourcePlanVersionId' is distinct from p_event->>'sourceVersionId' or not exists(select 1 from public.floor_plan_versions f where f.id::text=p_event->>'sourceVersionId' and f.project_id::text=p_event->>'projectId' and f.status='approved' and f.approved_at is not null and f.active_version and f.canonical_model->'scale'->>'verified'='true') or not exists(select 1 from public.spaces s where s.id::text=p_event->'payload'->'proposal'->>'roomId' and s.project_id::text=p_event->>'projectId' and s.room_type='kitchen')) then raise exception 'Approved measured kitchen lineage required'; end if;
 else
   if not found or existing.tool_id is distinct from p_event->>'toolId' or existing.source_version_id is distinct from p_event->>'sourceVersionId' then raise exception 'Proposal lineage mismatch' using errcode='40001'; end if;
   if kind<>'correction_recorded' and exists(select 1 from public.aura_audit_events where project_id=existing.project_id and proposal_id=existing.proposal_id and event_type in ('proposal_approved','proposal_rejected')) then raise exception 'Proposal already decided' using errcode='40001'; end if;
   if kind='correction_recorded' and jsonb_typeof(p_event->'payload'->'correction') is distinct from 'string' and jsonb_typeof(p_event->'payload'->'correctionCode') is distinct from 'string' then raise exception 'Correction required'; end if;
 end if;
 insert into public.aura_audit_events(id,organization_id,project_id,actor_id,tool_id,event_type,source_version_id,proposal_id,payload,provenance,created_at) values((p_event->>'id')::uuid,org,p_event->>'projectId',auth.uid(),p_event->>'toolId',kind,p_event->>'sourceVersionId',p_event->>'proposalId',p_event->'payload',p_event->'provenance',clock_timestamp()) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke insert on public.aura_audit_events from authenticated;
revoke all on function public.append_aura_event_atomic(jsonb) from public,anon;
grant execute on function public.append_aura_event_atomic(jsonb) to authenticated;

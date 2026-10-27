create table public.kitchen_quote_versions (
 id uuid primary key default gen_random_uuid(), project_id text not null,
 room_id text not null, scene_version_id text not null, organization_id uuid not null references public.organizations(id),
 revision integer not null check(revision>0), status text not null check(status in ('draft','approved','rejected')),
 document jsonb not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(project_id,room_id,scene_version_id,revision)
);
alter table public.kitchen_quote_versions enable row level security;
revoke all on public.kitchen_quote_versions from anon,authenticated;
grant select on public.kitchen_quote_versions to authenticated;
create policy kitchen_quotes_read on public.kitchen_quote_versions for select to authenticated using(private.is_org_member(organization_id));
create function public.save_kitchen_quote_atomic(p_project_id text,p_room_id text,p_scene_id text,p_expected_revision integer,p_status text,p_document jsonb,p_scene jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; current_revision integer; saved public.kitchen_quote_versions%rowtype; approved_parts jsonb; line jsonb; material numeric=0; labour numeric; margin numeric; gst numeric;
begin
 perform set_config('lock_timeout','5s',true);
 select organization_id into org from public.projects where id::text=p_project_id for update;
 if auth.uid() is null or org is null or not private.is_org_member(org) then raise exception 'Project access denied' using errcode='42501'; end if;
 if p_document->'source'->>'projectId' is distinct from p_project_id or p_document->'source'->>'roomId' is distinct from p_room_id or p_document->'source'->>'sceneVersionId' is distinct from p_scene_id or jsonb_typeof(p_document->'lines') is distinct from 'array' then raise exception 'Invalid quote document'; end if;
 if p_status not in ('draft','approved','rejected') or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid quote state'; end if;
 if not exists(select 1 from public.spaces where id::text=p_room_id and project_id::text=p_project_id and room_type='kitchen') then raise exception 'Kitchen not found'; end if;
 lock table public.scene_versions,public.module_instances,public.production_snapshot_reviews in share mode;
 if not exists(select 1 from public.scene_versions where id::text=p_scene_id and project_id::text=p_project_id and status in ('approved','locked') and scene=p_scene) then raise exception 'Scene changed' using errcode='40001'; end if;
 select coalesce(max(revision),0) into current_revision from public.kitchen_quote_versions where project_id=p_project_id and room_id=p_room_id and scene_version_id=p_scene_id;
 if current_revision<>p_expected_revision then raise exception 'Quote revision conflict' using errcode='40001'; end if;
 if p_document->'source'->>'projectId'<>p_project_id or p_document->'source'->>'roomId'<>p_room_id or p_document->'source'->>'sceneVersionId'<>p_scene_id then raise exception 'Quote context mismatch'; end if;
 if jsonb_array_length(p_document->'lines')<1 or jsonb_array_length(p_document->'lines')>2000 then raise exception 'Invalid priced lines'; end if;
 for line in select value from jsonb_array_elements(p_document->'lines') loop
   if (line->>'unitRateInr')::numeric<0 or (line->>'unitRateInr')::numeric>100000000 or nullif(line->>'sourcePartId','') is null then raise exception 'Invalid price'; end if;
   material=material+(line->>'unitRateInr')::numeric;
 end loop;
 if (select count(*) from jsonb_array_elements(p_document->'lines'))<>(select count(distinct value->>'sourcePartId') from jsonb_array_elements(p_document->'lines')) then raise exception 'Duplicate priced parts'; end if;
 labour=(p_document->>'labourInr')::numeric; margin=(p_document->>'marginRate')::numeric; gst=(p_document->>'gstRate')::numeric;
 if labour is null or labour<0 or labour>100000000 or margin is null or margin<0 or margin>1 or gst is null or gst<0 or gst>1 then raise exception 'Invalid quote rates'; end if;
 if jsonb_typeof(p_scene->'modules') is distinct from 'array' or jsonb_array_length(p_scene->'modules')=0 or exists(select 1 from jsonb_array_elements(p_scene->'modules') m where not exists(select 1 from public.module_instances mi where mi.id::text=m->>'id' and mi.space_id::text=p_room_id and mi.project_id::text=p_project_id)) then raise exception 'Scene room mismatch'; end if;
 if exists(select 1 from jsonb_array_elements(p_document->'lines') l where not exists(select 1 from jsonb_array_elements(p_scene->'moduleParts') sp where sp->>'id'=l->>'sourcePartId')) then raise exception 'Priced part not in exact scene'; end if;
 if p_status='approved' then
   if exists(select 1 from jsonb_array_elements(p_document->'lines') l where nullif(btrim(l->>'rateSource'),'') is null or length(l->>'rateSource')>500 or (l->>'effectiveDate') is null or not (l->>'effectiveDate') ~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Supplier rate evidence required'; end if;
   select to_jsonb(approved_part_ids) into approved_parts from public.production_snapshot_reviews where project_id::text=p_project_id and scene_version_id::text=p_scene_id and status='approved' for share;
   if approved_parts is null or jsonb_array_length(approved_parts)<>(select count(*) from jsonb_array_elements(p_document->'lines')) or exists(select 1 from jsonb_array_elements(p_document->'lines') l where not approved_parts @> jsonb_build_array(l->>'sourcePartId')) then raise exception 'Exact production parts must be approved before commercial approval'; end if;
 end if;
 p_document=jsonb_set(p_document,'{totals}',jsonb_build_object('materialInr',round(material,2),'labourInr',round(labour,2),'marginInr',round((round(material,2)+labour)*margin,2),'gstInr',round((round(material,2)+labour+round((round(material,2)+labour)*margin,2))*gst,2),'grandTotalInr',round(round(material,2)+labour+round((round(material,2)+labour)*margin,2)+round((round(material,2)+labour+round((round(material,2)+labour)*margin,2))*gst,2),2)));
 insert into public.kitchen_quote_versions(project_id,room_id,scene_version_id,organization_id,revision,status,document,created_by) values(p_project_id,p_room_id,p_scene_id,org,current_revision+1,p_status,p_document,auth.uid()) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.save_kitchen_quote_atomic(text,text,text,integer,text,jsonb,jsonb) from public,anon;
grant execute on function public.save_kitchen_quote_atomic(text,text,text,integer,text,jsonb,jsonb) to authenticated;

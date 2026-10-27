-- Both authoritative review and linked artifact provenance commit or roll back.
create or replace function public.review_visual_job_atomic(p_project_id text, p_job_id text, p_decision text, p_note text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare j public.jobs%rowtype; new_output jsonb; affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected','cancelled') or length(p_note)>5000 then raise exception 'Invalid review' using errcode='22023'; end if;
  select * into j from public.jobs where id::text=p_job_id and project_id::text=p_project_id for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if p_decision='cancelled' then
    if j.status not in ('queued','running') then return jsonb_build_object('status','conflict','reason','Only active jobs can be cancelled.'); end if;
    update public.jobs set status='cancelled', output=coalesce(j.output,'{}'::jsonb)||jsonb_build_object('reviewStatus','cancelled','reviewNote',p_note) where id=j.id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Cancellation write denied' using errcode='42501'; end if;
    return jsonb_build_object('status','cancelled','jobId',p_job_id);
  end if;
  if j.status<>'succeeded' then return jsonb_build_object('status','conflict','reason','Only completed renders can be reviewed.'); end if;
  if p_decision='approved' and exists(select 1 from jsonb_array_elements(coalesce(j.output->'renderQa'->'issues','[]'::jsonb)) issue where issue->>'severity'='blocking') then
    return jsonb_build_object('status','conflict','reason','Blocking render QA must be resolved.');
  end if;
  new_output=coalesce(j.output,'{}'::jsonb)||jsonb_build_object('reviewStatus',p_decision,'reviewNote',p_note,'reviewedAt',now());
  update public.jobs set output=new_output where id=j.id;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Review write denied' using errcode='42501'; end if;
  if nullif(new_output->>'artifactId','') is not null then
    update public.artifacts set provenance=(coalesce(provenance,'{}'::jsonb)||new_output)-'signedUrl' where id::text=new_output->>'artifactId' and project_id::text=p_project_id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Linked artifact write denied; review rolled back' using errcode='42501'; end if;
  end if;
  return jsonb_build_object('status','succeeded','jobId',p_job_id,'reviewStatus',p_decision);
end $$;
revoke all on function public.review_visual_job_atomic(text,text,text,text) from public, anon;
grant execute on function public.review_visual_job_atomic(text,text,text,text) to authenticated;

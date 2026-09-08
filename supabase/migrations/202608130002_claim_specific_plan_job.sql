-- A queue delivery names one job. Claim only that job so a recovery sweep
-- cannot accidentally lease a different designer's pending analysis.
create or replace function public.claim_plan_analysis_job(
  requested_job_id uuid,
  worker_id text
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if requested_job_id is null then
    raise exception 'requested_job_id is required';
  end if;
  if worker_id is null or btrim(worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  return query
  with candidate as (
    select id
    from public.jobs
    where id = requested_job_id
      and kind = 'plan-analysis'
      and status = 'queued'
      and available_at <= now()
      and attempts < max_attempts
    for update skip locked
  )
  update public.jobs job
  set status = 'running',
      attempts = job.attempts + 1,
      locked_at = now(),
      locked_by = worker_id,
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end;
$$;

revoke all on function public.claim_plan_analysis_job(uuid, text) from public;
revoke all on function public.claim_plan_analysis_job(uuid, text) from anon;
revoke all on function public.claim_plan_analysis_job(uuid, text) from authenticated;
grant execute on function public.claim_plan_analysis_job(uuid, text) to service_role;

select pg_notify('pgrst', 'reload schema');

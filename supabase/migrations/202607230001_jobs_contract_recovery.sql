-- Align the hosted legacy jobs table with the durable worker contract.
-- This migration is additive except for converting the legacy text error field
-- into structured JSONB while preserving non-empty messages.

alter table public.jobs
  add column if not exists max_attempts integer not null default 3,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

alter table public.jobs
  alter column error drop default,
  alter column error drop not null,
  alter column error type jsonb
  using (
    case
      when error is null or btrim(error) = '' then null
      else jsonb_build_object('code', 'LEGACY_JOB_ERROR', 'message', error)
    end
  );

alter table public.jobs
  drop constraint if exists jobs_attempts_valid,
  add constraint jobs_attempts_valid
    check (attempts >= 0 and max_attempts > 0 and attempts <= max_attempts);

create index if not exists jobs_claim_idx
  on public.jobs(status, available_at, created_at)
  where status = 'queued';

create index if not exists jobs_project_kind_created_idx
  on public.jobs(project_id, kind, created_at desc);

create index if not exists project_briefs_organization_idx
  on public.project_briefs(organization_id);

create index if not exists project_assets_organization_idx
  on public.project_assets(organization_id);

create index if not exists spaces_organization_idx
  on public.spaces(organization_id);

create index if not exists spaces_project_plan_idx
  on public.spaces(project_id, floor_plan_version_id);

create or replace function public.claim_jobs(
  requested_kind text,
  worker_id text,
  claim_limit integer default 1
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if requested_kind is null or btrim(requested_kind) = '' then
    raise exception 'requested_kind is required';
  end if;
  if worker_id is null or btrim(worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  return query
  with candidates as (
    select id
    from public.jobs
    where kind = requested_kind
      and status = 'queued'
      and available_at <= now()
      and attempts < max_attempts
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(claim_limit, 1), 10))
  )
  update public.jobs job
  set status = 'running',
      attempts = job.attempts + 1,
      locked_at = now(),
      locked_by = worker_id,
      updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

revoke all on function public.claim_jobs(text, text, integer) from public;
revoke all on function public.claim_jobs(text, text, integer) from anon;
revoke all on function public.claim_jobs(text, text, integer) from authenticated;
grant execute on function public.claim_jobs(text, text, integer) to service_role;

select pg_notify('pgrst', 'reload schema');

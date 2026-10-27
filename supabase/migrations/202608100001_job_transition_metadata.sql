-- Durable job observability: state transitions are explicit rather than
-- inferred from age since creation. Safe for existing jobs.
alter table public.jobs
  add column if not exists request_id text,
  add column if not exists queued_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists review_required_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists last_error_code text;

update public.jobs
set queued_at = coalesce(queued_at, created_at)
where queued_at is null;

create index if not exists jobs_request_id_idx on public.jobs(request_id) where request_id is not null;

-- Explicit lease/deadline metadata makes interrupted serverless work visible
-- and recoverable without relying on an ambiguous row creation timestamp.
alter table public.jobs
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists deadline_at timestamptz,
  add column if not exists progress_stage text;

create index if not exists jobs_plan_lease_expiry_idx
  on public.jobs(lease_expires_at)
  where kind = 'plan-analysis' and status = 'running';

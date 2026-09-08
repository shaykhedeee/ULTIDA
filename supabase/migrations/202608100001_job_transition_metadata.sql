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

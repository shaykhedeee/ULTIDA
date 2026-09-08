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

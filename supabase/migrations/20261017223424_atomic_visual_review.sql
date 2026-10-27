-- Atomic visual review status update
alter table public.artifacts add column if not exists reviewed_at timestamptz;
alter table public.artifacts add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

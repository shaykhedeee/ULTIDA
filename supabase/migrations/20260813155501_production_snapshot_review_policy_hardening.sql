-- Harden production_snapshot_reviews RLS policies
alter table public.production_snapshot_reviews enable row level security;

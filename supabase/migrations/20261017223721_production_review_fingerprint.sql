-- Add revision fingerprint to production_snapshot_reviews
alter table public.production_snapshot_reviews add column if not exists scene_fingerprint text;

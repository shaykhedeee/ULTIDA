-- Old reviews remain readable; they require a fresh review before release.
alter table public.production_snapshot_reviews
  add column if not exists source_fingerprint text;

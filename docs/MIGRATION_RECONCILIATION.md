# Migration reconciliation

## Current state (Reconciled 2026-10-27)

The `supabase/migrations/` directory has been reconciled 1-to-1 with the 44 recorded migration versions in `supabase_migrations.schema_migrations` on the canonical hosted Supabase project (`ichnyfuetcucxhxilnre`):

- `0001_ultida_phase1_foundation.sql` through `20260915060515_scene_design_intent.sql` (38 historical migrations)
- `20261017223419_room_moodboard_versions.sql` through `20261017223721_production_review_fingerprint.sql` (6 October 2026 release migrations)

All historical SQL contracts, RLS policies, durable job claim functions, and observability views (`20260829031924_release_reconciliation_and_job_observability.sql`) are preserved in their canonical remote version filenames so that Supabase Preview and `supabase db push` verify cleanly against `ichnyfuetcucxhxilnre`.

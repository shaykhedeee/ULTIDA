# Migration reconciliation

## Current state

The live Supabase project contains 36 recorded migrations. The repository has
43 historical migration files, but the histories use different timestamps for
many of the same schema changes. This happened because changes were applied
directly to the hosted database during the early release cycle.

The database schema—not a filename match—is the authority for this release.
`20260829031924_release_reconciliation_and_job_observability.sql` is the
forward-only checkpoint for all new changes.

## Safe release procedure

1. Apply the checkpoint migration to production.
2. Verify its policies, indexes, and `job_operational_health` view using the
   release checklist.
3. Do not run `supabase db push` against production until a remote schema pull
   has been committed as the canonical baseline. A migration-history repair
   only changes records; it does not make missing historical SQL safe to run.
4. Create every future migration from the checkpoint with the Supabase CLI and
   apply it once through the online release workflow.

## Historical mapping

The following live migration names correspond to repository changes but have
different timestamps: foundation/security/storage/reference-library,
layout-invalidation, live-schema compatibility, quotes/handover, project
metadata/realtime/id defaults, organization compatibility, jobs/AI approval,
AURA audit, geometry approval, studio settings/invites, reference vault,
project operations/material specifications, job-transition metadata, plan job
claim/recovery, and production snapshot reviews.

The remaining repository-only files must be verified against a pulled remote
schema before being marked applied. They must not be replayed merely to make
the migration lists look identical.

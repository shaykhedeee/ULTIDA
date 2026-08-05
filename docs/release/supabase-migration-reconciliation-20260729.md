# Supabase migration reconciliation

Date: 2026-07-29
Project: `ichnyfuetcucxhxilnre`

## Observed ledger

The linked project reports these remote migration versions without matching
local SQL files:

`0001`, `20260720020313`, `20260720020455`, `20260720021121`,
`20260720140851`, `20260720141024`, `20260720192733`, `20260722075115`,
`20260722083149`, `20260722103920`, `20260722104027`, `20260722114628`,
`20260722115526`, `20260722120235`, `20260722210403`, `20260722211323`.

The repository contains the authoritative reviewed migrations from
`202607200001` through `202607280001`. The remote ledger does not list those
versions, although the additive schema and function changes have already been
verified against the project.

## Release decision

Do not run `supabase migration repair --status reverted` and do not run an
unreviewed `db push`. The missing remote SQL is not reconstructible from the
ledger output alone, and replaying the local history could duplicate existing
objects or policies.

## Safe reconciliation procedure

1. Take a schema and data backup from the linked project.
2. Export the remote schema and retain the export as a release artifact.
3. Review each legacy remote version against that schema and the current local
   migrations with the database owner.
4. Create a new baseline migration representing the verified remote schema,
   or import the original legacy SQL if it can be recovered.
5. Re-run `migration list --linked`, then perform `db push --dry-run`.
6. Apply only additive migrations after the dry run is empty or explicitly
   reviewed; verify RLS, foreign keys, storage policies, and RPCs.

This document is the current release evidence. It does not claim the ledger
is reconciled; production promotion remains blocked until the baseline or
legacy SQL is recovered and reviewed.

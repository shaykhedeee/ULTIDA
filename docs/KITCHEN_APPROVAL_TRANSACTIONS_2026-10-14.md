# Kitchen approvals, transactions and mask verification

## Implemented

The kitchen workspace now has saved AURA proposal review and exact-part quotation review panels. Kitchen previews require the active approved plan with verified scale, a persisted kitchen, an explicit measured run within the longest measured wall, and an explicit aisle of at least 900mm. They can be created before scene compilation. Real catalog identities and approval events use the existing AURA ledger. The milestone reads current approved selection lineage, rejects wrong plans/rooms, later corrections, and insufficient template counts. This remains supervised deterministic catalog selection; it does not claim a generative model measured the room or certify opening/corner placement.

Quote GET/history and POST revision endpoints share the exact approved scene cutlist. Every part requires an explicit per-piece rate, labour, margin and GST. Commercial approval additionally requires supplier rate evidence, an effective date and the exact approved production part set. Totals are recalculated in SQL. The quotation covers panels; hardware, installation, transport, wastage and services remain explicit exclusions. A saved revision may be draft, approved or rejected, and newer revisions supersede older approval evidence.

Four database RPC migrations make AURA review, quote append, board append and render review transactional. AURA decisions serialize per proposal and prevent competing terminal approvals. Quotes serialize per project and hold scene/production sources stable. Board saves validate exact source snapshots under short SHARE locks before appending, reject stale revisions and unauthorized images/materials, and validate document structure at the database boundary. Render review commits the job and linked artifact together or rolls both back. Existing artifact provenance is retained. Anonymous invocation and cross-organization privileged appends are denied. Source-lock timeouts are five seconds; large-project throughput needs live measurement.

The renderer now uses visible ownership boundaries for edges, depth-filtered opening masks, visible skirting masks and shutter aliases covering drawer/loft fronts. Lighting anchors/channels expose a lighting slot. Both immediate and polled material edits measure actual output against the exact conditioning raster outside the owned mask. Empty/unavailable masks or excessive collateral changes block the job. Evidence records a channel delta tolerance of 12, maximum changed fraction 2%, and mean delta 4. These are explicit software tolerances, not a calibrated claim of physical colour accuracy. Polling restores the originally selected saved camera.

## Verification

- Six executable local PostgreSQL tests: atomic rollback, quote arithmetic and exact-part approval, revision/source conflicts, serialized AURA decisions, cross-organization/anonymous denial and nonempty material serialization/CAS.
- Rendering suite: 26 passing tests; image QA and outside-mask adversarial checks pass.
- API suite and compiler/export suite pass; final API run includes all new tests.
- Web and API production builds and type checks pass. No provider service was charged.
- Hosted schema reads confirmed text project IDs, UUID scenes/modules and a text-array production approval field.

## Hosted gate — blocked, not certified

Vercel's latest returned deployments are older commits. GitHub write access returned 403; CLI git has no credentials. The current integration is not deployed. Chromium installation failed again with invalid download archives. No authenticated browser refresh/PNG/PDF/DXF/cutlist/quote journey or real provider output has been certified.

Only the main Supabase branch was found, marked MIGRATIONS_FAILED; there is no separate existing staging database. No paid branch was created. Migrations were NOT applied to the hosted database. In particular, revoking direct AURA inserts before deploying the RPC-aware API would break the working older save path. Release these migrations and the API together after verifying the existing migration history and arranging an isolated acceptance project. Preserve customer data and do not replay unrelated migrations.

The remaining completion gate is hosted acceptance: deploy this exact tested commit, apply the paired migrations, sign in with authorized test identities, refresh the measured kitchen, verify RLS/conflicts, render through the configured provider, and compare the same scene/part identities across exported drawings, cutlists and saved quote. Until that evidence exists, the release remains blocked.

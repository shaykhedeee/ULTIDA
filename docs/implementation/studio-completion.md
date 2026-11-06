# ULTIDA studio completion ledger

Plan: approved conversation plan, 6 November 2026. Scope: studio release first; kitchen production certification follows.

## Baseline and decisions
- Fresh checkout, dedicated branch `codex/ultida-studio-completion-20261106`; no existing local edits.
- Main: 85c058049cd95d146e523d9a31275f61902daea9.
- Production: dpl_6AuJe6qAQCAaSbXE2u3f9JB7sgow, source fe2cf8473b8c3dca83de78df2cf70bd1f847c260; fetch rejected (not our ref).
- Ruling: use main and preserve current placement/fit/compilation paths; do not substitute a different commit for e480272. User chose main reconciliation.
- Hosted Supabase migration history inspected read-only: October room boards, visual review, quotes, AURA review and production fingerprints are present. Do not replay them.
- Pre-flight: module edits already use expectedUpdatedAt/CAS and compiler/clearance checks; placement, requirements, layout preparation and invalidation are separate operations. Room save queue exists but module edits do not use it. Furniture undo/redo and reload-safe edit drafts are absent.
- No hosted authenticated acceptance or physical workshop acceptance has been performed. These remain release gates, not inferred from passing builds.

## Work items
1. Reconcile baseline, builds, tests and migration contracts.
2. Reliable module editing: serialized autosave, recoverable drafts, conflict resolution, undo/redo, post-placement selection.
3. Studio presentation, resize interactions, materials and review/export gating.
4. Transactional placement/edit operations and retry identity.
5. Whole-branch verification, release manifest and hosted acceptance where access permits.
6. Kitchen milestone gaps: supplier evidence, cross-output consistency and workshop validation.

## Evidence
Pending baseline build and suite.

## Implementation and review, 6 November 2026
- Implemented a docked inspector, plan/elevation/3D navigation, contextual room geometry tools, searchable finishes, post-placement furniture selection, and accessible move/resize handles. The measured canvas no longer draws invented default furniture.
- Furniture dimensions and positions save after field completion/idle or pointer release, with per-room serialization, retained user-scoped drafts, explicit conflict resolution, and undo/redo for dimension/position edits. Finish selections retain failed drafts and use revision checks. Review is blocked by unresolved retained drafts or active placement.
- Added an invoker-rights migration to commit placement, required category, prepared layout and downstream invalidation together, and to serialize finish assignments with optimistic revision checking. APIs require this migration and must be released together with it.
- Ruling: retain backward compatibility for existing specialized material screens that do not send an expected revision. Those older callers do not yet receive the studio's conflict handling.
- The final independent review found recovery, rapid history, cross-project response, review race and mobile layout issues. Regression tests were added for those findings and fixes applied. Local PGlite tests do not establish actual hosted RLS behavior.
- Baseline build passed. Initial baseline browser tests failed because Chromium was absent; installed Playwright Chromium, then the full test run passed. Six Chromium fixture scenarios passed with mocked authentication/API; this is not hosted authenticated acceptance.
- GitHub connector branch creation and CLI push dry run both returned 403. Production is unchanged. Hosted migration was not applied because its compatible API cannot yet be released and acceptance has not been completed.
- Still open: room-wide autosave and conflict handling; undo/redo for placement, deletion, duplication and finishes; supplier specification verification, true manufacturing output validation, a real kitchen fixture and workshop acceptance. Do not claim the full plan or production release complete.

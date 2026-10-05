# Launch audit — 2026-10-05

## Verified source and history

Remote unification and launch-20261004 both resolve to 5b8e0dd4d3a1ec2a541d84f95ce9efab7dfa91c2. Main remains a281f4542fbf73b65f22ac34482a608b8b33a2a9. Unification was force-updated and diverges from locally retained d883958. Do not overwrite either history or blindly choose entire conflicting files. A trial merge was aborted without losing changes; this isolated audit branch starts at the reported latest source.

## Blocking findings and implementation

1. Spaces reported successful placement before any API response, ignored response failures, and preserved phantom modules in browser storage. Restore server-confirmed placement: authenticate, persist room requirements, validate approved layout, await POST and require the returned module ID before adding a placed item or invalidating shell state.
2. Library used proj-villa-3bhk when no project existed. Require explicit project context; do not use an unrelated remembered project.
3. Pending-module ingestion immediately cleared the queue and declared success without awaiting placement. Arm a visible placement preview instead; clear the queue only after successful server save.

## Next integration gates, in order

- Reconcile prior opening classification, EXIF transforms, uncertain-opening flags, room framing, saved completion status, fabricated 3D removal and repeat-approval validation individually. Recent remote work does not contain these retained corrections.
- Test valid/rejected placement, selected-room/wall identity, exact previewed offset, save/reload and stale-scene invalidation through authenticated hosted routes.
- ClientPresentationPortal approval is browser-local, and its verified schedule contains static example units. Replace with server-owned revision approval and actual saved scene data before exposing sign-off as release authority.
- Verify supplier codes, swatches, allowed uses and versioned material records for new laminate entries. Marketing names, hex colours and an IS grade string are not evidence of a supplier-certified product. No certification is inferred here.
- Remove hardcoded villa storeys/voids and unrelated comparison rooms from production workflows; persist real structural geometry first.
- Exercise Cloudflare generation, durable image retrieval, retry/status, actual pixel QA, private PDFs, workbook, panel labels and nesting against one approved revision. Builds and mocked tests cannot satisfy this gate.
- Offline mode must explicitly label unsaved local drafts and unavailable provider features; online mode must report persistence failures rather than convert them into local success.
- Dashboard should prioritize resume active project and its next saved-state action. Hide demo/sample shortcuts behind an optional examples section. Verify every summary derives from saved data before decorative redesign.
- Run desktop/mobile browser checks and full reliability on the integrated immutable commit; review migrations and rollback; only then merge main and verify deployment SHA.

## Verification

Verification results are recorded after execution; no all-features or launch-ready claim is made.

- Production dependency audit on 2026-10-05 reports four advisories: qs (moderate), react-router and react-router-dom (high), sharp (high). Resolve with targeted compatible upgrades and regression checks; do not use blanket force upgrades.
- Fresh dependency install exited 0. All package builds exited 0. Earlier checks run while dependencies/build artifacts were incomplete failed and were rerun after prerequisites.

- Frontend build exited 0; 12 placement/catalog checks passed, zero failures/skips. These include a browser catalog fixture, not hosted private project persistence.
- Build identifies a Node-only zlib import from the workbook writer entering a browser bundle. Audit browser workbook calls and route downloads through the authoritative API; successful bundling does not prove Excel downloads work.
- Fixed the invalid grid-templateColumns CSS declaration in the client portal. The existing large Three.js chunk remains a performance warning.


## Follow-up: approval and browser boundary

- Restored source revision checks for idempotent approval and the compare-and-set draft write. A stale or concurrently invalidated scene cannot become approved from the old client badge.
- Approval regressions: 6 passed, 0 failed, 0 skipped. API TypeScript check exited 0.
- CNC now imports the browser-safe drawing entry point. Frontend build exited 0 and no longer reports externalized node:zlib. The Three.js chunk-size warning remains.
- Confirmed live presentation routes point to ClientPresentationPortal with default fictional project/client values, example rooms and browser-local sign-off. This must be replaced with saved project presentation and server-owned approval before client release.


## Saved presentation follow-up

- Replaced live sample portal with authenticated project name, latest saved scene, actual configured modules and private images from that exact revision. Removed default fictional client/project, unrelated panoramas, static verified unit schedules and local signature certificates.
- Current render artifacts use ready status; stale and mismatched revisions are excluded. Signed URLs come from the project render API.
- Production PDF download uses the authenticated, revision-revalidated export endpoint. Loading, missing access, missing design, retry and export failures are visible. Client legal sign-off is not claimed or implemented by browser storage.
- Frontend production build exited 0. Production dossier endpoint suite: 4 passed, 0 failed, 0 skipped. Hosted screenshots and private project render/download acceptance remain outstanding.


## Dependency and opening correctness follow-up

- Updated API/provider sharp to ^0.35.5 and web router to ^7.18.2; refreshed resolved dependencies. Production-only npm audit reports zero known vulnerabilities. Full audit still reports five development-tool advisories (miniflare/wrangler, their sharp/undici dependencies, and postcss); compatible audit fix did not resolve these. Do not claim the whole dependency tree is clean.
- Restored optional explicit door/window kind in canonical plan schemas and corrected compiler classification so a door sill cannot turn it into a window. Window height remains measured head minus sill.
- Plan-core and scene-compiler builds passed. Compiler suite: 16 passed, 0 failed, 0 skipped. Provider conditioning suite: 5 passed, 0 failed. API and provider TypeScript checks passed; full API tests passed; frontend build passed. Logs remain local under .tmp-security-*.
- Existing main/integration deployments are not updated by these audit-branch commits. Hosted acceptance and remaining source-history reconciliation are still required before main release.


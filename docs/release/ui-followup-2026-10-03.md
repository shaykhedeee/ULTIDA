# UI follow-up — 2026-10-03

## Implemented and pushed

- `f60e133`: saved stage completion takes precedence over the active route; connector completion uses saved stage status; delivery does not claim handover readiness until all stages are complete. Empty 3D offers one preparation action before advanced controls appear.
- `42909f7`: both Fit Room and Fit Plan controls reset zoom/pan consistently. Selected-room framing uses that room's boundary and centres it in the viewport. Full-plan framing includes the backdrop's origin plus its size. Forward/inverse projection share one calculation. Library browsing precedes the collapsed optional reference-upload form; project context and upload handlers remain intact.
- `6c17187`: removed the live viewer's fabricated first-floor slab, atrium, chandelier, staircase and static floor controls. They were appended by default to saved projects without persisted scene evidence. Snapshot names now identify the actual project instead of a sample residence.

## Evidence and limits

- Frontend TypeScript/Vite build passed after framing/library changes.
- Projection regressions: 2 passed; wide/tall/negative-origin bounds and zoom/pan coordinate round-trip.
- Placement/library structural regressions: 10 passed.
- Saved-scene architecture regression: 1 passed. This is a source guard, not a rendered-image measurement.
- Frontend TypeScript check passed after removal of sample architecture.
- Vercel reports `6c171879c42cf5ffb21827004b6e9f959aad6a6a` READY at `https://ultida-i65n5blx7-shays-projects-4d072282.vercel.app/`.
- The earlier authenticated candidate reproduced the Fit Room defect: its bottom control changed zoom to 150%. The latest candidate requires Vercel sign-in, so updated authenticated screenshots, exact drop/save tests, real AI output and production exports are still pending.
- The full reliability run is recorded locally in `.tmp-reliability-ui-followup-20261003.log`. It started before the final viewer cleanup; the focused final-change checks above cover that cleanup. Do not call it an immutable release-commit run.
- Full reliability finished with exit 0: across 60 TAP summaries, 509 tests, 507 passed, 0 failed, 2 skipped. Both skips were independent Python DXF checks because the default shell resolves Python to the Store alias. The browser catalog fixture ran; it does not establish hosted authentication or actual provider generation.
- Reran `node --import tsx --test apps/api/test/dxf.test.ts` with bundled Python on PATH and the existing isolated ezdxf dependencies: exit 0, 12 passed, 0 failed, 0 skipped. No dependencies were installed globally.

## Still required before launch

Use the outstanding gates in `implementation-2026-10-01.md`: authenticated save/reopen/revise/render/export acceptance, transactional invalidation, free-position island integration, held-out analyzer evaluation, final-document/workbook inspection, secondary-tool review, and release/rollback checks. Shared-production Preview remains write-protected. No main merge or production release is claimed here.

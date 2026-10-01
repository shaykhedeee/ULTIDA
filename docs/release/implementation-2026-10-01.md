# ULTIDA implementation ledger — 2026-10-01

This is an implementation and verification record, not a launch approval. Previous reports and reference documents are requirements to verify, not evidence that a feature works.

## Source and release state

- Started on `codex/ultida-unification` at `a281f4542fbf73b65f22ac34482a608b8b33a2a9`.
- `git ls-remote origin refs/heads/main refs/heads/codex/ultida-unification` confirmed both remote branches at that SHA before these changes.
- Existing local reference PDFs, spreadsheets, and temporary audit files were preserved.
- No database migration, project deletion, production deployment, or main merge was performed in this pass.
- The integration branch now triggers the same Linux/Node 24 reliability workflow as main. CI results must be checked against the pushed SHA.

## Implemented

| Requirement | Live implementation | Evidence / practical limit |
|---|---|---|
| Save furniture against real room walls | Spaces wall picker, elevation controls, floor doorway references and feature-wall placement use persisted wall IDs rather than temporary boundary IDs | API still validates the active approved plan and exact placement; hosted persistence remains to be exercised |
| Show a spatial preview before saving | Catalog's primary action is **Preview on plan**; direct save is a secondary action available when a wall is selected | Existing click and drag controller is retained; source checks and build are not browser interaction evidence |
| Report placement failures honestly | Placement prerequisite calls and the POST share an error handler; starter furnishing counts only successful saves and first selects the target room | Failed save cannot become a generic "furnished" result |
| Do not fabricate architectural detections | Removed room-type-based insertion of doors/windows and the all-room auto-verification claim; **Review doors & windows** opens measured correction controls | Actual plan analyzer detection remains separate; furniture suggestions are labelled editable ideas |
| Unknown openings block measured fit | Catalog reconciliation receives actual numeric opening offsets/widths; missing values become invalid rather than guessed 900 mm doors | Existing fit validator remains authoritative |
| Optional design advice does not block measured workflow | Vastu remains advice; readiness blockers cover measurement and plan checks | Vastu scores are not fabrication evidence |
| Cloudflare-first analysis with explicit paid-provider eligibility | Shared `eligiblePlanVisionProviders()` drives live API analysis and the agent provider factory | Paid keys or primary-provider preference alone never opt in; flags are documented in `.env.example` |
| Honest provider readiness | API real-image readiness requires configured **and eligible** generation capability | Configuration does not prove a live provider request succeeded |
| Validate actual render evidence | Edge alignment remains a dimensionless score; missing calibrated camera pose, semantic invented-object checks, divisions and skirting counts are unmeasured warnings | Live pixel checks cannot claim camera displacement in mm or absence of invented objects; AI images require review |
| Consistent wall openings | Shared `wallSolids()` subtracts measured opening rectangles in browser 3D and deterministic render | Tests cover stacked door/transom, overlap union, order independence, whole wall and invalid dimensions |
| Preserve measured opening elevation and size | Browser wall/opening meshes use saved base elevation; narrow openings are not expanded to a minimum 200 mm | Decorative leaves/glass remain presentation geometry, not manufacturing specifications |
| Validate mounting height | API wall-anchor resolver rejects negative/nonfinite supplied mounting levels | Missing mounting level retains the existing floor datum of zero |
| Review document before manufacturing release | Production workspace exposes approved **Design Review Drawings (PDF)** even without cutlist parts | Uses existing authenticated, persisted approved-scene endpoint; production dossier retains its manufacturing gate |
| Patch known dependencies | Updated Sharp, React Router, Wrangler and PostCSS and refreshed transitive lockfile | Root audit reports zero known vulnerabilities; does not replace auth/permission testing |

All geometry-changing paths changed here reuse the existing API placement/geometry invalidation rather than adding another client-only authority. Atomic invalidation and save remain a separate release task.

## Verification actually run

The host uses Node 22.23.2; declared and CI runtime is Node 24. Linux/Node 24 verification is not claimed from the local run.

| Command | Exit / output |
|---|---|
| `npm run reliability` | **0**. Across 59 TAP summaries: **488 tests, 486 passed, 0 failed, 2 skipped**. Includes package checks/builds, app builds, drawing, compiler, core, API, AURA, render, provider and room suites. Full local log: `.tmp-launch-reliability-final.log` |
| `node --import tsx --test packages/scene-core/test/wall-solids.test.ts apps/api/test/module-anchor.test.ts apps/api/test/plan-provider-policy.test.ts apps/api/test/visual-jobs-qa.test.ts` | **0; 13 passed, 0 failed, 0 skipped** |
| `node --import tsx --test apps/api/test/architecture.test.ts` | **0; 11 passed**. Paid-provider fixtures explicitly opt in |
| `npm run build --workspace=@ultida/render-pipeline` followed by its `npm test` | **0; 22 passed, 0 failed, 0 skipped** after final QA edits |
| `npm run build --workspace=@ultida/web` | **0** after final UI/mesh edits. Vite retains a >600 kB chunk warning; optimization remains open |
| `node --test apps/web/test/spaces-placement-rail.test.mjs` | **0; 10 passed**. Structural checks only |
| `npm audit --json` | **0; info/low/moderate/high/critical all 0**. Local report: `.tmp-launch-audit-final.json` |
| `node --import tsx --test apps/api/test/dxf.test.ts` with a real bundled Python on PATH and local `ezdxf==1.4.4` available | **0; 12 passed, 0 failed, 0 skipped**. This independently reran the two Python checks skipped by the default reliability environment. Local log: `.tmp-launch-dxf-test.log` |
| `git diff --check` | **0**; CRLF conversion notices are not failures |

The first reliability attempt failed an older test that treated a Gemini key as automatic permission. That fixture was corrected to test explicit opt-in; the final run above passed. A subsequent web build caught the local Scene wall type omitting `baseElevationMm`; the type and explicit demo datum were corrected, and the final build passed.

## Remaining release blockers, in execution order

1. **Versioned placement transforms.** `resolveModuleWallAnchor()` and SVG/drawing footprints use positive plan yaw. `scene-module-parts.ts`, deterministic boxes and compiled Three meshes currently use a negative plan-yaw convention. Fix them together, with four wall directions, local/world inverse and cross-output tests. Existing compiled scenes require an explicit convention/version or recompilation; changing one sign in isolation is unsafe. Add room-polygon containment, inward footprint, collision checks and a free-position contract for islands through the same server validation.
2. **Transactional persistence and staleness.** Prove room creation/edit, bay/floor/material persistence, refresh, retries and concurrent edits. Make accepted edit + approval/render/export invalidation atomic; current fail-closed multi-write behavior is not a transaction. Compare revision/content fingerprints rather than relaxing stale checks with a time tolerance that could permit real edits.
3. **Authenticated hosted acceptance.** The browser tool reported `apps: []`, `browsers: []`. No authenticated project, real Cloudflare render, durable image download or private export was exercised in this pass. Configuration/health and mocked provider tests cannot satisfy this gate. Retain the shared-production Preview write guard.
4. **Browser usability.** Exercise 1440×900, 1280×720, 1024×768 and 390×844. Verify zoom/pan/click cancellation, exact drop coordinates, keyboard placement, visible errors and no obscured actions. Source assertions do not prove usability. Complete the canvas/catalog/inspector layout and measured reference screenshots before promising premium UI.
5. **Analyzer benchmark.** Establish held-out opening precision/recall, boundary/dimension error and correction effort. Verify PDF page selection, coordinate transform provenance, low/high resolution convergence, furniture vs wall discrimination and persistent correction. Do not promise a numeric accuracy improvement without the measurements.
6. **Presentation and manufacturing evidence.** Visually inspect generated PDFs and workbook against the supplied reference files. Verify common panel IDs across workbook/labels/nesting, 6/18 mm backing, internal/external laminate quantities, grain and CNC drill geometry. Validate every live export against the same approved room revision.
7. **Connected secondary tools.** Audit commercial estimate pricing authority/persistence, AURA's saved room context, moodboard persistence, CNC, room builder, converter, calendar, invoices, team/settings and presentation routes. Provisional rates and heuristic proposals must not be labelled verified commercial/AI output.
8. **Inventory and release.** Finish the attachment/repository license-and-source inventory; do not import unlicensed assets. Rehearse migration/rollback, require passing remote CI and hosted acceptance, review the PR, then merge and deploy the exact release SHA. Keep existing branches until useful work and deployed versions are accounted for.

## One project acceptance journey

Upload plan → confirm scale → correct/save openings → select only the needed room → save wardrobe + free-position island → resize/finish → refresh and reopen → review exact component 3D → approve saved revision → generate/retrieve actual Cloudflare AI presentation image → download/inspect design PDF → release reconciled production workbook, labels, nesting, DXF and dossier → edit one dimension and verify previous approvals/outputs become stale.

The app is ready for launch only when that hosted journey succeeds without hidden manual intervention. This ledger deliberately keeps unproven tasks open.

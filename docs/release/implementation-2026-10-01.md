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

1. **Placement validation follow-up.** Versioned yaw transforms are implemented below: new compiles use positive plan yaw across compiler, render, browser meshes and elevation extraction; untagged stored scenes retain their legacy negative-yaw meaning. Remaining here: room-polygon containment, inward footprint/collision checks and a free-position contract for islands through the same server validation.
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

## Follow-up implementation — 2026-10-02

- Added `metadata.geometryConvention` to the scene contract as an optional compatibility field. Untagged persisted `scene.v1` scenes resolve to `legacy-negative-plan-yaw`; fresh compiler output is tagged `plan-positive-yaw-v2`.
- Shared scene-core transform helpers now drive stored module-part compilation, deterministic image geometry, Three.js compiled part orientation, fallback envelope position/origin, and inverse component coordinates in design-drawing elevations. The drawing plan projection remains positive yaw, matching the new wall-anchor direction convention.
- Added regression coverage for legacy scene parsing, 0/90/180/270 degree module transforms, exact Three.js part bounds, reversible elevation-local coordinates, and equivalent deterministic render hashes across legacy/v2 representations.
- `npm run reliability` exited **0**: 59 TAP summaries, **493 tests, 491 passed, 0 failed, 2 skipped** (the default-runner Python/ezdxf checks; the previous ledger records those checks rerun successfully using bundled Python and ezdxf).
- Additional focused verification: API and web builds passed; render-pipeline build/tests passed (**23/23**); combined transform, API, compiler, drawing-projection checks passed (**28/28**); elevation inverse test passed (**1/1**); `git diff --check` passed. The web bundle still reports the known Three.js chunk-size warning.
- This follow-up is not launch approval. Authenticated hosted project persistence/render/export, room-polygon/free-position collision validation, analyzer held-out metrics, four-viewport visual testing, and release/merge gates remain open as listed above.

## Follow-up implementation — 2026-10-02 (room footprint validation)

- Module placement and edits now pass the canonical room ID into the same API clearance gate. Where the approved plan includes `worldPolygon` in millimetres, the gate checks all four rotated module-envelope corners and boundary-edge crossings before accepting the placement. Concave boundary notches therefore cannot be crossed just because the module corners happen to fall inside the room.
- The same gate detects oriented footprint overlap and a 20 mm clearance violation between units attached to different walls, while preserving the existing wall-offset/opening checks for same-wall units. The module edit endpoint uses the same room-scoped validation.
- Verification: `npx tsx --test apps/api/test/module-placement.test.ts apps/api/test/module-edit.test.ts` — **13/13 passed**; `npm run check --workspace=@ultida/api` — **passed**; `npm test --workspace=@ultida/api` — **exit 0**, all API suites passed (two Python/ezdxf checks skipped because Python is not on this runner's PATH); `npm run reliability` — **exit 0**, 59 TAP summaries, **495 tests, 493 passed, 0 failed, 2 skipped** (same Python/ezdxf environment skips; `.tmp-reliability-room-footprint.log`).
- Limitation: older approved plans without `worldPolygon` retain prior placement behavior because `sourcePolygon` is not proven to be canonical millimetres. The API still has no free-position island anchor contract, and this check follows the compiled positive-yaw envelope rather than inferring a missing wall interior normal. These remain open release blockers; do not describe placement validation as complete.
- GitHub Reliability workflow for `c0e7ec6371caff4e46ce2355819b35f5c8003f25` completed successfully: [run 36974753332](https://github.com/shaykhedeee/ULTIDA/actions/runs/36974753332). The current room-footprint commit `ed3adf6743311fde70c2fd93fa6514aa559d428b` also passed remote Reliability: [run 36975768134](https://github.com/shaykhedeee/ULTIDA/actions/runs/36975768134).

## Follow-up audit — 2026-10-03

- Fixed a degenerate closing edge in the room polygon containment test: a zero-length segment previously treated every point as lying on its boundary. Added a wholly external footprint regression. Placement tests: **7/7 passed, exit 0**.
- AURA now exposes preview actions only for the tool named by the supplied action route, displays proposal details, resets conversation on project switching and aborts chat/preview HTTP requests after 30 seconds. Web TypeScript/Vite build: **exit 0**; known large Three.js chunk warning remains.
- AURA remains a rules-based development parser, not provider-backed AI chat. Further confirmed blockers: hardcoded room/width/material proposal context, oversized kitchen selection when remaining run is smaller than a candidate, ignored scene-query errors, and approval audit integrity/atomicity. Do not describe these as complete or infer AI functionality from provider readiness.
- Production health reports main at `a281f4542fbf73b65f22ac34482a608b8b33a2a9`, Cloudflare eligible and durable jobs ready. This proves configuration only, not a successful authenticated render or export journey. Integration CI at `9d8580d080421b152c1ec6202c58dc531c642765` passed before these edits.

## Continued verification — 2026-10-03

### Analyzer photo orientation

- Unknown CV wall gaps are now exposed as review items in the live analysis service and reconciliation flags, with location/width and no invented door/window classification. Analyzer/reconciliation tests: **32/32 passed**, API type check **exit 0**. These remain detection evidence, not confirmed architectural geometry.

- Reproduced an EXIF-rotated photo failure: native tracing rotated pixels upright but returned stored dimensions (900x600 instead of 600x900). Fixed upright source dimensions before normalized detection and coordinate restoration. Invalid undecodable dimensions now fail explicitly rather than guessing a 1000px source.
- Grayscale/RGB evidence equivalence passed without implementation changes. Added regressions for rotated photographs and physically rotated source equivalence, allowing at most one source pixel of raster resampling difference. Existing 4x-resolution convergence checks remain.
- `node --import tsx --test apps/api/test/fast-wall-tracer.test.ts apps/api/test/plan-reconciliation.test.ts apps/api/test/plan-job-coordinate-reconciliation.test.ts`: **exit 0, 22 passed, 0 failed/skipped**. API TypeScript check: **exit 0**.
- This is not an accuracy multiplier claim. Held-out real-plan precision/recall, dimension association and correction effort are still required before quantifying improvement.

### Opening pipeline follow-up

- Traced the mismatch beyond the API adapter: canonical door/window Zod schemas stripped the explicit `kind` field. The schemas now retain optional literal classifications while preserving older record compatibility. Older canonical doors can be identified by their measured height; older windows by measured sill/head ranges with no door height. A mechanism alone is not classification evidence. This corrects the previous adapter's overly conservative treatment of complete legacy door records.
- Room geometry saves now reject missing width/offset/door height/window elevations rather than substituting 900 mm width/sill, zero offset, or 2100 mm height. A measured head height can be calculated from measured sill plus measured height. No persisted project data was mutated.
- The scene compiler and bay reconciliation respect explicit classification; an optional door threshold no longer converts a door into a window. Opening regression **4/4 passed**, scene compiler **23/23 passed**, plan-core build and API type check **exit 0**. Observed red: canonical schema round-trip returned `unclassified` instead of `door` before the fix.
- Dependency audit **exit 0; zero known vulnerabilities**. Full reliability run `.tmp-reliability-opening-20261003.log` completed **exit 0**. Placement/edit/preflight focused checks also passed **16/16**. The run began before this batch finished; final focused API/compiler checks and the later full API suites cover those edits. Hosted UI/render/export acceptance remains open.

- Candidate `c9b7b4551b17bb9f23316a16fa025cdf5f0fc628` passed remote Reliability (run 37065613490) and Vercel deployment `dpl_CmshkqSNeFQRwEpjd9Wu5wkJ1CAh` reached READY. Authenticated candidate loads saved Spaces without the previous project-context failure. Read-only DOM checks at 1440x900, 1280x720, 1024x768 and 390x844 found no page-wide horizontal overflow; these do not replace visual/interaction acceptance.
- Browser revealed six incorrectly drawn windows: persisted openings had only `type: hinged`, no door/window classification. Fixed the active-plan projection to preserve explicit classifications and measured sill height aliases, mark ambiguous mechanisms unclassified, and draw neutral dashed openings with a correction message rather than fabricated window symbols. Regression tests 2/2 passed; web build and API TypeScript check passed. Existing keep-out geometry remains protected. Stored classification/offset accuracy still needs designer review; no project data was changed.
- Release PR creation is blocked: GitHub connector returned 403; browser account shayankhadir failed creation with “must be a collaborator.” No PR was created or merged. Preview remains write-protected against the shared production database. Real hosted AI image, durable retrieval, exports and stale-output journey remain unverified.

- Full `npm run reliability`: **exit 0, 498 tests, 496 passed, 0 failed, 2 skipped**. Both skips were Python DXF checks. Reran `apps/api/test/dxf.test.ts` with bundled Python and the existing isolated `.tmp-launch-dxf-python` dependencies: **12/12 passed, zero skips, exit 0**. Logs: `.tmp-reliability-20261003.log`, `.tmp-dxf-20261003.log`.
- Additional final-change checks: AURA **9/9 passed**, AURA build passed, API TypeScript check passed, web TypeScript/Vite build passed. The full suite started before this batch finished; final focused checks cover the subsequent changes. Do not describe it as an immutable release-commit run.
- Hardened AURA review identity against changed tool/source scene; kitchen selection now keeps within the requested run and preserves unresolved remainder. Unsupported wardrobe/pooja/crockery requests no longer become unrelated TV-unit actions. Scene read errors return an explicit service failure rather than a false approval prompt; unsupported intents receive no unrelated executable fallback.
- Authenticated hosted browser now works. Existing project `b1ed6cfe-2965-4437-84e6-0f53dfd54a8f` loads, but design-context fails. Verified live `projects` columns through Supabase: `active_floor_plan_version_id` exists, `floor_plan_version_id` does not. Corrected the API projection accordingly. No database mutation was needed.
- Hosted scene compilation returned without a scene while its status remained "Compiling". Fixed the empty compile-result recovery message in SceneStudio. These fixes are not deployed to production yet; hosted render/export acceptance remains blocked until the candidate is deployed and retested.

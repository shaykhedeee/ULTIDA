# ULTIDA: structural completion and module-placement plan

Date: 2026-09-30. Status: evidence-based plan, not a completed release.

## 1. Evidence and limits

Verified local HEAD and remote `codex/ultida-unification`:
`459c8326b13b36367dbc90ac79a0a16bcb3d21bf fix: connect assisted plan analysis and render feedback`.
Remote main: `24dcb270bfaf914f5f4bf65c47df4d53b77324a7`.

The working tree contains substantial uncommitted changes to API persistence, room compilation, drawings, library, and UI. Preserve these; they are part of the candidate being assessed, not part of the verified remote commit. Do not merge or deploy on the strength of older completion reports.

Inspected placement UI, room persistence, module anchor/edit validation, live module creation endpoint, scene compile/readiness paths, render QA call sites, route ownership, existing completion documents, and the conversation's requirements. This is a targeted architecture audit; it does not certify every file, historical attachment, external repository, hosted account setting, or browser journey. Earlier documents contain findings superseded by local changes. Their evidence must be refreshed before reuse.

Current verification:

```text
node --import tsx --test apps/api/test/module-placement.test.ts apps/api/test/catalog-room-placement.test.ts
exit 0
tests 6; pass 6; fail 0; skipped 0
```

These tests establish helper and catalog behavior. They do not prove authenticated placement persistence or production deployment health.

## 2. Why module placement can fail

| Priority | Evidence | Consequence | Confidence |
|---|---|---|---|
| Critical | `SpacesWorkspace.tsx` around 775–811 constructs `${room.id}:edge:N` walls and returns them when too few detected walls match. `module-anchor.ts` accepts only walls present in the active approved plan. | The user can select or preview a wall that cannot be saved. API returns `MODULE_WALL_NOT_FOUND`; room design-input validation can also reject its schedule. | Confirmed incompatible code paths; exact failing user request not captured. |
| Critical | `evaluateDropPreview()` checks width/openings/distance; `prepareModulePlacement()` additionally checks verified calibration, room wallRefs, height, neighbours, and 150 mm clearance around floor-level openings. | A green preview is not proof of server acceptance. A nearby cabinet, door margin, or room lineage can reject it. | Confirmed. |
| Critical | Creation requires an approved active plan, current persisted space, and approved layout. UI placement can invoke `persistRoom()` and `ensureApprovedRoomLayout()` before insertion. | Several hidden prerequisites can stop a simple Place action; the user sees a status sentence without a clear recovery path. | Confirmed. |
| Watch | Successful insertion appends to `aiProposals`; room selection clears proposals. Spaces has no module-list fetch matching App's saved module lookup. | Canvas presentation is coupled to transient suggestions instead of a dedicated saved-instance collection. Room switching/reload needs an authenticated regression test. | Confirmed state coupling; persistence failure itself remains unverified. |
| Watch | `getInitialRoomFurniture()` transforms proposal world coordinates using modulo room dimensions and clamps values. | Preview coordinates can differ from the saved placement, particularly for rooms away from the plan origin. | Confirmed transformation; visual extent requires reproduction. |
| Watch | `resolveModuleWallAnchor()` and compile lineage currently require wall anchors; preview says modules cannot occupy open floor. | Islands/freestanding furniture cannot have a genuine free-placement workflow even if their template dimensions compile correctly. | Confirmed wall-only path. |

Do not disable calibration, room membership, collision, or approval validation to make placement appear successful. Capture the actual response code, project/plan/space/wall IDs, requested offset, and current revision before changing the failing path. Do not log credentials.

## 3. Best interaction: one room, visible placement, explicit saving

The default journey is **Choose room → Choose furniture → Position and adjust → Save → Review 3D → Approve → Render or download**. Keep the whole plan available as an optional context view. Only included rooms enter the design scope.

Desktop: compact project/room header; collapsible catalog on the left; largest area reserved for the room; selected-item inspector on the right. Small 2D/3D controls. One contextual primary action. Mobile: catalog/canvas/inspector tabs with a reachable save action, no overlapping docks.

Click-to-place is primary: choose a template, show its true footprint under the pointer, snap to an eligible wall, edit offset or dimensions, and confirm. Escape cancels. Drag-and-drop uses the same controller as an optional shortcut. Keyboard controls offer wall selection and numeric offset; dragging must not be required.

The preview shows measured width/depth, orientation, wall label, offset, and the specific blocker. Display separate **proposal**, **unsaved placement**, **saving**, **saved**, and **save failed** states. A network failure retains the draft and offers Retry; it must never manufacture a saved badge.

For a wall-based unit, snap to canonical saved wall segments with a verified room association. Polygon outlines may remain visible but must never masquerade as saved wall IDs. If no measured wall is associated, offer **Review room walls**, not an invented placement target.

For an island or other free item, use room-local position and rotation with polygon containment, opening-access and collision checks. This needs an explicit contract/compiler change; it cannot be delivered only by changing the canvas.

## 4. Structural ownership

| Owner | Single responsibility |
|---|---|
| Plan review | Source image/PDF, calibration, corrected measured geometry, opening evidence and approval |
| Room scope | Selected/included rooms, canonical room-to-wall association, storey and geometry revision |
| Placement domain | Pure candidate validation against a supplied measured room snapshot |
| Placement controller | Armed template, pointer transform, candidate, commit/cancel, save/retry |
| Saved-room data | Server instances, materials, bay schedules, floor surfaces and revision; query invalidation after edits |
| Module compiler | Parametric component geometry, independent parts, manufacturing dimensions |
| Scene compiler | One saved room revision, geometry/material completeness and reconciliation |
| Scene review/render | Authoritative 3D review and separately tracked AI presentation jobs |
| Production | Approved revision, certified panels, shared projection, workbook/labels/nesting/dossier |

Extract these seams incrementally from Spaces. Avoid replacing the entire component or introducing parallel stores. Keep AI suggestions and reference images outside saved module-instance state.

Name IDs explicitly: `planRoomId`, `spaceRecordId`, `moduleInstanceId`, `templateId`, `wallId`, `planVersionId`, and `sceneVersionId`. World millimetres are authoritative; room-local and screen coordinates are transformations, never modulo/clamped replacements. Use actual SVG transforms for pointer conversion under zoom/pan.

## 5. Ordered implementation batches

### P0 — Recover trustworthy placement

1. Reproduce one failing authenticated placement and retain the exact response code and lineage.
2. Replace temporary-wall placement targets with a canonical room-wall resolver shared with the compiler. Persist explicit wallRefs during geometry correction; do not silently infer missing production walls.
3. Build one pure validation result for UI preview and API commit. Include calibration, room association, wall bounds, height/elevation, openings, neighbours and template dimensional limits. Server repeats validation using live saved data.
4. Show prerequisite blockers before arming a template. Separate room saving from silently approving a generated layout. A simple room layout may be created as a draft, but approval must be an understandable user action.
5. Fetch saved instances into Spaces, scoped to the current space record; render saved geometry directly. Insertion/patch/delete refresh this collection. Preserve multiple instances of the same template using instance IDs.
6. Remove proposal-coordinate modulo/clamping from saved geometry. Show proposals as proposals; editable dimensions on saved furniture must call the persisted edit endpoint.
7. Preserve structured error codes and issues near the placement. Add request deduplication/idempotency, pending states and stale-edit recovery.

Acceptance: place two wardrobes, attempt an overlapping third, edit width/offset, switch rooms, reload, retry a failed request, and see exactly the saved placements. Green preview and save must agree for stable inputs; concurrent changes must explain why validation changed.

### P1 — Finish room persistence and revision authority

Audit the local design-input changes before committing. Save bays, floor surfaces, material assignments and placement against the same room/plan revision. Reject stale writes consistently. Use transactions or a version-checked mutation so geometry persistence, invalidation and associated inputs cannot silently diverge.

Every accepted change invalidates affected scene approval, render references, pricing and production outputs. Prefer a normalized source fingerprint/revision comparison for scene freshness; a timestamp tolerance alone can allow real edits through and is not the final correctness solution.

Add free-placement contracts for islands and furniture, including bounds and rotation, then support them through API, compiler, 3D and production policies. Unknown plan scale remains a hard production blocker.

### P2 — Measured modules and internal anatomy

Use moduleParts as the dimensional source. Design intent comes from the selected template, composition, internal bay layout, shutter/handle choices and versioned materials; parts alone cannot infer the client's preferred style. Generate technical thumbnails and optional GLBs from the same output. Licensed decorative GLBs remain visual-only unless dimensionally certified.

Certify each family at minimum/nominal/maximum sizes. Include real sides, back, shelves, shutters, drawers, fillers, lofts, lighting and hardware. Model 1050 mm hanging space and 200 mm drawer fronts as editable proposed standards, with board thickness, drawer clearances and shelf allocation reconciled to the actual bay. Never assume the remaining space fits.

Model 6 mm versus 18 mm backs explicitly with joinery method, setback/groove, depth deductions and material faces. Internal/external laminate schedules need face-specific coverage and edge schedules. A 3 ft × 7 ft wardrobe converts to 914.4 × 2133.6 mm, but depth, composition and construction details still require confirmation.

### P3 — Analyzer correction and accuracy

Preserve source transforms; prefer trustworthy vectors; use normalized raster CV when appropriate. Audit the actual TypeScript/Python runtime path and remove synthetic-room success fallbacks. Optional Python detection needs a packaged supported runtime and an explicit unavailable state; accuracy is not proved by runtime speed.

Detect/reconcile walls, junctions, openings, door swings, windows, balconies and furniture evidence separately. Attach OCR dimensions spatially with confidence/source tags. Do not use furniture strokes as walls or classify room type by area with fabricated certainty. Provide an opening review list with editable width, offset, sill/head height and uncertainty.

Create a held-out dataset from accessible supplied plans with documented rights and manually confirmed labels. Measure opening precision/recall, boundary error, dimension error and correction effort. Establish the baseline before any improvement-factor claim. Corrections must survive refresh.

### P4 — Saved 3D and real AI presentation

Render saved component geometry first, including beams/pillars, floors, skirting, openings and camera. Push/pull structural editing needs measured constraints, persistence and revision invalidation; defer it until placement works.

Verify provider eligibility and actual deployed capability. Keep conditioned requests conditioned; no hidden paid fallback. Preserve durable jobs, fingerprints, image storage, retries and private access. Inspect output-image measurement logic, not just its import. Do not auto-approve uncertain AI QA. Test altered opening/object cases and compare to the approved deterministic view.

### P5 — Elevations, cutlist and client delivery

One scene/component projection supplies preview and export. Include overall and component chains, sill/head heights, offsets, internals, sections, laminate legend, hardware callouts and all provenance fields. Empty walls stay explicitly not-for-construction. Studio names are configurable.

Cutlists come from certified component geometry, not OCR of elevation pixels. Cross-check drawings and cutlists through shared panel IDs. Audit workbook reference files before fixing the final template: panel dimensions/thickness, material/faces, grain, edge bands, machining, room/unit, quantities and stable IDs; then sheet/hardware/edge summaries, labels and nesting. Include 6/18 mm back tests.

Keep grain constraints, candidate sheet sizes, kerf/trim and laminate quantities explicit. INR costs require typed pricing units and confirmed rates; missing prices remain incomplete. CNC choices must appear in the exported machining layers. Floor rendering and quantities use the same clipped layout. Revalidate live approved revision at every production endpoint.

### P6 — Consolidate secondary tools and launch

Audit dashboard, AURA, library, moodboards, CNC, converter, room builder, calendar, invoices, team/settings and presentation. Keep project/room context, remove dead/duplicate actions and distinguish standalone drafts. Keep sourcing/classification/IKEA imagery separate from certified manufacturing data. Import only assets/code with verified licenses; noncommercial intent does not establish permission.

Build one requirement ledger covering historical attachments: requirement, current owner, live caller, evidence, missing work, acceptance test. Archive superseded plans by linking this document; do not delete useful source files or branches before integration review.

Run the complete reliability suite on the exact candidate, migration compatibility checks, authenticated browser acceptance and deployed-provider/storage checks. Use production DB only under the user's chosen policy; Preview remains read-only while sharing it. Do not bypass protection or claim a hosted write journey from local tests. No new paid infrastructure is assumed.

## 6. Completion proof

Use one dedicated project: upload/calibrate → correct door/window → include one room → place wall unit and island → resize/material/internal layout → save/reload → review saved 3D → approve → retrieve real AI image → download drawings/workbook/labels/nesting/dossier → edit one dimension → confirm earlier outputs stale.

Check 1440×900, 1280×720, 1024×768 and 390×844. Include keyboard placement, zoom/pan coordinates, permission errors, network failures, concurrent edits and private output access. Browser tests must execute; skipped checks are unknown, not passes.

Report command, exit status, relevant output, commit, remote SHA and hosted evidence separately. No merge/launch claim until these gates pass. Preserve the previous deployment and verify rollback compatibility.

Next implementation task: reproduce the rejected placement, unify canonical room-wall identity, then connect the canvas to saved instances before adding more features.

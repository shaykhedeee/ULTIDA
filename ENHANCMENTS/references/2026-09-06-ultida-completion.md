# ULTIDA: complete-product execution backlog

Date: 2026-09-06. Status: implementation backlog, not a production-readiness certificate.

## 1. Goal and definition of complete

Give interior designers a hosted, room-by-room workspace that turns reviewed measurements into configurable modular interiors, accurate 3D, room finishes, elevations, material quantities, manufacturing information, visual approvals and delivery packages. Clients review proposals; production reviewers approve fabrication separately.

A feature is complete only when its authorized UI action, server validation, persistence, refresh/resume, failure recovery, revision lineage and automated test work together. A visible button, seeded catalog row, passing type check or attractive AI image is not completion evidence.

The first release proves one real room end to end. Subsequent releases expand room count, certified module families and quality without creating competing design models. All tasks below remain open unless explicitly marked otherwise in the execution record.

Constraints carried from the user:

- No paid software, paid resource creation, automatic paid fallback or unapproved usage charges.
- No customer-local installations, GPU server, ComfyUI or desktop-CAD prerequisite. Development tests are engineering verification, not a proposed local product workflow.
- Keep the existing repository and architecture where they are fit for purpose.
- Deliver reviewed changes through GitHub. A development branch is not a production release.
- Do not write Preview data into the production database or bypass failed release checks.

## 2. Evidence and scope

Inspected remote branch: `codex/release-recovery-20260728`, commit `ed123af8fa8a234b887ee1100186b2f051881c43`. The original working copy also contains unpublished commit `6c05bdc` and an unrelated modified example image; neither is included in this task branch. Historical docs dated July/August are useful intent, not proof of today's hosted behavior.

Read-only audit covered the architecture/gap/roadmap/status/release documents and principal UI, module, catalog, plan-analysis, scene, drawing, render and provider paths. It did not click every screen, test hosted auth, exhaustively audit all endpoints or certify security. W01 creates that exhaustive inventory before closure.

Key source findings to reproduce and repair:

| Area | Source | Observed gap |
| --- | --- | --- |
| Plan truthfulness | `apps/web/src/components/plan/PlanReviewWorkspace.tsx`, sketch enhancer | Invents a 15 mm/pixel scale and template rooms with accepted/high-confidence status. Local synthesis is labelled AI in another action. |
| Module editing | `apps/web/src/components/design/DesignFlowWorkspace.tsx`, nudge/center | Optimistic UI ignores failed HTTP responses. The unpublished dimension patch also has request races and no scene invalidation. |
| Placement | `apps/api/src/index.ts`, module create; `packages/plan-core/src/plan-schema.ts` | Checks `opening.kind`/`offsetAlongWallMm`, but canonical openings use different fields; door checks can be bypassed. |
| Manufacturing modules | `packages/module-framework/src/compilers.ts`, `baseParts` and kitchen/study compilers | Generic carcass omits sides; some controls do not affect parts; kitchen solid envelopes are not full fabrication panels. |
| World transforms | `apps/api/src/scene-module-parts.ts`; `packages/scene-core/src/index.ts` | Module mounting elevation and coordinate conventions are not consistently preserved end to end. |
| Exact base render | `packages/render-pipeline/src/base-render.ts`, `renderBox` | Component `position.zMm` is discarded. The first repair in this branch addresses this narrow bug. |
| Elevations | `packages/drawing-core/src/index.ts`, projection and SVG/DXF/PDF | Nearest-wall inference, missing sill/elevation and envelope drawing prevent exact component-driven sheets. |
| Room floors | `apps/web/src/features/scene/SceneStudio.tsx` | Flat colours inferred from room name, not persisted tile specifications. |
| Camera/resources | `SceneStudio.tsx` | Hardcoded camera presets and incomplete geometry/material/texture lifecycle handling. |
| Active AI rendering | `apps/api/src/visual-jobs.ts` | First-camera selection, module/part mask-ID mismatch, insufficient approval and durable execution gates. |
| Provider capability | `packages/provider-gateway/src/index.ts`, Cloudflare adapter | Only RGB is sent; masks/depth are ignored, aspect ratio changes and seed is not an authored input. |
| QA | `visual-jobs.ts`; `packages/render-pipeline/src/qa.ts` | Real output-image evidence is not authoritative. Success alone can admit visual approval. |
| Test coverage | Root `package.json`; `apps/api/test/run-all.mjs` | Root test commands do not directly enumerate every package suite. Required coverage must be explicit. |

Important: the API uses `visual-jobs.ts`; the separate `render-pipeline/src/job.ts` implementation is not the active orchestration. Fix the actual caller path and test the integration, not only an unused abstraction.

## 3. Architecture to keep and formalize

Keep React/Vite, direct Three.js, the Express domain API, Supabase authorization/storage and the existing provider gateway/worker seam. Do not introduce a parallel products database, second backend, React Three Fiber migration or new module configuration authority merely for fashion.

Authoritative chain:

`source evidence -> reviewed plan revision -> room/layout/module/surface revisions -> immutable scene -> render/elevation/production/quote artifacts`

The scene owns measured design after compilation. Images never overwrite it. Editing an approved design creates a new revision. A material-only change creates a new design/material revision with the same geometry hash; a render is still not manufacturing authority.

Proposed ownership boundaries (extend existing contracts rather than duplicate them):

| Concept | Required identity and content |
| --- | --- |
| Plan evidence | Organization/project/source asset/page IDs, content hash, pixel transforms, raw OCR/CV/vision evidence, confirmed dimensions, review history. |
| Room revision | Plan room/space mapping, floor ID, polygon/holes, wall/opening references, verified heights, requirements, scope and approval. |
| Module revision | Instance ID, template/version ID, room/wall anchor, full transform, typed configuration, materials, hardware, expected revision and validation result. |
| Component | Stable component path/ID, parent module/revision, exact local/world transform, semantic slot, physical part type and explicit fabrication data. |
| Room surface | Room/face ID, finish version, region polygon, levels, physical texture scale, tile pattern/origin/rotation/grout, thresholds and skirting. |
| Catalog version | Product/variant/asset version, dimensions, anchors, GLBs/LODs, collision hull, material slots, licensing, supplier/BOM eligibility and references. |
| Scene version | Exact input revision manifest, rules/compiler versions, deterministic IDs, geometry/material hashes and approval. |
| Camera/pass set | Camera ID/version, coordinate convention, matrices/lens, clipping, resolution, renderer version, artifacts/hashes and semantic ID manifest. |
| Output approval | Exact source and output artifacts, QA version/evidence, reviewer, timestamp, notes, decision and audit event. |

Normalize canonical coordinates in one boundary adapter: millimetres, right-handed Z-up in domain geometry; Three.js/rendering conversion must be explicit and tested. Do not independently reinterpret axes in each exporter. Pin versions and keep signed access URLs out of persistent identity fields.

## 4. Professional UI/UX specification

### Information architecture

Global navigation: Projects, Library, Tasks/Activity, Studio Settings. Inside a project: Overview, Plan, Rooms, Visuals, Documents, Commercial, Delivery. Standalone tools open the same project-aware commands rather than competing mini-app state.

Room workspace:

- Header: project breadcrumb, room selector, revision, saved/pending/stale state, Undo/Redo and one contextual primary action.
- Left: searchable room tree and tabbed library; filters for fit, family, size, style, availability and certification.
- Center: Plan / Elevations / 3D tabs. Room, wall, camera and selected component survive tab changes and refresh.
- Right: contextual inspector, not a permanent wall of unrelated controls. Module tabs: Size & Position, Interior, Fronts, Finishes, Hardware, Lighting.
- Bottom: collapsible issue list and dimensions/status, with click-to-focus offending geometry.
- Room actions: Validate room, Compile revision, Save camera, Generate preview, Request AI enhancement, Export drawings. Availability is based on server readiness, not local booleans.

### Visual design and interaction rules

Use neutral warm surfaces, charcoal text and one restrained accent; shared typography, spacing, border, radius, elevation and semantic colour tokens. Reserve red for blocking errors and green for evidence-backed saved/approved status. Use a common icon family and functional previews; inspiration photography must be labelled as such.

Desktop uses resizable panels; tablet uses drawers with persistent canvas controls; mobile uses room cards and a focused inspector sheet. Mobile supports measurements, review and bounded edits without pretending precision CAD manipulation is equally comfortable. Target 44 px primary touch hit areas; keyboard users can perform core actions without drag gestures. Provide visible focus, labelled icons, contrast checks, reduced motion and screen-reader status announcements.

Numeric editing: enter a draft, display units, validate inline, then Apply/Cancel. Never POST on every keystroke. Keyboard Enter applies a valid form; Escape cancels; invalid text stays editable. After submission use returned canonical data; a revision conflict offers Reload/Compare rather than overwriting another editor.

When changing rooms with an unsaved draft, offer Save / Discard / Stay. Failed saves keep the user in the current room. Restore keyboard focus after dialogs; a deep link to a deleted entity explains its absence and returns to the owning room rather than selecting an unrelated module.

Every action uses the same five-state contract:

| State | Required behavior/example |
| --- | --- |
| Happy | “Saved revision 12”; canvas and inspector agree with server response. |
| Empty | “No modules in this room” plus “Add module”; no fabricated live inventory. |
| Pending | “Validating placement…”; prevent duplicate Apply, allow viewing current saved design. |
| Failure | “Module was not saved. It intersects Door D2.” Preserve draft; focus the conflict and offer correction. |
| Constraint | “Compile changes before rendering”; explain what is stale and link the next action. |

Use Draft, Saving, Saved, Validation blocked, Scene stale, Compiled, Approved and Superseded consistently. “Geometry locked” is shown only when the selected version actually is locked. All destructive actions are scoped, confirmable and recoverable where feasible.

## 5. Task delivery contract

Each W workstream is a vertical deliverable: contracts/data + API + UI + tests + operator notes where needed. Subtasks inherit its dependencies, owner area, acceptance, verification, review and safety rules. Assign one accountable developer and a separate reviewer before starting; individual people are not assumed here.

Ticket states: proposed -> ready -> implementing -> review -> verified-in-CI -> verified-hosted -> accepted. A task may be code-complete but hosted-blocked; do not collapse the two states.

Every implementation ticket records inputs/outputs, permission checks, failure cases, tests, exact commit, migration impact, rollout/rollback, screenshots for UI changes and unresolved limitations. Additive schema changes require staging proof and old-version compatibility. No production database migration is authorized by this document.

## W01 — Establish an honest, hosted-capable baseline

Priority: P0. Dependencies: none. Areas: API/auth/storage/jobs, CI, existing release checklist, all UI routes.

- [ ] W01.1 Inventory every route, button, menu, export, background job and standalone tool. Record actor, prerequisites, handler/API, data owner, result, failure, persistence and E2E test ID.
- [ ] W01.2 Classify each as verified, partial, unavailable, legacy or dead. Remove unreachable fabricated-success code and misleading readiness claims without deleting user data.
- [ ] W01.3 Run clean Node 24 install, all workspace checks/builds and all package/API/AURA suites in CI; make missing required Chromium a failure, not a skip.
- [ ] W01.4 Verify deployed commit/environment from health output; isolate Preview storage/database writes. Keep Preview read-only until an eligible isolated environment exists.
- [ ] W01.5 Test sign-in/out, session expiry, invitation roles, organization isolation, private asset access, uploads/downloads, errors and recovery.
- [ ] W01.6 Add server-side no-spend admission policy: verified provider entitlement, per-account/project quotas, concurrency reservation, bounded retries, deny paid fallback and unknown cost paths.
- [ ] W01.7 Expose actual PDF/OCR/CV/vision/GLB/render/QA/export capabilities with explanatory disabled states. Configured credentials alone do not prove availability or free use.
- [ ] W01.8 Resolve hosted runtime compatibility: Python/OpenCV, OCR assets and raster/conditioning execution must run in an eligible hosted runtime or be visibly unavailable. Do not assume a Cloudflare worker can execute the existing Python path.

Acceptance: one signed-in user creates and resumes a project; cross-organization access is denied; unavailable capabilities are explicit; Preview cannot mutate production; no paid calls are made. Verification: CI plus authenticated hosted smoke on an isolated test project. Review: tenancy, costs, truthful status and every feature's command path. Safety: no upgrades, production writes or protected-check bypasses.

## W02 — Deliver the new project and room workspace shell

Priority: P1. Dependencies: W01 action inventory. Areas: `Shell.tsx`, `App.tsx`, shared UI, project/room workspaces.

- [ ] W02.1 Implement shared tokens and button/input/dialog/drawer/table/toast/empty/error primitives; migrate the principal journey first.
- [ ] W02.2 Add project overview with the next required action, room readiness, blockers and recent saved revisions.
- [ ] W02.3 Consolidate room navigation and Plan/Elevation/3D selection state; use project/room/entity IDs in deep links.
- [ ] W02.4 Introduce the contextual inspector and draft Apply/Cancel form contract; centralize request errors and persisted status.
- [ ] W02.5 Add accessible keyboard alternatives, inspector focus management, contrast and responsive desktop/tablet/mobile layouts.
- [ ] W02.6 Make standalone room/module/render/CNC/measurement tools attach to a selected project and reuse authoritative commands; label untethered sketches as drafts.

Acceptance: a designer enters a project, selects a room, edits a draft and switches views without losing context; no dead primary buttons or unexplained disabled controls. Verification: interaction/browser and accessibility tests at 1440, 1024, 768 and 390 CSS px. Review: state ownership, truthful feedback, content hierarchy. Safety: keep routes/backward links working behind incremental rollout flags.

## W03 — Make floor-plan analysis evidence-led and editable

Priority: P0/P1. Dependencies: W01. Areas: plan jobs/analyzer/reconciliation, plan contracts, PlanReviewWorkspace.

- [ ] W03.1 Preserve original upload, select PDF pages, reject unsupported/corrupt/oversize assets and record content hashes.
- [ ] W03.2 Add orientation/crop/deskew with an invertible source-to-raster transform; prefer PDF vectors/text when usable. Do not distort measured geometry through cosmetic unwarping.
- [ ] W03.3 Run independent OCR, CV and vision proposals; record per-pass availability, errors, source regions and model versions. Missing evidence remains missing.
- [ ] W03.4 Parse metric and feet/inch dimensions; attach values to dimension lines/endpoints rather than assigning nearest text blindly.
- [ ] W03.5 Require confirmed calibration; cross-check independent dimensions when available. Flag contradictory or nonuniform scale. Remove invented 15 mm/pixel calibration.
- [ ] W03.6 Use overview then overlapping high-resolution room/detail crops for complex plans; transform, reconcile and deduplicate outputs into a shared wall graph.
- [ ] W03.7 Validate polygon closure, holes, shared walls, wall thickness, room adjacency, openings, sill/head and service positions. Angled walls must not be snapped to orthogonal merely for convenience.
- [ ] W03.8 Replace entity-count-only AI verification with matched entity geometry, opening position and dimension-conflict checks.
- [ ] W03.9 Provide overlay review, source-crop evidence, confidence/issue queue and wall/opening/room correction tools with undo/redo and refresh persistence.
- [ ] W03.10 Separate “Extract existing plan”, “Clean drawing” and “Propose new layout.” Schematic rooms/doors are unapproved proposals, never measured observations.
- [ ] W03.11 Support manual completion when AI is unavailable; distinguish source-derived, designer-confirmed and site-verified measurements.
- [ ] W03.12 Build a consented golden dataset: clean/vector, scanned, low contrast, rotated, dense labels, irregular rooms, conflicting dimensions and missing scale. Hold out evaluation plans.

Acceptance: three representative plans and one AI-disabled plan reach explicit review/approval without invented dimensions or accepted template rooms. Report wall/opening precision/recall, calibrated length error, room topology errors and correction time by input class; set numerical release thresholds from the labeled benchmark, not an invented accuracy percentage. Verification: unit/property tests, uploaded-file integration, golden overlays and hosted review journeys. Review: coordinate transforms, uncertainty, hallucinations and privacy. Safety: retain source and old revisions; never destructively replace an approved plan.

## W04 — Make room-by-room requirements and layout real

Priority: P1. Dependencies: W02, W03. Areas: spaces/layout-core/layout API/RoomDesignStudio.

- [ ] W04.1 Persist room names/types, floor, height, scope, occupants, budget intent, storage/appliances and fixed services against the approved plan.
- [ ] W04.2 Maintain explicit canonical room/space ID mapping; support nonrectangular rooms, shared walls and independent room readiness.
- [ ] W04.3 Generate layout candidates only from approved geometry and requirements; score fit, circulation, storage, ergonomics and service compatibility with visible explanations.
- [ ] W04.4 Support layout comparison and editable placements through shared validation. Keep structural changes as separate review proposals.
- [ ] W04.5 Persist approved layout per room and aggregate project progress from server evidence; allow one room to progress while another is unresolved.
- [ ] W04.6 Add a project-wide consistency check for shared openings, circulation, material schedules and stale upstream room changes.

Acceptance: a two-room project retains different approved layouts after refresh and cannot place a room's module in another room by changing only a client ID. Verification: layout fixtures and API/browser tests. Review: room boundaries and readiness independence. Safety: layout revisions never silently change measured structural walls.

## W05 — Build a genuinely parametric module editor

Priority: P0/P1. Dependencies: W03 canonical openings, W04 room/layout identity. Areas: module contracts/API, module-framework, design inspector.

- [ ] W05.1 Normalize door/window/passage representations and anchors; use one typed validator for create, move, edit and compile.
- [ ] W05.2 Persist immutable module revisions with expected-revision conflict checks, actor/reason/audit; allowlist fields and reject unsupported values.
- [ ] W05.3 Validate wall ownership/inward side, offset/end fit, floor/ceiling elevation, 3D oriented module bounds, corner intersections and room containment.
- [ ] W05.4 Model door swing, opening access, drawers/shutters and service/installation clearances; distinguish physical overlap from configurable working clearances. Allow valid base/upper stacking and designed adjacent joints.
- [ ] W05.5 Make collision validation plus persistence transactional or serialized per affected room. Concurrent inserts must not both pass against stale sibling reads.
- [ ] W05.6 Expose width/height/depth, wall/room, offset, mounting height and supported rotation with preview validation and explicit Apply/Cancel.
- [ ] W05.7 Expose family-supported carcass/back thickness, bay layout, shelves/drawers, shutters/swing/sliding/open fronts, plinth, fillers/scribes, loft, hardware, lighting/profile and material slots.
- [ ] W05.8 Centralize all moves/center/duplicate/delete/resize commands; accept returned server geometry and show errors. Remove per-keystroke persistence and silent optimistic success.
- [ ] W05.9 Recompile after accepted edits, indicate pending/stale output and create a new immutable scene revision. Undo/redo creates valid revisions, not direct database reversal.
- [ ] W05.10 Add property tests for extreme dimensions, invalid thicknesses, reversed/angled walls, stacked cabinets, corner collisions, openings and concurrent editors.

Acceptance: each visible control changes reproducible exact parts or is explicitly unsupported; rejected edits leave saved geometry intact; refresh restores the accepted config; old approvals remain unchanged. Verification: API integration plus compiler property tests and browser editing journey. Review: concurrency, lineage, collision semantics and parameter sensitivity. Safety: versioned adapters for old records; no silent retroactive recompilation.

## W06 — Certify a useful module library

Priority: P1. Dependencies: W05. Areas: module-framework, catalog-core, preview/library/import validation.

- [ ] W06.1 Build reusable physical panel, carcass, back, shelf, partition, shutter, drawer, plinth, filler, countertop and hardware assemblies. Include missing side panels and reject impossible joins.
- [ ] W06.2 Certify kitchen base/sink/drawer/wall/tall and corner modules with appliance envelopes, services, countertop cutouts and reviewed clearances.
- [ ] W06.3 Certify hinged/open wardrobes, internal bays, drawers, shelves and lofts; add sliding systems only with verified track/hardware rules.
- [ ] W06.4 Certify TV/storage, study, crockery, pooja, utility and bed configurations already represented in the repository; add vanity/shoe storage through the same framework.
- [ ] W06.5 Define versioned workshop rules: thickness, join allowances, back grooves, stock axes, edge bands, grain, hardware BOM and machining eligibility. Existing defaults are studio presets, not universal manufacturing truth.
- [ ] W06.6 Publish a capability matrix per family. Hide or explain unimplemented options instead of accepting inert parameters.
- [ ] W06.7 Generate exact thumbnails, exploded views and dimension previews from the same compiler; label photos as reference/inspiration.
- [ ] W06.8 Add search, fit filters, room/family filters, favorites, recent items, compare, duplicate preset and validated place-in-room.
- [ ] W06.9 Run certification fixtures for minimum/nominal/maximum sizes, parameter changes, part count, gaps, shelf/drawer levels and BOM. Require workshop review for “production-ready.”

Acceptance: every published production-capable module has complete physical parts, deterministic tests and reviewed construction metadata; decorative proxies cannot enter a cutlist. Verification: family golden scenes, parameter sensitivity and manufacturing review. Review: panel construction and unsupported capabilities. Safety: withdraw certification for new versions without changing existing pinned instances.

## W07 — Version catalog digital twins and materials

Priority: P1. Dependencies: W05 lineage; W06 categories. Areas: existing catalog/material contracts, storage, admin/import UI, asset loaders.

- [ ] W07.1 Extend the catalog with SKU/manufacturer, product/variant/template/asset versions, dimensions, units, anchors, allowed transforms and eligibility classifications.
- [ ] W07.2 Store GLB/LOD/collision assets, material-slot mapping, PBR maps, physical texture scale, references and a checksummed manifest.
- [ ] W07.3 Validate GLB scale, orientation, node/material mapping, bounds, size budgets and missing textures; quarantine failed assets with actionable errors.
- [ ] W07.4 Add material records for laminate/board/paint/stone/glass/metal/fabric/tile, with supplier code, finish, thickness, grain, allowed use and physical PBR scale.
- [ ] W07.5 Persist stable paths such as `catalog/{organizationId}/{productId}/{assetVersionId}/model/model.glb`; sign only when accessing. Validate organization ownership and avoid public credential-bearing URLs.
- [ ] W07.6 Pin commercial price/lead-time snapshots, licensing, production/BOM mapping and AI-reference permission; supplier claims need source/date.
- [ ] W07.7 Support importing, reviewing, publishing and deprecating versions. Existing approved scenes retain their original asset and material versions.

Acceptance: swapping a material does not duplicate geometry; missing assets fail visibly; catalog updates never silently alter approved scenes. Verification: schema/import/storage authorization and GLB-loading tests. Review: asset licensing, lineage and unit conversions. Safety: no unlicensed scraped library, secret exposure or destructive overwrite of versioned assets.

## W08 — Add actual per-room floors, tiles and surface schedules

Priority: P1. Dependencies: W04 room polygons, W07 materials. Areas: surface contracts/API, scene compiler, floor inspector, plan/3D/quantity output.

- [ ] W08.1 Persist a floor surface assignment per room with material version, region/holes, elevation, build-up thickness and substrate. Floor/storey identity is separate from room finish.
- [ ] W08.2 Add tile width/length, grout width/colour, layout origin, angle and grid/brick/diagonal/herringbone patterns; only expose patterns implemented in both plan and quantity logic.
- [ ] W08.3 Clip tile layouts against real room polygons/holes; handle recesses, columns and doorway thresholds without bleeding into adjacent rooms.
- [ ] W08.4 Render physically scaled UVs/PBR, pattern and grout; editing one room must not change another room's material instance.
- [ ] W08.5 Add skirting height/profile, doorway exclusions, transitions and finish levels; flag wet-area slopes as specialist-reviewed geometry, not an AI assumption.
- [ ] W08.6 Generate tile plans with origin/cut locations, net area, full/cut tile counts, selected wastage allowance and skirting lengths from the same layout calculation.
- [ ] W08.7 Support copy-to-selected-rooms with an impact preview and explicit confirmation; extend the same assignment model to walls and ceiling finishes.

Acceptance: two rooms retain different tile sizes/patterns after reload, clipping matches approved boundaries, and floor plan/3D/quantities agree. Verification: rectangular/L-shaped/hole/rotated-pattern fixtures and persisted browser journey. Review: units, texture scale, clipping, material isolation and takeoff assumptions. Safety: quantity output names wastage assumptions and remains reviewable.

## W09 — Unify and strengthen scene compilation and the viewer

Priority: P0/P1. Dependencies: W05; add W07/W08 as assets/surfaces become available. Areas: scene-core/compiler, scene-module-parts, SceneStudio and rendering adapters.

- [ ] W09.1 Preserve full module/part elevation, rotation and wall-local transforms once; validate handedness against axis-reference fixtures.
- [ ] W09.2 Enforce unique component IDs and all cross-references; reject orphan rooms/walls/materials and unresolved production-critical inputs.
- [ ] W09.3 Produce a deterministic input manifest and geometry/material hashes; define backward schema migration and invalidation of stale derived artifacts.
- [ ] W09.4 Render the same exact parts, real catalog assets, floors, openings and authored fixtures in all views. Do not insert physical lamps purely from room type into approved construction geometry.
- [ ] W09.5 Extract renderer lifecycle, asset loading/cache, selection, transform preview, camera, lighting, materials and export-pass modules from SceneStudio.
- [ ] W09.6 Add lineage-aware picking, selection outline, snap/clearance preview and transform handles that submit commands, never mutate authoritative positions directly.
- [ ] W09.7 Persist camera name, room, position/target, lens/sensor, clipping, framing and output aspect; restore exactly for rendering.
- [ ] W09.8 Add progressive loading, per-asset errors/retry, LOD, shared resource ownership and explicit geometry/material/texture/render-target disposal.
- [ ] W09.9 Benchmark small/large reference projects on named devices; set interaction and load budgets from measurements. Verify repeated scene switches reach stable resource counts after warm-up.

Acceptance: viewer reflects persisted scene; a raised/rotated cabinet stays correctly positioned in every view; stable inputs produce stable geometry hashes; camera restores; no sustained resource growth in the benchmark. Verification: transform/property/golden tests and real browser performance measurements. Review: coordinate conventions, shared GPU ownership and scene identity. Safety: never rewrite historical scene contents; failed compilation leaves previous approved version usable.

## W10 — Generate proper elevations, sections and drawing sheets

Priority: P1. Dependencies: W06 exact parts, W09 transforms; W08 for finish sheets. Areas: drawing-core, elevation UI, production/download APIs.

- [ ] W10.1 Build one wall-local orthographic projector from explicit anchors and exact world component geometry; remove nearest-wall guessing.
- [ ] W10.2 Show correct sill/head, floor/ceiling datum, module mounting elevation, shutters, drawers, shelves, lofts, fillers, plinth, countertop and profile details.
- [ ] W10.3 Offer external elevation, internal elevation, plan/section and exploded assembly views with a defined hidden-line/cut-plane policy.
- [ ] W10.4 Add non-overlapping dimension chains, units, material tags, component labels, opening IDs and service annotations; never insert hardcoded datum dimensions unrelated to the scene.
- [ ] W10.5 Generate room/wall sheets, title blocks, selected scale, revision, legends, approval/site-verification notes and a drawing index.
- [ ] W10.6 Make SVG, PDF and DXF share projected geometry; test PDF page bounds/fonts and DXF layers/units by reopening outputs in independent readers.
- [ ] W10.7 Link selecting a drawing part back to its room/module/component inspector; regenerate only through a new source revision.

Acceptance: a floating unit beside a raised window has identical measured dimensions in 3D, elevation SVG, PDF and DXF; internal divisions match the compiled parts. Verification: golden fixtures, numerical projection tests and reopen/download tests. Review: projection, annotations, dimensions and true manufacturing suitability. Safety: unresolved/site-unverified geometry is visibly flagged and cannot silently receive final-production status.

## W11 — Produce genuine render-conditioning evidence

Priority: P0/P1. Dependencies: W07 assets and W09 exact scene/cameras. Areas: base renderer, artifact contracts/storage, active visual jobs.

- [ ] W11.1 Repair component elevation in the deterministic renderer and add a regression across RGB, depth, edges and masks (first implementation slice).
- [ ] W11.2 Use a common visibility/depth buffer, correct triangle/near-plane clipping and tested camera projection; replace painter-only ordering and average-face depth.
- [ ] W11.3 Produce synchronized RGB, metric depth, camera-space normals, visible edges and semantic instance ID passes at identical resolution/matrices.
- [ ] W11.4 Provide separate component masks, module unions and module-specific semantic-slot masks with a deterministic ID-colour manifest; do not confuse a single material mask with a full key map.
- [ ] W11.5 Include actual catalog geometry, exact finishes and room flooring rather than envelope proxies or material-ID colours in production conditioning.
- [ ] W11.6 Hash and persist scene/camera/assets/materials/renderer/pass encoding, resolution and input artifacts. Geometry, camera or relevant material changes invalidate the correct pass set.
- [ ] W11.7 Reproduce production passes in a trusted eligible hosted runtime. Browser capture may preview, but user-controlled capture alone is not server-verifiable geometry evidence.

Acceptance: all pass dimensions/cameras match; visible mask pixels map back to exact components; occluded components do not leak into edit masks; identical inputs reproduce deterministic passes in the supported runtime. Verification: occlusion, near-plane, multi-component/material, raised-module and camera fixtures. Review: depth/normal conventions, mask identity and reproducibility limits. Safety: no false claim of production evidence when only a browser screenshot exists.

## W12 — Deliver hosted AI enhancement with honest limits

Priority: P1. Dependencies: W01 cost/capabilities, W11 conditioning. Areas: provider-gateway, active visual jobs/worker, Visualize/MaterialSwap UI.

- [ ] W12.1 Define provider capability profiles for image-to-image, depth, line/normal conditioning, masks, references, resolution and seed; verify actual request/output contracts before enabling operations.
- [ ] W12.2 Preserve saved camera and aspect ratio; reject unknown camera IDs rather than choose the first camera. Persist actual seed/model/version/parameters.
- [ ] W12.3 Move active rendering to durable queued/leased jobs: conditioning -> provider running -> validating -> awaiting review -> approved/rejected/failed/cancelled, with deadlines and heartbeat.
- [ ] W12.4 Benchmark eligible providers progressively: RGB+depth, then edges, normals and licensed references. Unsupported depth/mask operations fail before invocation; do not claim ControlNet support from generic image input.
- [ ] W12.5 Implement material-only revision from the approved source image, exact target semantic mask and new finish reference. For strict pixel isolation, composite the original outside the mask and test that region is unchanged; review seams/reflections honestly.
- [ ] W12.6 Decode and validate actual returned raster bytes, MIME, dimensions and limits before saving; reject invalid/fake/unrelated success. Persist provider attempts and output hash.
- [ ] W12.7 Add side-by-side source/result, overlays, provider provenance, retry/cancel and clear quota-exhausted/unavailable states. Keep accurate deterministic output available when AI is unavailable.
- [ ] W12.8 Enforce zero-spend admission on every attempt, including retries; do not consume paid credits or enable plan upgrades. Stop automatic retries when quota is exhausted.
- [ ] W12.9 Obtain project-level consent for third-party AI transfer; disclose selected provider, source/reference images and retention policy, minimize transferred client data and implement deletion/revocation behavior. Only licensed, permitted references may be transmitted.

Acceptance: a real eligible provider returns a scene-linked image; provider failure never returns a previous or stock image; supported targeted edits pass isolation checks; no paid call path is silently used. Verification: provider contract fixtures, worker recovery, hosted canary only under verified free entitlement and a reviewed visual benchmark. Review: actual conditioning payload, cost policy, privacy, retries and cancellation. Safety: AI enhancement cannot alter saved geometry or become manufacturing authority.

## W13 — Make image QA and approval evidence-based

Priority: P1. Dependencies: W11, W12. Areas: QA contracts/measurements, active review API, Visualize.

- [ ] W13.1 Compare actual output to deterministic evidence for framing, wall/opening edges, missing/invented visible objects, focal-module visibility and cabinet divisions.
- [ ] W13.2 Measure material-target isolation using target/outside-mask regions and permitted boundary policy; shared material elsewhere must remain unchanged.
- [ ] W13.3 Use measurable image-space errors, visible-object matching and confidence; do not assert camera error in millimetres from a generic image-similarity score.
- [ ] W13.4 Calibrate versioned thresholds on labeled good/bad outputs and holdout scenes. Show unavailable evidence and false-positive/negative tradeoffs; no automatic geometry approval before calibration.
- [ ] W13.5 Block approval for blocking mismatch, stale evidence or wrong artifact. Record reviewer identity, note, exact QA/scene/output versions and checked database result transactionally.
- [ ] W13.6 Keep visual approval separate from production approval. Rejection preserves evidence; subsequent attempts create new results.

Acceptance: intentionally moved door, missing cabinet, wrong camera and outside-mask edits are rejected in the golden set; passing visuals retain reviewable evidence; output-image approval never rewrites CAD. Verification: image fixtures and approval API authorization/concurrency tests. Review: threshold calibration, visible-surface scope, audit and missing-evidence handling. Safety: human review remains required while measurements are incomplete.

## W14 — Finish production, costing and client delivery

Priority: P1. Dependencies: W06, W07, W09, W10; visuals additionally W13. Areas: drawing/production/commercial-core, production/commercial/delivery UI and APIs.

- [ ] W14.1 Compile manufacturing snapshots only from approved exact components with explicit panel-local axes, stock, thickness, grain, edge bands, cutouts/operations and real hardware BOM.
- [ ] W14.2 Block cutlist release on incomplete carcasses, missing construction data or uncertified modules. Do not infer hardware from part names or thickness by sorting box dimensions.
- [ ] W14.3 Deliver room/module/part material schedules, cutlists, edging, hardware, operation lists and purchase quantities, all with stable component/version IDs.
- [ ] W14.4 Add nesting with stock dimensions, kerf/trim, grain/rotation constraints, leftovers and transparent optimization assumptions; generate sheet/part labels.
- [ ] W14.5 Provide validated SVG/DXF cutout patterns and preflight. Machine G-code remains disabled until a named controller/postprocessor and shop validation exist.
- [ ] W14.6 Complete estimates and quotes with versioned rates, labour, hardware, finishes, wastage, taxes/discounts, exclusions and change-order comparison; do not invent supplier prices or jurisdiction rules.
- [ ] W14.7 Build client review/share/revoke, comments/markup, approve/reject and downloadable delivery packs with one exact approved scene and a revision manifest.
- [ ] W14.8 Audit adjacent studio features from W01: calendar, tasks, invitations/roles, identity, invoices, risks/comments, reference uploads, AURA tools and SketchUp review exports. Wire to real persistence or clearly mark unavailable.
- [ ] W14.9 Keep AURA proposal-based: explain issues and prepare edit diffs through the same command validators; no silent geometry, quote, approval or production mutation.

Acceptance: drawing, BOM, cutlist, quote and delivery manifest agree on scene/material/rate versions; downloads reopen correctly; incomplete manufacturing data prevents release; unauthorized clients cannot see other projects. Verification: fixture quantities, independent file readers, API/browser export and client-access tests; specialist manufacturing/tax review as applicable. Review: construction semantics, arithmetic, access, audit and output consistency. Safety: no unverified machine instructions or implied regulatory certification.

W14.8 is an umbrella, not one closure check: create a child ticket for each W01 inventory feature, with its own persistence, permission, failure and hosted acceptance evidence. The umbrella cannot close while any child is unverified or undisclosed.

## W15 — Prove completeness and release the exact candidate

Priority: P0 release gate. Dependencies: accepted applicable W01-W14 work. Areas: CI/E2E/security/performance, deployment evidence and release record.

- [ ] W15.1 Close every W01 inventory row with evidence; remove dead actions or disclose unavailable capabilities. No “implemented” badge based solely on source presence.
- [ ] W15.2 Run authenticated desktop/tablet/mobile journeys: brief -> upload/review -> two rooms -> layout -> base/upper modules -> floors/materials -> scene -> cameras -> render/review -> drawings/production/quote/delivery.
- [ ] W15.3 Repeat with refresh/sign-out/resume, expired signed URLs, slow network, lost responses, duplicate clicks, stale tabs, concurrent edits and provider/storage failures.
- [ ] W15.4 Verify all package suites, required Chromium, API tenant/storage tests, migrations/RLS, durable lease recovery, dependency/security checks and secret scan on the exact candidate SHA.
- [ ] W15.5 Review model/asset/provider/host eligibility and zero-spend enforcement; document quota behavior and remaining service limitations.
- [ ] W15.6 Record measured load/render/memory/accessibility results on named test fixtures/devices; resolve release-blocking regressions.
- [ ] W15.7 Require reviewed migration rehearsal on isolated staging, hosted provider proof where AI is claimed and signed-off manufacturing examples. If isolation/free entitlement is unavailable, mark the release blocked or narrow its published capabilities.
- [ ] W15.8 Publish reviewed GitHub commits with release notes, evidence and rollback instructions; merge/tag/promote only when required gates and authorization are present. Do not call a development branch a completed app.

Acceptance: exact commit and deployed artifact agree; zero skipped required gates; all core hosted journeys pass; rollback rehearsal is documented. Verification: release checklist and attached CI/hosted evidence. Review: independent code/design/security/production reviewers as applicable. Safety: preserve prior approved artifacts; additive migrations and tested backups; never promote a different rebuilt commit.

Accuracy/performance benchmarks must result in approved numerical pass/fail thresholds before release. Merely collecting measurements is insufficient. Record the dataset/device, baseline, chosen threshold, reviewer and failure consequences.

## 6. Execution order and scope cuts

| Milestone | Reviewable outcome | Required work | Explicitly not yet claimed |
| --- | --- | --- | --- |
| M0: truthful baseline | All actions inventoried; measured-plan truthfulness, cost and release guards | W01, critical W03/W05 fixes | Complete manufacturing or AI geometry lock |
| M1: one accurate room | Professional shell, reviewed room, certified cabinet, saved finish, exact 3D and elevation | Thin vertical slice through W02-W06, W09-W10 | Every module family or photoreal output |
| M2: multi-room modular design | Independent rooms, broader certified library, tile plans/quantities and versioned assets | W04-W10 expansion | Guaranteed AI availability |
| M3: trustworthy visualization | Saved cameras, genuine synchronized passes, supported hosted enhancement and evidence review | W11-W13 | Geometric guarantees from prompts or unlimited free rendering |
| M4: production and delivery | Consistent drawings/BOM/cutlists/quotes/review package | W14 | Machine-specific G-code without validation |
| M5: accepted release | Exact candidate passes complete hosted journey and release gates | W15 | Completion based on checklists alone |

Do not batch whole database/backend/frontend rewrites. Each milestone lands in small end-to-end PRs. Schema/compiler ownership is coordinated before independent UI/assets/QA work. After the contracts stabilize, module-family certification, UI primitives and analyzer benchmark work can proceed independently, with one integration owner.

First ten implementation tickets, in order:

Precondition for every ticket: no live provider request until W01 zero-spend admission and actual entitlement verification pass. Ticket 10 expands rendering capabilities; it does not postpone the no-spend guard.

1. Correct exact-part vertical positioning in deterministic render passes with red/green regression (this branch).
2. Remove invented calibration/accepted template geometry from the measured-plan path.
3. Normalize canonical openings and enforce opening clearance on create/edit/compile.
4. Introduce safe typed module revision commands and replace silent nudge/center success.
5. Preserve full transforms and exact component IDs through compiler/view/elevation adapters.
6. Finish one certified base cabinet and one wall cabinet, including real panels and stacking.
7. Implement the shared room workspace and dimension inspector on that end-to-end path.
8. Add a persisted room floor/tile assignment through UI, API, compiler, preview and quantities.
9. Generate correct window/floating-cabinet elevations from shared projections.
10. Enforce actual provider capabilities/cost policy before reconnecting conditioned renders and material swaps.

M1 acceptance fixture: one measured 4000 x 3000 mm rectangular test room, 2700 mm high, with a 900 mm door, a 1200 x 1200 mm window at 900 mm sill, one 600 mm-wide base cabinet and one raised 600 mm-wide wall cabinet on a verified clear wall segment. Mounting height, construction rules and materials are explicit fixture inputs. Compare the same component IDs/bounds in plan, 3D, elevation and cutlist; refresh must preserve them. These are synthetic test measurements, never inferred user-project defaults. M2 adds an L-shaped second room with a different tile finish; M3 reuses saved cameras for held-out good/bad render comparisons; M4 verifies the combined scene/rate manifest; M5 executes the hosted failure/authorization matrix.

No calendar completion date is asserted: the measured baseline, hosted environment, available test fixtures and specialist review capacity are not yet established.

## 7. Technical options and the free-hosted boundary

Recommendations below are design choices, not claims that the current app already supports them.

- Keep direct Three.js and use its supported GLTFLoader plus explicit resource cleanup. Switching rendering frameworks would not repair incorrect geometry, absent asset versions or leaked GPU resources. Primary sources: https://threejs.org/docs/pages/GLTFLoader.html and https://threejs.org/manual/en/cleanup.html.
- Benchmark OCR preprocessing/detection/recognition as separate stages. PaddleOCR is an open-source candidate, not a claim of architectural-plan accuracy; compare it with the existing OCR path on ULTIDA's own data and confirm hosted-runtime feasibility. Primary source: https://github.com/PaddlePaddle/PaddleOCR.
- ControlNet-style pipelines support spatial conditioning, including multiple inputs. This is a candidate architecture, not a promise of exact geometry or an available free hosted endpoint. Primary sources: https://arxiv.org/abs/2302.05543 and https://huggingface.co/docs/diffusers/api/pipelines/controlnet.
- Cloudflare documents a finite daily Workers AI free allocation and failures after free limits. Model-specific capabilities and eligibility require verification; do not assume every model accepts masks or depth. Primary sources: https://developers.cloudflare.com/workers-ai/platform/pricing/ and https://developers.cloudflare.com/workers-ai/models/.
- Vercel Hobby is restricted to non-commercial personal use. A commercial ULTIDA launch cannot be described as compliant free Hobby hosting. Before launch, choose an eligible hosting arrangement or explicitly approve a changed budget; this plan does not provision or migrate hosting. Primary sources: https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits/fair-use-guidelines.
- Existing read-only Preview policy conflicts with authenticated write-flow verification unless an isolated environment is available. A test tenant in production is not equivalent to staging isolation. Do not weaken this gate to create a release claim.

The deterministic hosted editor/viewer/drawings should remain usable when AI is unavailable. Unlimited, high-quality, always-on hosted AI cannot be guaranteed at zero cost. Respect the user's constraint by disabling unavailable operations and showing quota status, not silently charging or producing fake success. Hosting/model eligibility is checked again at implementation and release because it can change.

## 8. Verification record for the first implementation slice

Scoped change: preserve exact module-part `position.zMm` in `renderScenePerspectiveArtifacts`; leave legacy floor-aligned module envelopes unchanged. All downstream passes use the corrected primitive geometry. No schema/database/provider/UI change is included.

Root `test` and `reliability` also invoke `test:render` so this regression is covered by the repository gate after the required package build. This does not yet bring all other package suites into the root gate; W01.3 remains open.

Regression requirements: a raised shelf projects above its ground-level equivalent; RGB/depth/edges change with elevation; repeated identical input reproduces outputs; mask identity and material-region alignment remain; output dimensions match; input scene is not mutated. This does not prove global occlusion, camera conventions or mounting-height compilation, which remain W09/W11 tasks.

Execution evidence and review verdict are recorded in the delivery response/commit handoff. The broader task boxes remain unchecked until their separate acceptance evidence exists.

Observed on this development branch, 2026-09-06, Node v24.19.0:

- Clean `npm ci --include=optional --no-audit --no-fund`: passed (296 packages).
- Red regression before the fix: failed specifically because the raised shelf did not project above the floor-level shelf.
- `npm run test:render`: 21 passed, zero failed/skipped, including the elevation regression.
- `npm run build:packages`, `npm run check`, `npm run build:apps`: passed.
- `npm run test:api`: exited successfully, but one optional Chromium test skipped because a browser executable was unavailable. This is not a passing required browser/release gate.
- `npm run test:aura`: six passed. `npm run validate:reliability`, `npm run preflight`, `git diff --check`: passed.
- Read-only independent repair review: no blockers; verified the active API caller and reran all 11 render-job tests. Existing mask lookup, camera, occlusion and provider defects remain separate open tasks.
- Backlog review: no blockers; added explicit no-spend precondition, room-switch draft handling, AI data-transfer consent, milestone fixtures and per-feature closure requirements.

Delivery scope: development-branch publication only. No hosted browser journey, live AI request, migration or production promotion was performed. Required CI/hosted gates remain pending. Rollback is a normal revert of this code/documentation change; it creates no database migration and changes no stored scene. Keep existing render artifacts immutable and create new artifacts when regenerating with the repaired renderer.

## 9. Handoff and open decisions

Next module: implementation, starting with the ordered tickets above and their red-capable tests; after each nontrivial slice, independent change-review precedes delivery. No additional broad architecture approval is needed to repair the identified correctness defects within the user's request.

Decisions requiring new authority or specialist input: commercial hosting under the zero-paid constraint; eligible isolated staging; actual free provider entitlement/capabilities; licensed catalog inputs; workshop rules/sign-off; any future budget or machine-controller support. Do not turn those unknowns into fabricated defaults.

Checkpoint: context-survey -> product-planning -> task-creation -> implementation -> change-review -> development-branch delivery. Production shipping remains blocked until W15 evidence exists. Next / upcoming task after this branch: W03.5/W03.10 measured-plan truthfulness and W05.1 normalized opening-clearance regression tests.

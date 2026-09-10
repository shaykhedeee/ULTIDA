# ULTIDA application audit - 2026-09-08

## Scope and evidence

This audit reviewed the current local branch, 433 tracked application files,
193 TypeScript/Python source files, 36 React screen files, 44 Supabase
migrations, 64 test files and all first-party API routes. TypeScript checks
passed for every package with a `tsconfig.json`, plus the API and web app.

The local commit is `a6f6cd2 feat: export scene-linked production workbooks`.
The remote branch cannot currently be synchronized from this PC because Git's
`remote-https` helper is missing; GitHub shows one newer remote commit than the
locally known remote base. Do not force-push across that unknown commit.

## What is already real and worth preserving

| Area | Current state | Evidence |
| --- | --- | --- |
| Canonical design data | Strong | Typed plan, room, scene, bay and flooring contracts; versioned scenes and stale-output invalidation. |
| Production gate | Strong | Approved/locked scene + bay reconciliation + production snapshot review are required for protected server exports. |
| Core production data | Strong | Physical panel IDs, material/thickness/grain/edge records, deterministic nesting, SVG labels and new XLSX workbook are scene-linked. |
| AI cost safety | Strong | Default provider chain excludes OpenAI and Gemini; paid providers require explicit opt-in. |
| Render conditioning | Substantial | Base RGB/depth/edge/material/object/opening/skirting maps are persisted and QA is called in the live render path. |
| Tenant access control | Substantial | Forty-four migrations define organization, project and production-review RLS policies. |
| Plan analysis safety | Substantial | Calibration is explicit; unresolved geometry is surfaced instead of silently manufactured. |

## Must fix before calling factory/client delivery complete

### P0 - production truthfulness

1. **Replace fake dossier information.**
   `apps/api/src/index.ts` in `buildDossierSpecFromContext()` falls back to a
   fictional Sharma residence, people, phone number, appliances, room areas,
   hardware quantities, nesting totals and site checklist. A successful PDF can
   therefore contain data unrelated to its scene. The exporter must construct
   every row from persisted project/brief/scene/snapshot records, show `TO BE
   CONFIRMED` for missing fields, and reject a factory release where required
   facts are absent.
2. **Remove the demo cutlist from authenticated production state.**
   `apps/web/src/features/production/ProductionWorkspace.tsx` initializes and
   falls back to `DEMO_CALIBRATED_CUTLIST` when the approved snapshot cannot be
   read. The workspace must show an error/empty state instead. A demo must live
   only in an explicitly labelled sample project and never populate a real
   project's Parts, CSV or release controls.
3. **Delete or gate client-side generated DXF and SketchUp exports.**
   `apps/web/src/components/drawings/WorkingDrawingsDossier.tsx` draws a fixed
   2100mm cabinet DXF and creates a SketchUp file from `createDefaultDemoScene`.
   Both must call the approved-scene API endpoints or be removed. Browser
   printing must not be offered as a production-PDF fallback.
4. **Retire the legacy module-box cutlist path.**
   `packages/drawing-core/src/index.ts` still exposes
   `generateFullProductionCutlist()`, which invents panels from module boxes.
   It is used by commercial calculations. All production quantities and BOQ
   material quantities must instead take the exact `ProductionSnapshotV1`.
5. **Do not mark unmeasured content approved.**
   Every dossier, DXF, label and workbook must use the same source scene status,
   calibration state and provenance. The newer shop-sheet title block does this;
   the dossier and legacy drawing UI still need the same rule.

### P0 - release and hosted operations

6. **Reconcile Git before deployment.** The remote branch is ahead of the last
   local remote base, and this computer cannot fetch or push HTTPS remotes.
   Restore Git for Windows' `git-remote-https`, fetch, merge/rebase intentionally,
   then run the release checks on the exact push commit.
7. **Configure services in the hosted environment.** A production run requires
   Supabase server credentials and private storage, Cloudflare worker URL plus
   shared secret, at least one opted-in image provider, and an external
   `PLAN_CV_SERVICE_URL` if OpenCV tracing is required. The Vercel function is
   intentionally no longer a Python/OpenCV host because that bundle exceeded
   Vercel limits.
8. **Run migrations in an isolated preview database first.** The repository has
   44 migrations and security policies, but this audit could not verify the live
   Supabase branch or storage bucket policy.

## High-value functional completion work

### P1 - one authoritative user flow

1. Make the project path the single path: **Brief -> Plan -> Spaces -> Modules
   -> Scene -> 3D -> Review -> Production -> Delivery**. Current routes are
   partly redirected, but design functions are still duplicated between
   `SpacesWorkspace`, `DesignFlowWorkspace`, `SceneStudio`, and standalone
   tools.
2. Introduce a shared `ProjectSceneState` query/cache. Local-storage handoffs
   (`pendingModulePlan`, plan drafts and studio settings) are useful recovery
   aids but must not outrank persisted project state after refresh or across
   collaborators.
3. Remove the unused `PlaceholderScreen` in `App.tsx`, reduce duplicate legacy
   route aliases, and make every dashboard card name its exact project-aware
   destination.
4. Replace static working-drawing sheet navigation with a dynamic wall/room
   index produced from the approved scene. A project with two walls should not
   show ten prewritten room sheets.
5. Connect production certification in the library to the actual current-wall
   fit and bay reconciliation result, not only catalogue capability flags.

### P1 - credible floor-plan intake

1. Host and health-check the canonical OpenCV service externally; the API now
   reports its absence honestly instead of pretending it analyzed a plan.
2. Add a held-out golden data set containing vector PDFs, low-resolution phone
   images and high-resolution scans. Track wall, opening, room and dimension
   precision/recall after DPI normalization.
3. Add OCR/dimension-line association and confidence/source chips at entity
   level. A user must see which dimension was measured, derived, reference-only
   or awaiting confirmation.
4. Add authenticated browser tests for upload, calibration, approval, refresh
   recovery and tenant isolation.

### P1 - render accuracy and recovery

1. The deterministic conditioning and QA are wired, but the AI image evidence
   pass currently relies mainly on raster edge/mask alignment. Add a calibrated
   semantic detector for cabinet divisions, opening class/count and camera pose
   before treating AI-enhanced imagery as quality-approved.
2. Add queue retry, cancellation, worker heartbeat and stale-job recovery tests
   against real Cloudflare/Supabase preview infrastructure.
3. Keep render images presentation-only: production dimensions remain from the
   approved scene and its sheet/component records.

### P1 - production completion

1. Replace the `Operation Sheet` and `Tooling Assumptions` unavailable cards
   with persisted CNC operations: boring grid, hinge cups, grooves, rebates,
   cutouts, tooling, face, tolerance and part ID.
2. Export panel labels as printer-ready PDF/ZPL in addition to SVG, with a QR or
   barcode generated from the stable component ID.
3. Add workbook formulas/validation for stock consumption, offcut register and
   material reconciliation, while keeping the panel source rows immutable.
4. Generate the final sign-off dossier from the same snapshot as the DXF,
   cutlist, labels and XLSX; include a release manifest with hashes.

## Quality and product work after the integrity gate

- Finish room-aware library browsing, presets, favorites and duplicate-as-preset
  without mixing visual-only objects into panel production data.
- Improve visual hierarchy in the dashboard and Spaces workspace only after the
  duplicate state paths are removed.
- Add client review, compare-revision, comment and approval flows over a stable
  scene version.
- Add multi-user conflict indicators and server-persisted studio defaults.
- Exercise a golden apartment through plan upload, calibration, rooms, modular
  editing, approved scene, render QA, DXF/PDF/XLSX exports, refresh and a
  second tenant access check.

## Recommended execution order

1. Production truthfulness: P0 items 1-5.
2. Git/hosted recovery: P0 items 6-8.
3. Golden authenticated apartment workflow.
4. Persisted CNC operations and final dossier manifest.
5. Floor-plan evidence data set and CV service.
6. Render semantic QA and provider recovery.
7. UI consolidation and library workflow refinement.

Completion means an authenticated user can start with a calibrated plan, create
and approve a bay-reconciled scene, receive a geometry-checked render, and
download matching DXF, PDF, labels, nesting and XLSX outputs with no demo or
invented data anywhere in the production release.

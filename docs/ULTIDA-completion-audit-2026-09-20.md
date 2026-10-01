# ULTIDA completion audit and execution plan

Audit date: 2026-09-20. Status: **not yet verified for a complete customer production journey**.

## Scope and evidence

This is a repository-wide subsystem audit and completion plan, not a claim that every line, historical attachment, customer CAD/PDF, or authenticated screen has been re-executed. The tracked repository contains 999 files. Inspected evidence covers manifests, CI and test runners, live API routes, frontend workflow/state owners, compiler and production packages, analyzer/render paths, deployment health, remote branch identities, and the remote migration ledger. Two independent read-only reviews covered frontend and backend pipelines.

No application code, production data, deployment, or dependency was changed during this audit. This report is the only new deliverable. The pre-existing uncommitted browser-test edit and temporary directories were preserved.

Verified identities:

- Local integration branch, remote main, and remote codex/ultida-unification: `ed8c862b2c6084962887332baa88e142f6d2cdec fix(scene): persist render design intent index`.
- Production `/api/health` returned HTTP 200 and that same SHA on 2026-09-20.
- Health reports Supabase, durable-job configuration, plan vision configuration, and Cloudflare image-provider configuration available. `planCv` is false.
- The remote Supabase ledger contains `20260915060515 scene_design_intent`. This is evidence that the migration is recorded; it is not proof that all database policies and application writes work.
- Use the existing main database, per the user's decision. Do not create paid staging. Keep Preview read-only when sharing main. Use a clearly identified QA project for authorized production acceptance work and additive, rollback-conscious schema changes.

Important correction: `realImageGeneration` in `apps/api/src/index.ts:226` checks configured provider capability, not a completed image request. A green health response is not proof of successful rendering, durable retrieval, or accurate geometry.

## What is already implemented and should be preserved

- Parametric carcass side panels and independent wardrobe components.
- Min/nominal/max side-panel and island-envelope tests.
- Bay and opening reconciliation in the compiler and catalog-placement logic.
- Floor-surface contracts and room-isolation tests.
- Wall-tracer resolution normalization (`apps/api/cv/wall_tracer.py:414`).
- Render QA imported by the live render path (`apps/api/src/visual-jobs.ts:6`). Old claims that it is never called are obsolete.
- Persisted scene compilation and the shared authenticated production-context loader.
- Docked furniture catalog, spatial fit preview, and measured placement flow.
- Module-edit invalidation helper; extend its guarantees to every design edit.
- Production workbook, labels, nesting, dossier, and geometry-derived drawings have real implementations and local tests. They still need a single authenticated hosted-project demonstration.

Fresh targeted command:

```text
node --import tsx --test packages/scene-compiler/tests/index.test.ts packages/module-framework/test/shared-carcass.test.ts packages/module-framework/test/wardrobe-composition.test.ts packages/module-framework/test/island-compilation.test.ts
exit 0; tests 27; pass 27; fail 0; skipped 0
```

The full reliability run from September 15 remains historical evidence; it was not rerun or relabeled current during this audit.

## Checklist status

| Area | Current assessment | Confidence |
|---|---|---|
| Tooling and CI | Watch: release runner omits dedicated compiler/module suites and other package suites; browser gate is only an API fetch | High |
| Documentation versus implementation | Watch: older reports conflict with current wiring; presentation and settings claims overstate persistence | High |
| Environment/configuration | Watch: production online, hosted CV not configured according to readiness; provider success unproven | High for configuration, unknown for completed jobs |
| Dependencies | Watch requiring pre-release remediation: npm audit reports 4 affected package entries, 3 high and 1 moderate | High for audit result; exploitability not assessed |
| Tests | Watch: 27 selected geometry tests pass; browser launch skipped after timeout; hosted journey not covered | High |
| Release health | At risk: approval/export trust gaps and incomplete authoritative state | High |
| Instructions/history | No AGENTS.md found in the inspected repository tree; one local test edit remains unfinished; remote branches match | High |

## Ranked findings

### Critical: production exports can trust caller-supplied approval

Evidence: compatibility handlers in `apps/api/src/index.ts` around lines 530, 575, 588, 921, and 951 accept supplied scene data and its status. Several lack project-auth middleware. They do not all reload the approved persisted scene. In contrast, `readApprovedProductionContext` at line 661 is already the stronger shared path.

Impact: an output can look production-approved without corresponding to the saved approved revision. This is a construction-authority defect, not evidence of an observed customer data breach.

Confidence: high. Next module: implementation.

Task F01: require authenticated project/scene identity and the shared authoritative loader for all fabrication formats. If client-payload previews remain, label and separate them as non-construction output.

Acceptance: anonymous, forged approval, cross-project scene ID, stale revision, unreconciled bays, and unconfirmed scale are rejected across PDF/SVG/DXF/cutlist/CSV/workbook/package routes. Valid authorized requests succeed.

### Critical: saved-design state has competing sources

Evidence:

- `apps/web/src/features/spaces/SpacesWorkspace.tsx:3916` confirms bays in browser storage; line 3978 saves floor surfaces there. Geometry payload around 1726 omits both.
- `apps/web/src/features/visualize/VisualizeStudio.tsx:161` saves design intent locally; persistence/provider consumption is not established by those controls.
- `apps/web/src/features/scene/SceneStudio.tsx:605` falls back to local scene/modules; lines 665–711 synthesize missing dimensions/positions and can prefer local modules.

Impact: what the user sees or believes saved can differ from compiled, rendered, or exported geometry and can disappear on another device.

Confidence: high. Next module: implementation.

Task F02: one server-owned design revision containing geometry references, module placements, bay schedules, floor surfaces, material versions, and render intent. Draft browser storage may recover work but must not masquerade as saved approval. Reuse existing contracts; do not invent another scene format.

Acceptance: edit bays/floor/finish/style, save, clear browser storage, reopen on a second session, and get identical values. Invalid saves retain a visible unsaved state. 3D uses persisted component dimensions; missing geometry produces a blocker or explicitly provisional preview.

### Critical: material edits do not invalidate the complete approval chain

Evidence: `apps/api/src/index.ts:2197–2212` inserts a material assignment and marks artifacts stale only. Approval checks at 2484 inspect module timestamps, not material revisions. No corresponding material invalidation trigger was found in repository migrations; live trigger parity remains to be checked.

Impact: an approved scene can retain an obsolete finish and produce inconsistent production/render output.

Confidence: high for application path; live trigger behavior unverified. Next module: implementation.

Task F03: transactionally save edits and invalidate affected scenes, approvals, render requests/results, production snapshots, and commercial quantities. Compare a revision/fingerprint at approval and generation time. Reuse module-output-invalidation behavior and fail closed if invalidation fails.

Acceptance: change material, size, bay, opening, floor, or placement; old output is clearly stale and cannot be newly approved/exported. Simultaneous edit/approve and edit/render-completion races reject obsolete revisions.

### Critical: presentation and sign-off misrepresent project state

Evidence: `apps/web/src/components/delivery/DeliveryWorkspace.tsx:70–140` defines hardcoded reference rooms/images rendered around line 413. Scheme selection at 228 updates local storage while copy at 535 claims downstream propagation. Sign-off at 237–254 sets local approval before confirming the database result and ignores its error.

Impact: a client can see unrelated sample output or an approval that was never saved.

Confidence: high. Next module: implementation.

Task F04: populate presentation from the selected project's artifacts and versioned material choices. Persist sign-off actor, scope, revision, and timestamp before displaying success. Provide a real empty state and explicit review-only references.

Acceptance: no project shows another project's/reference renders as its deliverables; failed or forbidden sign-off cannot show success; edits stale prior approval; shared links enforce scope and revocation.

### Watch: AI QA cannot support its strongest accuracy claims

Evidence: `apps/api/src/visual-jobs.ts:659` runs enhanced-image QA in moderate mode; this downgrades geometry findings to warnings. Review approval at 764–782 lacks QA/stale-scene gating. Measurement around 247–294 uses edge occupancy for presence, leaves invented objects empty, and converts edge similarity into nominal camera millimetres without a physical camera estimate.

Impact: real pixel inspection exists, but is not semantic object recognition or a guarantee of preserved measured geometry.

Confidence: high. Next module: implementation, followed by independent measurement benchmark.

Task F05: report pixel alignment in honest units, unmeasured properties as unknown, explicit review-required status, and stale revision checks on review. Define hard blockers versus review warnings. Add independent semantic image measurement only with benchmark evidence. Keep construction dimensions sourced from scene geometry.

Acceptance: altered door/window, extra object, shifted camera, invalid image bytes, timeout, expired provider URL, storage failure, and changed-scene-during-render all have correct observable outcomes. Complete one real provider job and retrieve its durable image after reload.

### Watch: analyzer quality needs deployment and measurement evidence

Evidence: production readiness says `planCv:false`; normalized tracer already exists. OCR association and geometry reconciliation exist, but a representative held-out benchmark and hosted CV invocation were not demonstrated.

Impact: hosted analysis may not use the same evidence sources as local tests. No numerical accuracy claim is justified yet.

Confidence: high for readiness, unknown for measured accuracy. Next module: context-survey then implementation.

Task F06: establish whether the approved hosting setup can serve the existing CV path, with explicit cost discussion only if a new paid service is needed. Preserve coordinate transforms and vector preference. Build labeled held-out examples from permitted customer plans; score door/window precision/recall, boundary error, dimension association error, and correction effort. Persist manual corrections with provenance.

Acceptance: paired high/low-resolution plans converge within declared tolerances; absent scale blocks measured output; ambiguous gaps stay uncertain; corrected openings survive reload and appear consistently in plan, 3D, elevations, and render inputs.

### Watch: secondary features have misleading or incomplete saves

Evidence:

- `SpacesWorkspace.tsx:1807–1834`: feature-wall placement does not validate the subsequent compile response before saying the 3D scene updated.
- `apps/web/src/features/studio/StudioAdminScreens.tsx:381–408`: local settings are saved broadly, but server PATCH sends only name and ignores errors; contact defaults around 347 are fabricated.
- `apps/web/src/features/tools/ModularUnitPlanner.tsx:554`: production badge derives from export-support booleans.
- `apps/web/src/features/tools/StudioOperations.tsx:49,60`: calendar/invoice creation lacks project ID.
- `apps/web/src/App.tsx:1396–1397`: render and finish tabs still mount the same legacy workspace without distinct focus.

Confidence: high. Next module: implementation.

Task F07: truthful request states, version-specific template certification distinct from placement fit, persisted studio settings with actual downstream use, optional project context in operations, and dedicated render/finish task surfaces. Remove dead editor branches only after route parity is proven.

Acceptance: every visible save reports server success/error honestly; no default contact or commercial values are represented as real studio records; every navigation action preserves relevant project/room context.

### Watch: verification and dependency gates need repair

Evidence: root `package.json` reliability and `scripts/test.mjs` omit dedicated scene-compiler/module-framework tests and other package suites. Scene compiler's own script covers only `tests/index.test.ts`, while additional files exist. Browser check fetches health only. Uncommitted `apps/api/test/browser-e2e.test.ts:44` references `browserRequired` before declaration at 58 on import failure.

Fresh browser command exited 0 with **0 passed, 1 skipped**, after browser launch timeout. This is not a browser pass.

`npm audit --omit=dev --json` exited 1 with 4 affected package entries: qs moderate, react-router high, react-router-dom high (dependent on router), sharp high. Router advisory is specific to RSC mode, so SPA exploitability must be evaluated separately; sharp deserves particular attention because the app accepts images. Audit output indicated fixes available. Do not run an unreviewed forced upgrade.

Confidence: high for observed output; attack reachability unverified. Next module: implementation.

Task F08: repair test discovery and browser setup; make required CI tests fail rather than skip; add actual authenticated browser coverage; update affected dependencies deliberately and rerun image decoding, plan ingestion, routing, and build tests. Publish a count of executed tests and skips by subsystem.

Acceptance: all intended package tests are discovered, required browser tests execute, dependency advisories are fixed or explicitly assessed with documented rationale, and authenticated workflows run against the exact release SHA.

## Ordered delivery sequence

1. **Protect production authority:** F01 export routes, F03 revision invalidation, F04 honest sign-off. Add negative endpoint tests before promoting fixes.
2. **Connect the room-design state:** F02 persisted bays/floors/intent/3D, then F07 save errors. Prove one wardrobe plus freestanding island survives refresh and another session.
3. **Prove rendering:** F05 provider capability, durable output, honest QA and review. Capture scene ID, job ID, provider/model, image hash, storage identity, and final status.
4. **Prove manufacturing delivery:** generate elevations/sections, workbook, panel labels, nesting, finishes, hardware, and dossier from that same revision. Check part IDs, quantities, grain/edging/kerf, door clearances, component mounting height, and floor areas. Compare to the user's spreadsheet/PDF samples after reopening those files; historical familiarity is not a substitute for this comparison.
5. **Improve analyzer with evidence:** F06 hosted CV/vision/vector composition and held-out metrics. Ship manual correction as part of the finished workflow, not an exceptional developer task.
6. **Simplify all screens:** one room workspace with catalog, visible canvas, inspector, and one contextual next step; finish F07 across the remaining tools. Avoid a full rewrite of large components.
7. **Release proof:** F08 full coverage, authenticated hosted journey, mobile/desktop interaction screenshots, permissions, concurrent-edit recovery, migration parity, and rollback evidence.

F08 test-discovery and dependency work can run alongside phases 1–2. Frontend and backend contributors should own separate files; one integrator owns shared contracts and revision semantics.

## Every feature's completion test

| Feature | Required evidence before calling it complete |
|---|---|
| Dashboard/projects | Create/resume correct persisted stage; no fabricated metrics or duplicate destinations; deletion scoped to authorized project |
| Brief | Saved room requirements, retained items, appliances, and INR budget survive reload and affect downstream constraints |
| Plan upload/analyzer | Signed upload, supported formats, durable queued job/recovery, calibrated coordinates, confidence, correction persistence, benchmark report |
| Spaces/placement | Wall-first and furniture-first placement; exact preview/drop offset; opening keep-outs; islands; zoom/pan; keyboard cancel; failures retain drafts |
| Library/modules | Each supported family has versioned certification; min/nominal/max dimensions; independent components; favorites/recent/presets persist as intended |
| Materials/moodboards | Supplier/version/swatch provenance; no missing image dead ends; allowed slots and texture scale; visual references cannot certify geometry |
| Flooring | Persisted region and holes; grid/brick clipping; quantities and rendering share calculation; doorway skirting exclusions; room isolation |
| 3D | Server scene and parts; no invented approved dimensions; lighting/openings/sill/skirting/camera represented consistently; load failure visible |
| AI render/finish edits | Real image request, conditioning supported, no hidden paid fallback, durable storage, retry/idempotency, scene version retained, honest QA |
| Drawings | All selected walls, sections/details, geometric chains, no invented modules, readable revision/scale/unit/provenance title blocks |
| Production | Workbook/labels/nesting/dossier share physical part IDs and approved revision; oversized panels and stale data rejected |
| AURA | Contextual proposal, appropriate approval, persisted mutation before success, failed tool execution visible |
| CNC | Vetted pattern and actual DXF; material/tool clearances; no photo represented as certified toolpath |
| Converter | Canonical mm, reversible unit conversions, invalid/ambiguous input errors |
| Estimates/invoices | Project-linked approved quantities, explicit unpriced items, INR and reviewed taxes, persisted totals and permissions |
| Calendar | Real project/event persistence; time zone, edit/delete, refresh and failure behavior |
| Team/settings | Organization roles and isolation; real saved settings; no fabricated staff/contact fields |
| Presentation/collaboration | Own project artifacts; durable comments/sign-off; immutable approved version; scoped/revocable private links |

## Hosted acceptance scenario

Use one named QA project on main, with ordinary account authentication. Do not impersonate users or disable Preview/auth guards. Record test-created assets for controlled cleanup.

1. Upload a permitted plan; calibrate against a known dimension; correct doors/windows and save.
2. Create/select rooms and place wardrobe and island with measured custom dimensions.
3. Persist bays, materials, flooring, and render intent; reload and compare from another browser context.
4. Compile and approve the saved revision; verify openings, camera, sill heights, floor and skirting.
5. Generate a real AI render; reload its stored image and inspect QA/review status.
6. Download every production format; reconcile identities, dimensions, totals, and revision.
7. Change one dimension and one finish; verify all affected approvals/outputs become stale.
8. Exercise interrupted save, duplicate render submission, provider timeout, unauthorized project access, and concurrent edit.
9. Repeat core interactions at 1440×900, 1280×720, 1024×768, and 390×844 with screenshots and overflow/keyboard checks.

## What this audit did not prove

- No authenticated production design/render/export journey was executed; no signed-in test session was available in this audit.
- No fresh provider image was generated. Configured/eligible is not equivalent to successful generation.
- No new cross-device persistence, tenant-isolation penetration test, storage-revocation test, or rollback rehearsal was performed.
- No fresh complete reliability run, all-package coverage report, or benchmark across every customer attachment was performed.
- Vercel project-tool schema differed from the available metadata; current identity was instead verified through the deployed API and Git remote.
- All historical files and third-party repositories have not been re-read. Carry their reuse/license decisions into the evidence inventory before any further imports.

## Completion checkpoint

Current sequence: project audit and completion planning. Completed: remote/deployed identity, migration-ledger read, subsystem review, fresh targeted geometry tests, dependency audit, browser-attempt result, ranked task and acceptance plan.

Current skill: project-audit. Next required skill for this requested audit deliverable: none. Action: stop at the requested planning boundary. No implementation or release completion claimed.

Next / upcoming implementation task: F01 — inventory every export handler, route fabrication requests through persisted authenticated production context, and prove forged/stale/cross-project requests fail. Then F03 and F02 establish one authoritative design revision before further visual expansion.

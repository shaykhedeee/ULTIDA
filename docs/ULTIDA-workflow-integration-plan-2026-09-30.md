# ULTIDA workflow integration and launch plan

Updated: 2026-09-30
Working release line: `codex/ultida-unification`
Scope: make the designer journey understandable, preserve one saved source of truth, and prove the hosted product before calling it live.

## Intended customer journey

**Start or reopen a project → upload and confirm a plan → work on one selected room → place and finish furniture → review the saved 3D scene → approve → create presentation imagery → review drawings and cutlist → deliver the approved revision.**

The main screen should always tell the designer: which project and room are open, what is saved, what needs review, what action comes next, and which outputs become stale after an edit. Technical stages such as compilation remain behind familiar actions such as **Review this room in 3D**.

## Fresh repository findings

- The integration branch contains `origin/main` and is two commits ahead of it. At audit time, `origin/main` was `24dcb270` and the integration tip was `459c8326`. This is source-control evidence only, not a deployment check.
- The five-step shell omits `plan` as a route alias, so its stepper could disappear while a designer was on plan review. Plan review now resolves to the combined **Brief & Plan** step.
- The project already accepts room-scoped modules, wall schedules, and floor surfaces in the scene compiler. Before this pass, the UI kept bay and flooring data only in browser storage and the compile action sent neither. The compile flow now resolves the chosen plan room to its persisted space, loads that room's saved module records, and submits only schedules on those module walls and floor surfaces for that room.
- The active-plan endpoint now returns bay and flooring records from the latest scene of the same plan revision. Spaces restores them when no local draft exists. The UI now calls these browser-only edits drafts until a scene compile saves them with the project.
- The 3D action previously refreshed the displayed scene instead of calling the compile callback whenever any scene object was present. It now requests compilation for the selected room and reloads only after compilation returns a saved version ID.
- Existing drawing-core and elevation edits from the preceding task were present before this pass and have been preserved. They are not silently bundled into the findings above.

## Integration work completed in this pass

1. Corrected the project stepper alias and plan-stage completion state.
2. Bound scene compilation to a selected room's persisted space record and module instances rather than a stale browser module list.
3. Carried that room's confirmed bay schedules and flooring surfaces into the server-validated, versioned scene.
4. Restored those inputs from the saved scene on project reload while retaining local drafts when they exist.
5. Replaced the misleading 3D “refresh” action with a real compile-and-reload action.
6. Kept room routing scoped to the room selected in Spaces.

## Ranked completion plan

### Gate 1 — One authoritative project revision

- Persist design intent, room settings, modules, bay schedules, flooring, material assignments, and render intent against a single project/plan/scene lineage.
- Treat local storage as recoverable drafts only. Show unsaved and save-failed states; never treat a browser draft as approved project data.
- Make every geometry, opening, module, bay, finish, and floor edit invalidate dependent scene approval, render, drawing, cutlist, estimate, and delivery outputs.
- Add tests that clear browser data, reload the same project, and compare persisted geometry and component identities.

### Gate 2 — Trustworthy plan analysis and room setup

- Upload the actual source file, retain its coordinate transform, and show AI, CV, vector, OCR, and manual evidence separately.
- Let a designer correct doors, windows, columns, beams, room boundaries, and dimensions; persist every correction with provenance and confidence.
- Keep scale unconfirmed until the designer confirms a known dimension or an independently trusted vector measurement is available.
- Use labeled held-out plans to measure opening precision/recall, room boundary error, dimension error, and correction effort. Do not publish an accuracy multiplier without results.

### Gate 3 — Simple one-room furnishing

- Keep the room visible beside the catalog and inspector. Start with click-to-place, then offer drag placement through the same fit controller.
- Preview the actual footprint, wall, offset, orientation, opening clearances, and fit reason before save.
- Persist catalog module identity and dimensions. Allow free-standing items only through a distinct free-position placement path; never coerce them to a wall.
- Make the next action contextual: **Save room**, **Review in 3D**, or a concrete correction, not several competing compile buttons.

### Gate 4 — One saved 3D scene and honest AI output

- Compile only persisted module instances and approved plan geometry for the chosen room.
- Prove openings, sill/head heights, columns, beams, flooring, skirting, lighting, and material assignment survive into the scene and camera passes.
- Generate a real provider image from that exact scene revision; record provider/model, job, input fingerprint, and durable image identity.
- Verify the image after reload. Keep AI output presentation-only and label measurement QA as unknown wherever the image has not been measured.

### Gate 5 — Production release

- Drive elevations, workbook, labels, nesting, hardware, finishes, and dossier from the same approved scene and production snapshot.
- Use stable physical part IDs across drawings and spreadsheet. Reconcile total dimensions, bay widths, stock thickness, backs (6mm vs 18mm), laminate faces, grain, edging, kerf, openings, and quantities.
- Require server-side project authorization, current revision, confirmed scale, reconciled bays, component certification, and persisted production review on every construction export.
- Check generated XLSX/PDF/DXF files open and cross-reference one another before release.

### Gate 6 — Whole-app usability and live launch

- Audit every visible route/action: dashboard, brief, plan, Spaces, library, 3D, renders, production, commercial, AURA, CNC, calendar, invoices, team, settings, and presentation.
- Consolidate duplicate entry points only after preserving project/room context and verifying route parity.
- Check 1440×900, 1280×720, 1024×768, and 390×844 layouts, keyboard focus, save/error/empty/loading states, and refresh recovery.
- Run all intended package tests in CI, including compiler/module tests; require browser checks to execute instead of silently skip.
- Keep Preview writes blocked while it shares the production database. Use production only for explicitly authorized QA data; do not treat Preview as a safe write environment.
- Merge only after CI and an authenticated hosted journey on the exact SHA pass. Confirm Vercel and worker health, database migration state, provider readiness, storage retrieval, and rollback path after deploy.

## Required end-to-end release evidence

Use one clearly identified QA project and record created test assets for cleanup. Sign in normally. Upload a permitted plan, calibrate it, correct and save openings, configure one room, place a wall module and (when supported) a free-standing item, set a bay schedule and floor finish, compile and approve, create and reload a real AI image, then download the workbook, labels, nesting, elevations, and dossier. Change one dimension and one finish and confirm all dependent outputs become stale. Repeat at desktop and mobile sizes. A passing local build is not a substitute for this hosted evidence.

## Current verification checkpoint

This pass verified API and web TypeScript checks, API and web builds, all 50 drawing-core tests, and the complete API test runner. Two independent Python-based DXF checks skipped because Python is unavailable on this machine. The web build succeeds with a non-blocking large Three.js bundle notice. No authenticated hosted design/render/export journey was executed in this pass, so live readiness remains unproven.

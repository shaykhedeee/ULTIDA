# ULTIDA: document-first design workflow

1. Confirm plan: scale, room boundaries, doors, windows and uncertain measurements.
2. Design one included room: choose a unit, select an optional style reference, place and resize on measured geometry.
3. Confirm finishes: standard internal liner, per-unit external face, backing construction, glass, hardware and lighting.
4. Review saved 3D, approve its revision, then generate optional AI presentation images.
5. Review final design document: project/revision, plan, room scope, openings, module elevations, external/internal component dimensions, finish legend, electrical notes and confirmation items.
6. Generate certified cutlist/workbook, labels, nesting and CNC only after specification approval.

## Laminate attachment

- Project `carcass` assignment is the internal finish standard. A unit-specific assignment overrides it.
- Project `shutter` is the external finish standard; each unit may override it independently.
- Back-panel finish is a separate `backPanel` assignment. 6/18mm backing is construction geometry, not a laminate selection.
- Shelves and drawer boxes inherit internal carcass finish; fronts inherit shutter finish. Glass, hardware, countertop and lighting retain separate slots.
- Missing finishes remain unconfirmed. Do not substitute external laminate for internal parts.
- These slots are visual/finish assignments, not board substrate definitions. Core board thickness, laminate face thickness, edging and finished-size allowances still need explicit fabrication approval.
- Style photographs guide appearance, never panel dimensions or substrate specifications.

## Implemented this pass

- Corrected scene part finish routing.
- Populated previously empty dossier plan, module elevations and finish schedules from persisted scene data.
- Opens document/release view before cutlist by default.

## Remaining launch acceptance

Verify real signed-in saves, image generation, PDF visual layout and all downloaded documents against one approved project. Complete explicit core/face thickness and hardware schedules; missing data must not become fabricated stock quantities or specifications. Final-document coverage is not yet complete: embedded approved renders, wall-based opening/sill dimensions, full core and hardware matrix, and designer sign-off checklist require follow-up.

## 2026-10-01 document integrity follow-up

- Dossier cover now draws saved walls and measured opening ranges, with an explicit not-to-scale overview label. It no longer draws simulated cabinets or asserts verified renders.
- Draft status no longer displays production approval. Material standards and site measurement checks are requirements rather than unsupported certification claims.
- Blocked document release offers a direct room/3D review action.
- Verified drawing-core compilation, 50 drawing tests, PDF regression and frontend TypeScript. Full reliability and hosted checks must be recorded independently.
- Still required: embedded saved renders, full-page plan and wall opening/sill schedules, hardware/core specification completeness, visual PDF inspection, and a signed-in hosted render/export journey.

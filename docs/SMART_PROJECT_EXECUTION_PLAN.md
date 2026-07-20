# ULTIDA Smart Execution Plan

## Current Product Truth

- The canonical workflow is in place: brief, plan intake, scene design, visual proposals, documents and delivery.
- The code correctly treats approved plan versions and `scene.v1` as the source of truth for downstream outputs.
- The immediate sellable gap is output depth: 3D render generation and 2D elevations must become visibly professional, scene-linked and honest about provider availability.

## Highest Priority Work

1. Make render provider status and render output provenance visible in the Visualize stage.
2. Upgrade the Document stage into a real drawing package workflow: floor plan, wall elevations, DXF export, module schedule and review status.
3. Replace baseline-only plan detection with calibrated measurements before any approval can be treated as production-ready.
4. Persist render and drawing artifacts against exact scene versions in Supabase.
5. Add focused API tests for visual-provider unavailable states, drawing package metadata and DXF export.

## End-to-End Product Structure

1. Brief: client identity, property, rooms, lifestyle, storage, kitchen, materials, budget, timeline, services, vastu, references and approvals.
2. Plan: immutable source upload, calibrated dimensions, confidence review, manual corrections and approval lock.
3. Scene: modular catalog placement, room compatibility, clearances, services, appliances and versioned `scene.v1` snapshots.
4. Visualize: scene-linked provider jobs, references, masks, prompt, seed, provenance, unavailable states and designer approval.
5. Document: floor plan, wall elevations, DXF/PDF, module schedule, cutlist and release review.
6. Commercial: catalog pricing, labour, GST, margin, quote versions, variations and approval.
7. Deliver: client approval, production release, installation checklist, snagging, warranty and handover.
8. AURA: read, propose and confirm tools over every stage; no tool may mutate source truth without an explicit approval boundary.

## Release Gates

- Brief saved before scene creation.
- Approved or locked plan before scene creation.
- Scene version required for visual, drawing and commercial outputs.
- Provider and artifact provenance required for any visual claim.
- Designer approval required before production release.
- Client approval required before installation handover.

## Started Now

- Fixed the web build output path so production builds write to the workspace `dist` folder.
- Exposed the existing DXF export action in the Document UI.
- Expanded drawing preview metadata so the API names the expected sheets, elevation views, production module count and quality gate.
- Added the first explicit Deliver workspace with release blockers and handover readiness states.

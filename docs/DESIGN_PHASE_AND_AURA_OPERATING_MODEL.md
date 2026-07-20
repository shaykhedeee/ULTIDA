# Design Phase and AURA Operating Model

## The design phase ULTIDA must complete first

ULTIDA's first complete customer workflow is not “AI generates a render.” It is:

`brief -> source plan -> enhanced/calibrated plan -> designer review -> approved spatial model -> room intent -> modular layout -> per-space visual proposal -> revisions -> approved design package`

Only after this is reliable do drawings, costing, cutlists, CNC and procurement become active production stages.

## Design workflow

| Stage | Designer action | System output | Gate |
|---|---|---|---|
| Brief | Capture lifestyle, scope, budget, style and Vastu preference | Versioned intake | Brief complete |
| Source plan | Upload PDF/image/DXF/DWG and site references | Immutable source asset | File accepted |
| Plan enhancement | Rotate, crop, de-skew, improve contrast and extract OCR candidates | Enhanced plan asset | Designer selects source |
| Calibration | Mark two points and enter one trusted dimension | Scale proposal | Scale confirmed |
| Spatial review | Accept/correct walls, openings, dimensions and rooms | Reviewed spatial model | Critical confidence issues resolved |
| Room intent | Mark TV wall, wardrobe wall, kitchen run, bed/sofa/dining/mandir zones | Intent layer | Each designed room has intent |
| Scene materialization | Create `scene.v1` from approved geometry and intent | Draft scene version | Geometry validation passes |
| Modular layout | Place parameterized modules, furniture and services | Scene revision | Clearance/rule checks pass |
| Per-space proposals | Select camera, references and style; generate AI visual proposals | Render set with provenance | Designer shortlists proposal |
| Revision | Prompt changes, material swaps and camera/lighting edits | New render branch or scene revision | Impact made visible |
| Design approval | Freeze the chosen scene and render set | Approved design package | Explicit user approval |

## Where each tool belongs

### Core now: design phase

- Plan enhancer and calibration
- AI/CV plan proposals plus manual review canvas
- Room-zone and module-intent annotations
- Parametric kitchen, wardrobe, TV unit, false ceiling and furniture placement
- Materials catalog and material slots
- Per-space render generator, render refinements and prompt edits
- Laminate/material changer
- Client comparison and design approval

### Downstream after design approval

- Elevation and DXF projection
- BOQ, cost estimate and quote
- Cutlists, nesting and hardware schedules
- CNC/G-code export
- Vendor, purchase order, factory, installation and handover

These are not removed. They remain workflow stages with hard gates: they cannot produce a final artifact until the source scene is approved.

## Laminate and “anything changer” design

The laminate changer is a material-slot operation, not a free-form image edit.

1. The designer selects a scene module or wall surface.
2. ULTIDA exposes valid material slots: carcass, shutter, countertop, wall panel, floor, ceiling, fabric, metal or glass.
3. The designer chooses a catalog laminate, uploads a reference, or requests an AI visual proposal.
4. The system creates a proposal branch and highlights commercial and production impact.
5. If accepted, the selected catalog material updates `scene.v1`; visual outputs become stale and regenerate from the new scene.

Prompt-only image changes are allowed as presentation experiments, but are labelled **visual-only** until mapped back to an actual material slot and catalog item.

## AURA: authority and tool model

AURA is an orchestrator, not the spatial source of truth. It works through a typed tool registry.

### AURA may read without confirmation

- Explain project readiness and blockers
- Summarize brief, plan review, room requirements and rule results
- Find catalog modules/materials
- Compare approved render branches
- Recommend the next workflow action

### AURA may prepare a preview, but cannot commit automatically

- Detect plan geometry and create proposals
- Suggest rooms/openings/dimensions
- Suggest furniture placement and Vastu alternatives
- Draft material changes or laminate swaps
- Queue visual proposals
- Draft elevations, cutlists or quotations

### AURA requires explicit confirmation

- Approve/lock plan or scene versions
- Commit geometry edits
- Change production materials or quantities
- Generate final DXF, cutlist, CNC, quote or client pack
- Send/share a client package
- Raise a PO, factory release, invoice or delete data

### First AURA tools

`summarize_project`, `analyze_plan`, `propose_calibration`, `propose_rooms`, `validate_plan`, `place_module`, `suggest_materials`, `create_visual_proposal`, `edit_visual_proposal`, `explain_stale_outputs`

Every tool request receives project ID, source version ID, user identity, inputs, job ID, provider status and audit trail. Tools return a typed result, a preview state, confidence, cost/time estimate and required confirmation level.

## Legacy admission map

The legacy repository contains potentially reusable code in these capability groups:

- Plan: `floorplan-analysis`, `plan-intelligence-core`, `cv-wall-detect`, `dxf-trace`, `dimension-validator`
- Geometry/rules: `geometry-guard`, `cabinet-math`, `kitchen-templates`, `design-engine`, `consistency-checker`
- Visual: `image-provider`, `provider-router`, `comfyui-workflows`, `blender-renderer`, `render_scene.py`
- Drawings: `dxf-writer`, `dxf-validate`, `elevation-generator`, `pdf-elevation`, `drawing-generator`
- Production: `cutlist-engine`, `nest-optimizer`, `cnc-cut-generator`, `cnc-gcode-generator`
- AURA: several overlapping `aura-*` services and orchestrators

No service is copied directly. Each candidate must pass: license/security review, isolated build, one contract adapter, golden kitchen/living fixture, and removal plan. The multiple legacy AURA services are reference material only; the new app gets one AURA tool registry and one orchestration service.

## Next implementation order

1. Reconcile and apply Supabase migrations after live-schema inspection.
2. Finish authenticated organization/project persistence and immutable source upload.
3. Implement the plan review canvas as its own tested component.
4. Add deterministic preprocessing and manual calibration/walls/openings/room-zone editing.
5. Add plan-analysis proposals and confidence/review queues.
6. Approve plan -> materialize `scene.v1`.
7. Add modular kitchen and living-room placement fixtures.
8. Add per-space visual proposal and material-slot changes.
9. Add AURA with read/propose/confirm tool permissions.
10. Only then activate elevation/DXF, cutlist, CNC and commercial release paths.

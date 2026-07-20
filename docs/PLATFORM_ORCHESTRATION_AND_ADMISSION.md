# Platform Orchestration and Admission

## One runtime decision

`ULTIDA/` is the only active product repository and runtime. The legacy repository is read-only reference material until a capability passes admission.

No code, database file, generated DXF/PDF, storage folder or AI provider configuration is moved wholesale from legacy.

## Product layers

| Layer | Owns | Must not own |
|---|---|---|
| Workspace | organization, role, projects, brand settings | geometry or provider secrets |
| Intake | lead, client brief, budget, references | final module geometry |
| Plan intelligence | source assets, preprocessing, spatial proposals, confidence, review | scene decisions without approval |
| Scene core | approved rooms, walls, openings, modules, materials, rules | raw provider responses |
| Visual studio | proposal jobs, prompt, masks, camera, provider provenance | unreviewed geometry truth |
| Drawings | projections of approved scene | independent room dimensions |
| Production | BOM, cutlist, nesting, CNC and factory release | draft scenes or unapproved visuals |
| Commercial | quote, variations, vendor/PO and margin | material quantities detached from scene |
| AURA | workflow routing, explanation, tool invocation | direct uncontrolled database mutation |

## Feature placement

### Design phase, priority now

1. Brief and project setup
2. Plan upload, enhancement, calibration and review
3. Room intent and reference images
4. Scene materialization
5. Modular layout
6. Per-space visual proposal
7. Prompt refinement, laminate/material swap and comparison
8. Design approval

### Production phase, deliberately gated

1. Elevations, DXF and PDF drawing pack
2. BOQ, cutlist, nesting and hardware schedules
3. CNC/G-code export
4. Quote, variation, procurement and factory release
5. Installation, handover and warranty

## AURA implementation shape

### One service

`packages/aura-tools` defines tools and schemas. `apps/api` authorizes and records calls. `apps/worker` executes durable jobs. The web client only displays plans, previews, approvals and job state.

### Tool contract

Every AURA invocation contains:

- organization ID, project ID and authenticated actor
- exact source version ID
- typed input
- permission level: read, preview, confirm
- job ID and idempotency key when asynchronous
- result, confidence, provenance, cost and failure reason

### Starter tool groups

| Group | Tools | Permission |
|---|---|---|
| Understand | summarize project, explain blockers, search catalog | read |
| Plan | analyze plan, propose rooms, propose calibration, validate geometry | preview |
| Design | place module, suggest layout, suggest materials, create render request | preview |
| Visual | edit material, relight, remove object, compare proposals | preview |
| Release | approve plan, lock scene, generate drawing, generate cutlist, issue quote, release factory pack | confirm |

## White-label requirements

- Each organization gets brand name, logo, colors, terminology, proposal title block and client portal domain configuration.
- Organization RLS applies to every project, asset, version, job and output.
- Provider credentials remain server-side and may be organization-scoped only through encrypted configuration.
- Every exported client/factory artifact records the studio brand and exact source versions.

## Legacy candidate admission

| Legacy capability | Candidate role in ULTIDA | Admission condition |
|---|---|---|
| Plan intelligence/CV/Python scripts | Worker adapter | fixture accuracy and review payload contract |
| DXF/elevation writers | `drawing-core` adapter | AutoCAD fixture validation and dimension consistency |
| Cutlist/nesting/CNC services | `commercial-core`/production worker | approved-scene-only input and golden kitchen fixture |
| Provider/image services | `provider-gateway` adapter | provenance, cost and truthful failure contract |
| Multiple AURA services | reference only | consolidate behavior into typed tool registry; no direct port |
| Catalog and material services | `catalog-core` adapter | SKU/material slot contract |

## Safe cleanup policy

- Delete only generated caches, local build output and ignored temporary files in `ULTIDA/` after confirming they are untracked.
- Archive, do not delete, legacy source, client outputs, SQLite databases, historical DXF/PDF files or LFS assets.
- Every archival move gets an inventory entry with original path, reason, owner and recovery location.
- Do not remove a duplicate generator until canonical-output fixtures prove parity.

## Next three implementation milestones

1. Refresh Codex so authenticated Supabase MCP tools are available, inspect the live project, reconcile and apply migrations.
2. Extract `PlanReviewCanvas` and implement manual wall/opening/zone/dimension editing plus approval locking.
3. Create `aura-tools` contracts and one read-only project readiness tool before permitting any AURA mutations.

# ULTIDA: competitor research and exact-room module delivery

Research date: 2026-10-07. Source baseline: audit branch 31a8a0d.

## Evidence limits

This review inspected official product pages/documentation and current ULTIDA source. Vendor promises are not independent benchmarks. No competitor subscription, private backend, or paid rendering trial was tested. Materialogue and Zygn exposed too little readable content for a detailed feature assessment. This is not a completed license/source audit of every GitHub repository previously supplied.

## Competitive landscape and decisions

| Product / official source | Observed offering | Useful ULTIDA decision |
|---|---|---|
| [Infurnia](https://www.infurnia.com/kitchen-design-software) | Connected room shell, customizable cabinetry, materials/hardware, quotations and manufacturing outputs | One construction model should supply all deliverables; avoid separate drawing and cutlist calculators |
| [AiHouse](https://www.aihouse.com/global/help-center/3d-home-design/793) | Configured cabinet annotation and CAD exports | Give each configured module internal/external elevations and sections from its saved components |
| [Roomle](https://docs.roomle.com/rubens/content-creation/overview) | Parameters, rules, materials and geometry control product configuration | Parametric components are the core; static GLBs supplement visual detail |
| [SketchUp LayOut](https://sketchup.trimble.com/en/products/layout) | Model-linked drawing documentation | Update drawings from a revision; flag stale dimensions rather than silently reusing them |
| [Cabinet Vision](https://hexagon.com/products/cabinet-vision) | Cabinet design/manufacturing platform | Treat workshop construction rules as data; test them against real panel schedules |
| [Decor8](https://decor8.ai/) | Photo upload, styles, cabinet/paint visualization, staging and API | Make style selection simple; offer material-only presentation changes without rebuilding geometry |
| [Interior AI](https://interiorai.com/) | AI interior-design and virtual-staging product | Benchmark fast concept exploration separately from production-authoritative design |
| [ArchiVinci](https://www.archivinci.com/about) | Source-based visualization and separate creative modes; geometry-preservation claims | Clearly separate faithful presentation from creative proposals; measure drift ourselves |
| [MoldaSpace](https://www.moldaspace.com/) | Photos/plans/model exports to options and side-by-side approval workflow | Present alternatives in the room's saved context and record which revision was accepted |
| [GenRoom](https://genroom.io/) | Photo-first room/exterior/garden restyling with styles | Reduce prompt burden with room/style presets; do not mistake attractive examples for measured fidelity |
| [MeltFlex](https://www.meltflexai.com/create) | Room/style/budget choices and shopping-oriented references | Keep optional sourcing references separate from certified casework dimensions |
| [dsgnr](https://dsgnrai.com/) | Surface-level changes, reusable workflows and private presentation links | Use selected-object masks when supported; reuse render intent; scope client links to a revision |
| [RDash](https://rdash.ai/) | Drawing revisions, approvals, BOM/assemblies, procurement and site workflow; some AI agents marked coming soon | Carry design decisions into delivery; don't expand into a full ERP before core design works |
| [Project Studio](https://www.projectstudio.ai/software/) | Site recce, moodboards, annotated drawings, finishes/makelists and BOQ | Maintain a designer-readable selections schedule and source evidence alongside the model |
| [BuildFlow](https://trybuildflow.in/) | Advertises multi-format inputs, editable plans/models, renders and reports | Benchmark one input-to-output project; verify each format rather than copying broad claims |
| [DPixels](https://dpixels.co/) | Architectural visualization service, films and walkthroughs | Use as a presentation-quality reference, not a reusable software/backend integration |
| [Zygn](https://zygn.app/) | Page identifies interior project management/sales CRM; details not accessible | Defer detailed assessment; no assumed integration |
| [Materialogue](https://www.materialogue.com/) | Insufficient readable page content | Defer detailed assessment; no imported catalog or rights assumption |

## Where ULTIDA currently falls short

The strongest opportunity is a simple measured-room workflow that also understands local modular manufacturing. More isolated tools will not solve its handoffs.

Verified source gaps:

- Drawing projection discarded module `position.zMm` and opening sill height. Elevated cabinets/lofts and windows could appear on the floor in SVG/DXF/PDF. Fixed in this pass, with regression tests.
- Shared carcass side panels already exist. Replacing them would not address current integration problems.
- Some elevation exports infer plinth/drawer/loft zones from a module envelope rather than its exact components. These assumptions must be replaced by component-derived details before treating them as fabrication instructions.
- The scene preview had invented empty-room furniture and preparation could relabel mixed-room modules; the preceding audit commit removed these behaviors.
- Live render code already has scene expectation and raster alignment checks. These are useful, but do not prove semantic presence or exact dimensions in every AI-generated image.

## Module architecture: one unit, three outputs

Saved room + measured walls/openings + module parameters + construction preset + material assignments
→ validated components (`moduleParts`)
→ shared scene revision
→ 2D projections / deterministic 3D / production quantities.

AI presentation then uses the deterministic scene and saved camera. It must not supply construction measurements.

Each module needs:

1. Identity: template/version, family, supported size limits, room and wall/free-position anchor.
2. Design: front style, independent shutters/drawers, handles, glass/profile, lighting, selected reference IDs.
3. Construction: core thickness, back thickness and fixing method, clearances, shelf/support rules, fillers, loft arrangement.
4. Internals: editable bays; hanging-space/drawer presets checked against actual usable height and thickness deductions.
5. Finishes: internal/external face assignments, edge treatments, grain and physical texture scale; versioned studio defaults.
6. Evidence: template certification, placement fit, approval and source revision as distinct states.

Choosing a reference photo should propose supported parameters. Unsupported curves, fluting or trim stay style intent until modeled; never imply that the compiler built them.

## Exact-room presentation and drawing contract

- Compile only the selected saved room; preserve all relevant openings, structural obstructions, ceiling height and floor build-up.
- Preview the actual module footprint at the intended offset, validate fit, then persist the same placement.
- Derive front/internal/side sections from component positions, dimensions and material IDs. Avoid arbitrary cabinet anatomy in exports.
- Dimension overall width/height, mounting datum, bay chains, fillers, shelf/drawer levels and opening sill/head heights.
- Include material legend, stable part IDs, room/wall, units, source revision and review status on drawings.
- Render authoritative 3D first. Save the camera and conditioning artifacts with the job; use only conditioning the provider actually supports.
- Show generated image beside its base view and flag discrepancies. Unknown QA cannot become automatic approval.
- Reuse identical jobs; do not spend credits merely to redraw deterministic elevations or quantities.

## Implementation order and acceptance

1. Component-derived elevation details: one lofted wardrobe and one kitchen wall cabinet must agree in plan, 3D, SVG, DXF and PDF, including mounting height and opening sill.
2. Explicit room preparation: a multi-room project compiles only the chosen room, survives refresh, and reports specific approval blockers.
3. Module editor: style, internals and finishes update the same saved parameters; test min/nominal/max dimensions and 6mm/18mm back constructions.
4. Materials: internal liner/external laminate and edge bands appear in both the visual schedule and quantities without changing core dimensions accidentally.
5. Hosted AI benchmark: evaluate identical approved rooms/cameras, record provider cost, opening/object preservation and designer correction effort. No exact-pixel geometry guarantee.
6. Client package then production release: plans/elevations/finishes/renders in the design PDF; workbook/labels/nesting/CNC share the approved components and revision.

No competitor asset, code or paid provider was imported or enabled during this research.

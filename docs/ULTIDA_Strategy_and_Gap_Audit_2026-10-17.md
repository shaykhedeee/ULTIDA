# ULTIDA: from measured room to design-firm and workshop delivery

Research baseline: 17 October 2026 UTC / completed during 18 October IST. Repository: `shaykhedeee/ULTIDA`. Remote main recovered at `a281f45`; unpublished integration recovered at `bdcdfcd`. This report compares source, executable tests and official competitor/tool documentation. It does not certify the live application, factory accuracy or every product in the market.

## The product decision

Build a dependable modular interior workflow for an Indian design studio and its partner workshops. The central promise is that a selected cabinet, its dimensions, its material faces, its render, its elevation, its workbook row and its physical label refer to the same revisioned object. Deliver this on one real kitchen before expanding the claim to every furniture family.

Retain React/TypeScript, the existing Supabase data model, `scene.v1`, the module compiler and drawing/production packages. Python is a worker boundary for document/CAD/vision work, not an alternate cabinetry engine. AI retrieves and proposes; measured geometry and approved construction recipes determine what can be built. One authoritative factory pipeline must feed every format.

Three approaches were considered:

| Approach | Value | Cost and limitation | Decision |
|---|---|---|---|
| Finish the existing compiler and document pipeline | Preserves substantial working code and shared identities | Requires careful repair of authority, finish and release gaps | Recommended first |
| Buy/integrate a commercial manufacturing optimizer | Potential shop-proven cutting workflow | Commercial license, supported automation/runtime and data exchange must be negotiated; no public embedding right assumed | Evaluate against the partner workshop's actual machines after the canonical export is stable |
| Rewrite around a generative 3D model or another full design engine | Fast visual experiments | Does not establish panel dimensions, fittings or manufacturing lineage; high migration cost | Do not use as the construction authority |

## Competitive reality

Infurnia documents manufacturing release, cut-list CSV, board-layout PDF with board/margin/saw settings, label PDF and machine-format outputs. Coohom enterprise markets parametric cabinetry, cut lists/BOM/CNC. SketchUp plus OpenCutList already covers linked model workflows, labels and grain-aware cutting diagrams; current OpenCutList documentation distinguishes guillotine, rectangle and actual-shape nesting. These capabilities are meaningful competition, not a gap ULTIDA can simply claim to invent.

Client presentation features are also established: Foyr, Homestyler, Planner 5D and Cedreo document combinations of elevations, material tables, scaled PDFs and render reports. Agent B is a close AI presentation/workflow competitor; exact production engineering remains unverified in the sources reviewed. BuildFlow is an ambiguous product name, so the candidate URLs remain explicitly identified rather than merged into one competitor.

Manufacturing benchmarks include CABINET VISION, Mozaik, PolyBoard/OptiCut, imos and Microvellum. Benchmark engineering setup, construction methods, revision propagation, usable cutting plans and shop handoff—not only attractive renders. imos documents external optimizer integration rather than an internal cutting optimizer. The detailed evidence and source URLs are in [competitors.md](#appendix-a-competitor-research) and [manufacturing-tools.md](#appendix-b-manufacturing-and-tool-research).

The differentiation hypothesis to test is: **less setup and fewer manual corrections for Indian modular studios, while preserving exact supplier and factory identities across both documents**. Measure it against the nearest competitor using the same kitchen, supplier sheet sizes, kerf and workshop operator. Do not claim a market-first workflow, a fixed waste saving or better rendering quality without comparable evidence.

## What exists and what does not

The recovered catalog has 65 records across 18 family labels: 14 kitchen records, 5 wardrobes, 10 TV units, 6 crockery, 3 beds, 3 pooja, 3 study, 2 utility, 4 storage and additional purchased/decorative/lighting families. A record count is not manufacturing coverage. Each archetype needs its own construction recipe, constraints and acceptance evidence.

| Area | Existing implementation | Highest remaining gap |
|---|---|---|
| Plan intake | Durable analysis jobs, OCR/tracing, coordinate reconciliation, scale/geometry approval | Real surveyed-plan benchmark and hosted upload/reopen proof |
| Room workflow | Persisted spaces, wall bays, openings, room-scoped modules and scene compile | Simpler next-action UX, no hidden context switches, project-wide coverage |
| Cabinetry | Parametric compilers and exact module parts | Complete versioned recipes, clear inside dimensions, assembly/fit tests for every certified archetype |
| Materials/moodboards | Stable supplier references, scoped assignments, saved/recoverable boards and staleness | Authoritative substrate plus separate face-A/face-B finish records; authorized textures and physical sample approval |
| AURA/quotes | Measured-plan proposal lineage, explicit reviews and quote revisions in local integration | Paired migrations/deployment, real user review and rate evidence checks on hosted app |
| Renders | Saved camera, deterministic conditioning, visibility masks and outside-mask edit QA | Real provider and calibrated visual benchmark, not a promise that an image model cannot alter geometry |
| Client documents | PDF dossier, elevations, DXF/SVG and material/production sections | Assemble every in-scope room from an exact room-scene manifest; avoid selecting only the latest room scene |
| Factory outputs | Real XLSX, physical labels, grain-aware substrate nesting and production review | Consistent release status across every export; face schedules, actual QR, stock/offcuts and feasible cut sequences |
| Commercial BOQ | Scene-linked quote and pricing calculations | Unknown laminate counts currently appear as zero in some dossier/BOQ paths; missing quantities must remain unknown |
| CNC/IFC | Exchange/operation paths and examples exist | Exact machine profiles and manufacturer-specific machining/IFC round-trip acceptance are unproven |

The source map, symbols, API routes and confidence levels are in [repo-audit.md](#appendix-c-repository-audit). Existing draft size-entry workbooks should remain useful, but must not silently become released scene-derived factory data.

## The two deliverables

### A. Client design dossier

Produce a branded PDF from a manifest of exact approved room revisions, with source-linked specifications and an editable internal record. Page templates should support A4/A3, landscape/portrait, sheet number, view scale, issue date, revision and a room index.

| Section | Required content | Source/release condition |
|---|---|---|
| Cover and issue register | Actual project/client/team, scope, issue purpose, room list, revision history | Organization/project facts; missing facts flagged, never imaginary client data |
| Brief and site record | Requirements, surveyed dimensions, existing retained items, assumptions and exclusions | Approved brief and measured plan; uncertainty remains visible |
| Plans | Dimensioned existing/furniture plans, openings, clearances, ceiling/beam constraints | Exact reviewed plan and room-scene references |
| Room presentations | Approved renders, selected cameras, finish boards and alternatives | Scene-linked reviewed images; illustrative views clearly separated from dimensioned construction views |
| Elevations/sections | All relevant walls, heights, mounting levels, fillers, lofts, appliance voids, details | Same geometry/parts as the model; no invented shutter divisions |
| Material specification | Core, thickness, face A/B decor/finish/SKU, edges, paint/floor/countertop, supplier link and sample status | Versioned assignments and manufacturer source records; digital colour is not a physical sample |
| Hardware/appliances | Article, variant, quantity, fit requirements, installation source and service access | Exact approved fitting/appliance records |
| Services where commissioned | Lighting/RCP, switch points, plumbing or other service layouts with legends | Only from reviewed service objects; specialist review where required, never invented from a render |
| Commercial scope | BOQ/quotation revision, rate source/date, tax, labour and exclusions | Persisted reviewed prices; missing is not zero |
| Approval/handover | Client decision, open issues, installation/maintenance/warranty references | Typed approvals and actual supplier documents |

Do not include uncommissioned service drawings as if they were professionally engineered. A design firm may need additional local statutory, structural, electrical or contractual documents; represent these as scoped/reviewed deliverables rather than claiming universal compliance.

### B. Workshop production pack

Export one immutable ZIP containing a factory workbook, panel-label PDF/SVG, sheet-layout PDF/SVG, dimensioned part drawings and a JSON release manifest. Include machine files only for a validated machine/postprocessor profile.

Recommended workbook tabs: `Release`, `Rooms and modules`, `Panels`, `Substrates`, `Face laminates`, `Edge banding`, `Hardware`, `Stock sheets`, `Nesting placements`, `Cut sequence`, `Reusable offcuts`, `Panel labels`, `Unresolved checks`, `Revision changes`.

A panel row must carry physical part ID, module/room, source recipe/version, finished size, raw cutting size, core SKU/thickness, separate face-A and face-B SKUs and thicknesses, all four edges/allowances, grain and rotation rules, quantity=1 physical identity, machining-side convention and review status. Unknown machining records are blocked or visibly absent, not populated by generic hinge formulas.

Labels must be actually encoded QR or Code128 plus human-readable ID, finished/raw dimensions, material faces, four-edge mini-diagram, grain arrow, module/room, sheet position and release revision. Current SVG labels contain readable IDs and text saying “scan ID”; that is not an encoded scannable symbol. Label stock size, printer margins and 100% print scaling require calibration. A scanned label must resolve only to an authorized organization/project release; it must never expose a signed storage URL or credential.

## Plywood and laminate cutting logic

Two workflows need different grouping:

1. **Pre-laminated stock:** group compatible core SKU/thickness, face-A SKU, face-B SKU, finish batch/match group and stock/grain orientation. Unequal faces and mirrored/handed machining cannot be merged casually.
2. **Core cut before laminating:** nest core pieces by compatible core/thickness/stock rules; separately take off and nest the face rectangles with bonding/trim allowances and finish/grain/matching constraints. Preserve the face mapping back to every physical core panel.

A single surface material ID is not enough to distinguish these workflows. The current scene production snapshot does not authoritatively carry all these face records. Do not turn the separate size-entry workbook into a second production authority to fill this gap.

Optimization must use reviewed sheet sizes, actual saw kerf/tool diameter, edge trim, allowed rotations, grain continuity groups, defects/no-go regions, machine mode and offcut policy. MaxRects rectangle placements do not prove a panel-saw guillotine cut sequence. Keep the existing nesting implementation as the baseline; add a strategy interface and validator only after a representative workshop benchmark identifies the need. Do not run rectpack, OR-Tools and another custom packer as unrelated competing authorities.

Report purchased sheet count, net and raw panel area, trim/kerf loss, reusable offcuts and unrecoverable remainder separately. Every physical panel must appear exactly once in the workbook, label set and placement set. “Without wastage” should mean minimizing avoidable waste under those constraints; zero waste is not a universal promise. OpenCutList itself documents multiple objectives and no guaranteed perfect solution.

## How ULTIDA should learn modular furniture

Use a reviewed knowledge and construction system, not unconstrained web scraping or a model that memorizes random dimensions.

1. **Evidence library:** official manufacturer catalog/manual, article and variant, document version, publication/retrieval date, page/diagram reference, units, region, asset rights and source hash. Keep expired/withdrawn versions for issued releases.
2. **Construction recipes:** family/archetype, parameter bounds, board/back construction, net inside dimensions, part derivations, edge rules, joint logic, appliance/service voids and permitted fittings. Recipes are executable/versioned and tested.
3. **Retrieval:** keyword/structured filters first; optional embeddings for style and intent ranking. Apply hard dimension/fit/availability filters before suggesting an article. Retrieval similarity cannot authorize drilling coordinates.
4. **Constraints:** geometry, motion/swing envelopes, actual drawer clear width/depth, fitting loads, ventilation, plumbing/electrical access and installation order. Unknown product-specific rules require review.
5. **Learning loop:** capture designer corrections and factory deviations as proposed rule changes with provenance; review, test against the golden corpus and publish a new recipe version. Never silently self-modify production rules from chat feedback.
6. **Validation tiers:** visual-only, dimensioned-design, part-compiled, supplier-fit-verified, factory-reviewed and released. Wider catalog coverage must not automatically upgrade any tier.

Hettich publishes article-specific CAD/planning aids and Ebco publishes product catalogues; use those as ingestion sources. Merino explicitly notes that digital and physical colour can differ. Do not infer a universal hinge count, boring map, runner clearance, plywood thickness or load rating from an image or broad family name.

### Construction curriculum

| Family | Archetypes to cover progressively | Checks beyond outer W×D×H |
|---|---|---|
| Kitchen base | Hinged, drawers, sink, cooktop, dishwasher, bottle pullout, bins, blind/diagonal corners | Plumbing voids, appliance datasheets, drawer internals, hinge/runner collisions, worktop and plinth |
| Kitchen upper | Wall cabinets, lift-ups, dish racks, lofts, chimney niches | Mounting/support review, lift force/weight, depth differences, ceiling/dummy and service clearance |
| Kitchen tall/island | Pantry, oven/microwave tower, fridge surround, island/peninsula/breakfast | Ventilation, appliance swing/access, worktop supports, exposed backs, corner circulation |
| Wardrobe | Hinged, sliding, L/corner, loft, drawer, dresser, pocket/bifold where verified | Door/track overlap, internal clear width, hanging, drawer access, mechanism and wall support |
| TV/media | Floating console, towers, display, study combination, decorative back | Electronics access/ventilation, exact TV size, cable voids, wall fixing and panel joints |
| Crockery/bar | Glass towers, coffee/bar counter, corner and display | Glass profile system, shelf loading, lighting channels, access and service clearances |
| Pooja | Open altar, shuttered shrine, jaali, pullout tray, stepped niche | Material heat/electrical assumptions, tray mechanism and reviewed loads; no automatic cultural rule claims |
| Study/dresser/shoe | Single/L desk, drawer, wall shelf, mirror unit, seating/shoe cabinet | Knee/toe space, cable access, mirror/seat fixings and usable storage depth |
| Bed/seating | Platform, drawer storage, hydraulic lift, upholstered and bay bench | Mechanism envelopes, bed/mattress size, support and safe load review |
| Utility/bath/storage | Washing enclosure, tall storage, vanity, wall unit | Wet-zone core/edge decisions, drainage/ventilation, appliance access, mirror/electrical details |

For each archetype record supported configurations and explicit exclusions. Include at least a normal, minimum, maximum, awkward room/corner, wrong fitting and material-change test before upgrading its tier. Real factory feedback is required for manufacturing claims.

## Userflow that keeps the power manageable

Use one visible rail: **Capture → Furnish → Customize → Visualize → Document → Deliver**. The project home shows selected room, last saved state, next useful action and blocking issues. Technical details stay in a contextual professional inspector.

Capture: upload/choose page → calibrate from real measurement → independent witness check → review walls/openings/levels/services → approve. Preserve an editable/manual path if AI/OCR fails.

Furnish: choose room and brief → retrieve eligible recipes/products → generate distinct feasible layouts → show score/assumptions → save designer selection. Purchased products remain separate from manufactured parts.

Customize: wall/bay editor and component tree share identity; changing a shutter, shelf or filler updates the same module instance. Material selection exposes core/face A/face B/edge and exact fitting variant when the recipe needs them. Do not overload the novice view with every machining option.

Visualize: save camera → deterministic technical check → render → compare → review. Images never become panel geometry. Refresh and returning from another stage must retain the selected room and saved revision.

Document: choose exact room revisions and templates → completeness check → client dossier preview → issue immutable revision. A newer draft must not silently replace the approved room in an issued pack.

Deliver: review manufacturing profile and exact parts → choose stock/kerf/trim/machine mode → optimize → inspect exceptions → reconcile workbook/labels/placements → factory signoff → issue release. Commercial/client approval and factory release remain separate.

## Architecture and propagation

The authority chain is `plan version → room/layout → module recipe+configuration → exact parts+surfaces+fittings → scene revision → client/production manifests → generated files`. Stable identities and hashes travel through it; UI lists are views of this chain.

Use typed invalidation: geometry changes invalidate fit, scene, renders, drawings, nests and quotes; finish/grain changes invalidate affected material/render/nesting/procurement outputs; a texture-only change affects visual approval; supplier rate/tax changes affect quotes; camera-only changes affect renders/views. Persist the reason. Do not discard unrelated evidence when only a price changes, or retain a factory pack when grain changes.

New production-side data should extend existing contracts. Suggested planned contracts are `PanelSurfaceSpecV1`, `StockProfileV1`, `ProductionReleaseManifestV1` and `ProjectDossierManifestV1`; these are design proposals, not schemas already deployed. PostgreSQL remains the application store. NaCl's separate development graph is not a reason to add Neo4j to the customer product.

## Tool choices

Use existing ezdxf for independent CAD parsing/auditing. Add IfcOpenShell only when real IFC intake/export is on the accepted pilot, with schema/unit/property validation. Evaluate RoomFormer as research, not a drop-in image-plan parser; its MIT code does not license all training data/weights. CubiCasa5k is CC BY-NC and HEAT explicitly restricts commercial use, so neither is a default commercial training/deployment source without permission. Prefer a rights-cleared first-party plan corpus.

Keep Three.js for editing; use plain Blender/Cycles automation for high-quality scene-grounded final rendering if a cost/latency pilot justifies it. BlenderProc is mainly useful when procedural synthetic training data is needed. Optimize rights-cleared display GLBs with glTF Transform/meshoptimizer; retain unmodified manufacturing geometry. KTX2 is an asset-memory optimization, not a prerequisite to shipping correct documents; KTX-Software has mixed licensing that must be reviewed.

Retain the existing nesting engine initially. If measured quality is insufficient, benchmark a single strategy adapter against rectpack or an OR-Tools model or a licensed workshop optimizer, using identical input and validation. Require a feasible process plan, not just compact rectangles. See the linked tool/license matrix for exact repositories and primary license files.

## Execution priorities and proof

1. Close publication/deployment and hosted isolation gaps; verify the paired approval/transaction migrations without breaking the older API.
2. Unify production review/release authority across CSV, XLSX, SVG/PDF labels and nesting, drawings and machine download routes. Exact approved scene alone is not factory release.
3. Add authoritative core/face/edge records, unknown quantity states and finish-aware procurement/stock rules.
4. Build the project room-revision manifest and complete client dossier composition.
5. Encode/decode real labels and persist validated stock/nesting/offcut output once for all exports.
6. Certify the first measured kitchen and one wardrobe in a workshop; then expand recipes and AI layout coverage.

The first independent implementation plan is [production-release-consistency](#appendix-e-implementation-plan). It deliberately does not rewrite every subsystem at once. The architecture and measurable acceptance gates are in [the design specification](#appendix-d-design-specification).

Software checks are necessary but not sufficient. The real acceptance job must survive sign-out/in and refresh, change one cabinet dimension and one laminate, reject stale outputs, generate the client PDF and factory pack, match every part/quantity/face/grain across formats, decode printed labels and have the shop accept a physical assembly sample. No current test result is a claim that this hosted and physical proof has occurred.

## Research and execution limits

This is a broad, targeted study of the named and relevant competitors, not literally every competitor. Official vendor claims were separated from procedural documentation; no competitor paid demo or benchmark export was run. Prices and commercial terms were not guessed. The original manufacturer asset rights must be retained before rehosting textures/CAD files.

Superpowers was used for scope, parallel research, test-first repairs and planning. NaCl goal/init instructions were inspected; graph workflows are `BLOCKED/PROJECT_MCP_NOT_CONFIGURED` because no project `nacl_neo4j` tool was available. No graph bootstrap or `/goal` execution is claimed. No paid infrastructure or product migration was created for this research.


---

## Appendix A: competitor research

# ULTIDA competitor evidence review

Research date: 2026-10-17. Scope: measured floor plan → parametric cabinetry → render → client PDF with elevations/materials → factory XLSX, labels, nesting grouped by core/laminate/grain.

## Evidence rules and conclusions

This is a targeted benchmark of the named products, not an exhaustive market survey. Primary vendor documentation and official product pages were used. “Documented” means a source describes the operation; “vendor claim” means the official marketing page asserts it without independently verified product execution. “Unknown” means this research did not establish it; it does not mean the capability is absent. No paid account or hands-on export was tested. Do not infer fabrication accuracy from photorealism, a BOM, a quotation XLSX, or a construction PDF.

The strongest direct competitors are **Infurnia** (procedural design-to-manufacturing documentation) and **Coohom enterprise/SmartLink** (explicit manufacturing product claims plus construction/quotation documentation). **SketchUp + LayOut + OpenCutList** is an important composed workflow: the extension already covers XLSX, labels, grain-aware cutting diagrams and nesting. A defensible ULTIDA differentiation must therefore be demonstrated workflow reliability, ease of setup and specific regional/factory output requirements; “first tool connecting renders to production” is unsupported.

## Comparison at the requested workflow boundary

| Product | Supported evidence | Factory boundary / uncertainty | Practical lesson for ULTIDA |
|---|---|---|---|
| Coohom enterprise / SmartLink | Parametric cabinet library, renders, cabinet construction drawings; official cut-list/BOM/CNC claims | Enterprise configuration; quotation XLSX is documented, exact production XLSX schema, laminate/core grouping and grain policy not established | Benchmark catalog setup and manufacturing rule validation, not just room rendering |
| Homestyler | Parameter editing down to cabinet panels; construction elevations/material table; PDF/DWG/JPG | No primary evidence located for requested factory XLSX, labels and nesting chain | Editable dimensions, material tables and organized sheet composition are expected client-document features |
| Foyr Neo | Saved elevations, manual annotations/dimensions, branded scaled PDF and DXF floor plan export | Cabinet engineering and factory nesting not established | Treat presentation sheets as a distinct, editable deliverable |
| Planner 5D | 2D/3D planning, PDF report with blueprint, plan, renders and elevations | Vendor explicitly describes it as planning/visualization; factory outputs not established | PDF generation needs visible progress and saved output history |
| Cedreo | Scaled plans, sections/elevations and synchronized presentation documents | Building documentation emphasis; cabinet panel production not established | Model edits should update related drawings and presentation sheets |
| Infurnia | Modular kitchen design; cut-list CSV, board-layout PDF, configurable label PDF, CNC output | Exact XLSX output, nesting by separate front/back laminate and explicit grain constraints remain unverified | Release/verification gate and shop settings are central product features |
| SketchUp / LayOut + OpenCutList | Linked model documents, dimensions, PDF; extension XLSX, labels, cutting diagrams/nesting | Multiple tools; component axes/material setup matter; exact requested core/laminate grouping not established | Do not make users maintain panel identity or orientation manually across exports |
| Agent B Studio | Official plan lists elevations, product drawings, BOM calculator and client presentations; AI visualization workflow | No procedural proof located for fabrication-level parametrization, factory XLSX or nesting | AI concept workflows are close presentation competitors; verify geometry fidelity separately |
| BuildFlow (ambiguous) | trybuildflow.in claims plan editing, AI visualizations, IFC, BOQ/XLSX/PDF and shop drawings | Multiple unrelated products share name; exact intended product cannot be proven from name alone | Record exact product URL before competitive claims |

## Product evidence and constraints

### Coohom

The official enterprise kitchen/closet page describes parametric design tools, framed/frameless cabinet and closet models, custom catalogs, 4K renders/360 panoramas and automated cut lists/BOMs/CNC-ready files. These are **vendor claims**, not a tested export sample. [C1]

Official help documents cabinet drawings selectable by room, furniture relationship or individual part; the feature is explicitly for enterprise users. Another help page documents DOCX/XLSX/PDF **quotation** exports from Kitchen & Bath / Custom Furniture and says whole-model export is unsupported. A quotation spreadsheet must not be represented as a verified panel cut-list spreadsheet. [C2–C3]

The SmartLink 2026 vendor article describes a shared catalog containing cabinet dimensions, hardware, edge banding and material grades; manufacturing checks for drawer clearance, appliance cutouts and sheet fit; revisions updating cutting lists, drilling patterns and CNC code. This increases overlap with ULTIDA's intended source-of-truth proposition. Exact licensing, implementation effort, supported factory schemas and finish/grain grouping need a product demo/sample pack. [C4]

### Homestyler

An official tutorial documents changing model parameters and drilling down into panels/boards to edit part parameters. Another documents sliding-door count and overlap arrangement. These establish customizable cabinet objects, but not a validated engineering formula system for every module. [H1–H2]

The official construction drawing announcement documents a drawing catalog, main material table, floor/layout/ceiling/finish/index sheets, elevations, annotation editing, scale adjustment and PDF/DWG/JPG export. It dates to 2023, so it is feature evidence rather than a definitive current entitlement guide. Old forum complaints and support responses should not be used to assert a current defect. No primary procedural documentation was found here for the specified factory labels/nesting/XLSX pipeline. [H3]

### Foyr Neo

The official Neo 2.0 tutorial documents cropping and hiding elements/layers; adding text, materials and dimensions; DXF floor plan download; branded PDF with paper size/orientation/scale; and named wall-oriented elevation views that can be annotated and saved. The PDF client pack is therefore not unique to ULTIDA. The tutorial does not establish production formulas, hardware drilling, labels or sheet optimization. Avoid using older reviews claiming Neo cannot export technical drawings. [F1]

### Planner 5D

The official report-generator help documents web PDF export for Free/Premium/PRO, combining home report, blueprint, 2D plan, 3D renders and elevations. Settings include margins, orientation and title/description cards. Generation may take up to 20 minutes; completed PDFs are managed per project. An interior-design app page expressly says the product does not replace professional measurements or construction documents. This limits how its outputs should be positioned relative to measured cabinetry production. [P1–P2]

### Cedreo

Official help documents downloading renderings and drawings and generating a PDF containing the plans. Its elevation/section page documents scales, margins, print quality and synchronization of drawings/presentation documents after project changes. Its application FAQ includes importing JPG/PNG/PDF/DWG/DXF and tracing, plus layout, materials, rendering and plan-document modules. These establish meaningful documentation competition; none of these sources proves panel-level cabinet fabrication or the requested factory grouping. [D1–D3]

### Infurnia

Infurnia's official kitchen page explicitly positions its product for modular kitchens with quotations, BOQ, cut lists and manufacturing outputs. [I1]

The MES help describes checking finished/cut dimensions, core material, finishes and edge bands, verifying units, then enabling selected units for manufacturing. Enabling incurs per-panel billing. This is strong evidence that the design-to-production boundary is already a productized competitor workflow, including a review/release step. [I2]

The output tutorial documents cut-list **CSV**, board-layout **PDF**, configurable panel-label **PDF** and machine-format CNC outputs (examples Homag/Biesse). Board-layout settings include board dimensions, margin and saw width, with finish/board counts in the download. Exact XLSX, core-plus-front/back-laminate grouping, grain matching/rotation rules, nesting optimality and revision locking need direct sample verification. [I3]

### SketchUp / LayOut and OpenCutList

SketchUp's official LayOut help describes model reference updates and text/labels/dimensions; its PDF help documents PDF output. This is a linked documentation workflow, not proof of a native cabinet factory module. [S1–S2]

The **third-party extension's own documentation** is primary evidence for OpenCutList: it creates parts lists, cutting diagrams, labels, estimates and exploded views for SketchUp woodworking models. Its export page is titled CSV or XLSX and supports per-instance rows, parts-list or summary export. The body remains CSV-focused, so XLSX should be confirmed in the actual installed version. Labels have a configurable sheet layout. [O1–O3]

Crucially, the current opened cutting-diagram documentation supersedes an older search snippet: it supports guillotine, free rectangle placement and actual-shape nesting. It documents grain-based rotation restrictions, offcut stocks, kerf/spacing, trim, material-group diagrams and warnings for unplaced parts; it does not promise a perfect optimum. [O4]

Material documentation separates sheet goods, veneer and edge banding and allows grain properties. Setup documentation warns that component axes and materials must be correct; SketchUp groups are not supported as parts. This creates an actionable usability opportunity: ULTIDA can derive trustworthy axes, panel identity and material assignments directly from cabinet construction rather than requiring manual modeling discipline. [O5–O6]

### Agent B Studio

The exact official product is **agentb.studio**. Official pricing lists layout-to-render, layout builder, product creator and moodboards, with higher-plan RCP/elevation generation, product drawings, BOM calculator and client presentations. Its designer page describes CAD/BIM/sketch upload and an AI visualization workflow. These remain vendor statements; this review did not establish editable parametric carcass construction, deterministic panel derivation, factory nesting or manufacturer-ready spreadsheet schema. An AI-generated elevation is not automatically an engineering drawing. [A1–A2]

### BuildFlow: product identity must remain explicit

The most relevant AI/AEC candidate is **https://trybuildflow.in/**. Its official page describes a 2D wall/door/window editor, IFC viewer, AI renders/walkthroughs, quantity takeoff, BOQ exports to XLSX/PDF and Pro shop drawings. A BOQ XLSX is not verified cabinetry cut-list XLSX. The page does not establish the complete cabinet manufacturing chain. [B1]

Other official same-name products include **buildflow.com** (construction document/bid/CAD/archive management), **buildflow.co.in** (architecture/construction ERP), **thebuildflowapp.com** (cabinet-maker business control) and **buildflow.ae** (construction/fit-out management). Their capabilities must not be combined into one imaginary competitor. The intended BuildFlow remains ambiguous until the requester supplies a URL. [B2–B5]

## Actionable differentiation hypotheses and validation

1. **One reproducible cabinet model, several verified outputs.** Use stable part IDs across views, panel schedules, labels and nesting, with an export manifest tying all outputs to a project revision. Coohom and Infurnia overlap with this promise; differentiation requires proof on real projects.
2. **Factory-specific clarity.** Model core, thickness, front/back laminate, edge bands, grain axis, permissible rotations, finished/cut size, kerf and trim independently. Demonstrate the required grouping in an actual XLSX and nesting PDF rather than claiming competitors lack it.
3. **Progressive professional UI.** Offer room and cabinet presets, direct dimensions, inline rule errors, visible output progress and previewable release packs. Keep setup complexity visible and manageable.
4. **Measure outcomes.** Run the same kitchen/wardrobe task in ULTIDA and the closest competitors: time to first usable cabinet, time to first client pack, manual edits before factory acceptance, material mismatch count, part-ID continuity after revision and operator acceptance of exported files.
5. **Treat client approval and factory release as separate states.** A beautiful render is a design artifact; a released panel pack must pass dimension/material/grain/quantity checks. Preserve editable design state while freezing each issued pack.

## Official sources and retrieval references

All URLs retrieved on 2026-10-17 unless a publication/update date is stated above. References are provided for traceability, not independent verification of vendor claims.

- C1 — https://www.e.coohom.com/kitchen-and-closet-tool — web ref `turn14view0`
- C2 — https://www.coohom.com/helpcenter/how-to-use-closet-kb-construction-drawings — `turn10view1` (updated 2024-12-10)
- C3 — https://www.coohom.com/helpcenter/what-can-i-export-download — `turn10view0` (updated 2025-04-15)
- C4 — https://blog.coohom.com/coohom-smartlink-suite-at-indiawood-2026-closing-the-gap-between-design-and-production/ — `turn14view1`
- H1 — https://www.homestyler.com/forum/view/1486266039367258113?lang=id_ID — `turn13search0` (Homestyler Official, 2021-01-26)
- H2 — https://www.homestyler.com/forum/view/1506947982852304898 — `turn13search2` (Homestyler Official, 2022-01-24)
- H3 — https://www.homestyler.com/forum/view/1640998543632289794?lang=zh_CN — `turn10view2` (Homestyler Official, 2023-03-19)
- F1 — https://foyr.com/courses-foyr/how-to-export-a-floor-plan-elevation-in-foyr-neo/ — `turn10view3`
- P1 — https://support.planner5d.com/en/articles/16527164-how-to-export-your-project-in-pdf — `turn5search0`
- P2 — https://planner5d.com/interior-design-app — `turn5search13`
- D1 — https://help.cedreo.com/en/how-to-download-your-files — `turn5search26`
- D2 — https://cedreo.com/floor-plan-software/cross-section-elevation-plans/ — `turn5search11`
- D3 — https://cedreo.com/faq/cedreo-application/ — `turn5search32`
- I1 — https://infurnia.com/kitchen-design-software — `turn5search14`
- I2 — https://help.infurnia.com/en/articles/9611536-what-is-the-mes-portal — `turn10view5` (2024-07-15)
- I3 — https://help.infurnia.com/en/articles/9611794-how-to-generate-manufacturing-outputs-in-mes-portal — `turn10view4` (2024-07-15)
- S1 — https://help.sketchup.com/en/layout/creating-documents-layout — `turn7search25`
- S2 — https://help.sketchup.com/en/create-pdf — `turn7search16`
- O1 — https://docs.opencutlist.org/ — `turn7search41`
- O2 — https://docs.opencutlist.org/features/parts/export-to-csv — `turn14view2`
- O3 — https://docs.opencutlist.org/features/parts/parts-list/printing-labels — `turn7search39`
- O4 — https://docs.opencutlist.org/features/parts/parts-list/cutting-diagrams — `turn14view3`
- O5 — https://docs.opencutlist.org/features/applying-materials — `turn13search10`
- O6 — https://docs.opencutlist.org/getting-started/components — `turn13search11`
- A1 — https://agentb.studio/pricing — `turn7search0` (open returned no extractable text; search extraction available)
- A2 — https://agentb.studio/designer-info — `turn7search1`
- B1 — https://trybuildflow.in/ — `turn14view4`
- B2 — https://buildflow.com/software/ — `turn7search4`
- B3 — https://buildflow.co.in/ — `turn7search3`
- B4 — https://thebuildflowapp.com/ — `turn7search18`
- B5 — https://buildflow.ae/ — `turn7search15`

Search quality note: authoritative-source searches were attempted with system1 twice and returned irrelevant generic pages; those results were excluded. Relevant official sources were located with system2 and critical capability pages were opened directly. Search snippets may lag current pages (especially OpenCutList), so opened documentation takes precedence.


---

## Appendix B: manufacturing and tool research

# ULTIDA manufacturing and open-source research

Verified 2026-10-17 against official product pages, maintainer repositories and repository license files. Recommendations and implementation implications below are analysis, not vendor promises. No benchmark or zero-waste claim is supported by this research.

## What ULTIDA should deliver

Use one revisioned, approved design and manufacturing data model to produce two distinct outputs:

1. **Client dossier:** approved plan and elevations, module dimensions, material/finish schedule with visible-face mapping, hardware and appliance schedule, renders, price/assumptions and signed revision record. Clearly separate illustrative renders from dimensioned specifications.
2. **Factory pack:** XLSX part register, material procurement summary, hardware/edgeband schedules, labels and sheet layouts. Keep stable project/revision/module/part IDs across every output. A shop should be able to trace a sheet rectangle and physical label back to its workbook row and approved module.

Factory part records need substrate SKU, substrate thickness, finished thickness where different, FRONT laminate SKU, BACK laminate SKU, grain axis and allowed rotations, finished and rough-cut length/width, quantity, four-edge treatment and allowance, machining-side convention, module and assembly position. Do not collapse unequal front/back laminates into a single material name. Sheet grouping must use compatible substrate/thickness/front/back finish/grain rules and approved stock sizes; stock and offcuts need their own identity and usable dimensions.

Optimization inputs include real saw kerf, perimeter trim, guillotine/cut-sequence constraints, grain continuity groups, minimum recoverable offcut size, offcut reuse policy and defects/exclusions. Report net part area, kerf/trim loss, reusable offcuts, unusable remainder and purchased sheet count separately. Validate non-overlap, inclusion in trimmed usable sheet, rotation legality, material grouping, quantity conservation and a feasible cut sequence. A rectangular packing diagram alone is not a machine program. Machine output requires a machine/postprocessor/tooling contract and shop acceptance.

## Commercial competitors and lessons

| Product | Officially evidenced strengths | Integration/hosting constraints and ULTIDA lesson | Sources |
|---|---|---|---|
| CABINET VISION | Modular cabinet/closet/furniture design-to-manufacture; cut lists, BOM, shop drawings, costing; xOptimiser converts cut lists to patterns; separate xMachining and xRendering modules. | Commercial modular product. No evidence here of a public embeddable cloud API or SaaS redistribution right. Obtain vendor terms for automation. ULTIDA should match revision-consistent outputs before broad machine promises. | https://hexagon.com/products/cabinet-vision ; https://hexagon.com/products/product-groups/computer-aided-manufacturing-cad-cam-software/cabinet-vision/system-requirements |
| Mozaik | Design, quoting, cut lists, hardware and shop drawings; Manufacturing edition for manual shops, CNC nesting edition, Enterprise job/user/machine controls; labeling/cutting/assembly applications. | Windows PC application; no native macOS or iOS/Android app per official FAQ. Subscription and paid trial, not an open platform. Public page does not establish a headless service license/API. Good example of separating manual-saw deliverables from CNC capabilities. | https://www.mozaiksoftware.com/ ; https://www.mozaiksoftware.com/training-support |
| PolyBoard + OptiCut | PolyBoard recalculates cabinet geometry, parts and toolings from dimensions, manufacturing methods, materials and fittings. OptiCut covers grain direction/continuity, trim, edging, stock/offcuts, labels with barcode/QR, ERP export. | OptiCut provides Windows command-line invocation. Edition limits and postprocessing differ. A credible integration candidate if a vendor-supported commercial license fits; command line availability alone does not establish cloud hosting rights. Best direct reference for the factory-pack specification. | https://www.boole.eu/polyboard.php ; https://www.boole.eu/opticoupe.php |
| imos iX | iX CAD engineering model feeds CAM; workflow-controlled production, configurable outputs, unique barcode IDs and machine-specific technology. | Crucial: iX CAM states it has no cutting optimization of its own, instead interfaces to external optimization tools. It supports CNC and third-party nesting interfaces. Avoid duplicating a proven optimizer if ULTIDA integrates one. | https://www.imos3d.com/en/products/design-order/ix-cad-1/ ; https://www.imos3d.com/en/products/manufacturing-assembly/cnc-programming-ix-cam/ |
| Microvellum | AutoCAD-based design/manufacture, cut lists with dimensions/material/edgeband/finish; cutting pattern reports; barcode labels; reusable excess material tracking; open SQL connection to ERP/MES. | Annual commercial subscription; AutoCAD and database ecosystem. SQL access is an integration route, not proof of unrestricted web embedding or direct database mutation safety. Strong reference for part identity and complete factory data. | https://www.microvellum.com/platform/ ; https://www.microvellum.com/solutions/processes ; https://www.microvellum.com/solutions/manufacturing ; https://www.microvellum.com/solutions/products |
| SketchUp + OpenCutList | Parts lists, cutting diagrams, printed labels, cost/weight reports; official signed RBZ/Extension Warehouse distribution. | GPLv3 extension in proprietary SketchUp host. Useful shop benchmark or optional adapter, not a drop-in hosted web engine. Distribution/derivative licensing and host compatibility must be evaluated. | https://github.com/lairdubois/lairdubois-opencutlist-sketchup-extension ; https://docs.opencutlist.org/ |

No reviewed commercial product page establishes that its outputs distinguish front/back laminate in exactly ULTIDA's proposed schema. Confirm that requirement in a demo using asymmetric faces and grain-matched adjacent doors.

## Repository shortlist: role, verified license and maintainability

License names were checked at the linked repository license files rather than inferred solely from GitHub badges. Pin an audited version and retain notices; dataset, pretrained weights and third-party assets can have separate terms.

| Repository | License file verified | Fit and deployment | Maturity evidence / decision |
|---|---|---|---|
| [IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell) | [COPYING.LESSER](https://github.com/IfcOpenShell/IfcOpenShell/blob/v0.9.0/COPYING.LESSER): LGPLv3; repository component table distinguishes LGPL library tools and GPL Bonsai. | IFC/BIM import and geometry conversion, Python/C++; native dependencies make a controlled backend worker sensible. Not raster plan understanding. Review exact modules and redistribution/linking packaging. | Extensive documentation, tests, C++/Python APIs and IFC schema support. **Use only when IFC becomes an actual input requirement**, not as another core geometry engine. |
| [ezdxf](https://github.com/mozman/ezdxf) | [LICENSE](https://github.com/mozman/ezdxf/blob/master/LICENSE): MIT. | DXF read/write/inspection and shop drawing interchange, Python backend. OS-independent, documented current Python requirement. DXF entity parsing does not infer cabinet semantics or scale reliably without validation. | Docs, examples, integration tests and PyPI wheels. **Preferred DXF adapter** when required. |
| [rectpack](https://github.com/secnot/rectpack) | [LICENSE](https://github.com/secnot/rectpack/blob/master/LICENSE): Apache 2.0. | Python rectangle-packing heuristics including MaxRects, Skyline, Guillotine; rotation switch and stable rectangle/bin IDs. Custom kerf/trim, grouping, grain-continuity, offcut ledger, cut sequencing and pack validation still required. | Small focused project with tests and 85 displayed commits; no throughput guarantees. **Candidate baseline** if ULTIDA owns an optimizer; avoid treating it as a finished panel-saw optimizer. |
| [OR-Tools](https://github.com/google/or-tools) | [LICENSE](https://github.com/google/or-tools/blob/stable/LICENSE): Apache 2.0. | General combinatorial optimization and constraint programming; native/server runtime with language APIs. Can express rotation/no-overlap and richer constraints, but ULTIDA must build and tune the actual cutting-stock model. | Google-maintained project with docs, tests/build infrastructure and multiple solver interfaces. **Alternative or later escalation**, not a redundant second optimizer by default. |
| [OpenCutList](https://github.com/lairdubois/lairdubois-opencutlist-sketchup-extension) | [LICENSE](https://github.com/lairdubois/lairdubois-opencutlist-sketchup-extension/blob/master/LICENSE): GPLv3. | Desktop extension; useful for validation/feature study and SketchUp shop workflow. Not an embeddable cloud library; copying implementation into proprietary app requires license analysis. | Tests, changelog, signed releases and Extension Warehouse route. **Benchmark or optional adapter**. |
| [BlenderProc](https://github.com/DLR-RM/BlenderProc) | [LICENSE](https://github.com/DLR-RM/BlenderProc/blob/main/LICENSE): GPLv3. | Procedural Blender pipeline for PBR scene/material/camera rendering and synthetic annotations; runs inside Blender's Python environment through its CLI. Worker integration possible; not a browser renderer. | Documentation, tests, examples, changelog and published software paper. **Defer unless synthetic training data or its scene sampling is needed**; plain Blender automation may cover dossier renders without another pipeline. |
| [glTF Transform](https://github.com/donmccurdy/glTF-Transform) | [LICENSE.md](https://github.com/donmccurdy/glTF-Transform/blob/main/LICENSE.md): MIT. | JS/TS glTF reading/writing, transformations and asset optimization, browser/Node core SDK. Suitable offline asset build stage; certain compression functions require external encoders/dependencies. | Typed packages, docs, tests/CI, changelog and security policy. **Preferred optional asset-processing layer**, preserving stable module/part metadata. |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) | [LICENSE.md](https://github.com/zeux/meshoptimizer/blob/master/LICENSE.md): MIT. | C/C++ mesh processing plus JS interface for some algorithms. Useful geometry compression/simplification for browser assets. Decoder support must match glTF extensions. | Extensive implementation/API documentation and multiple language integrations. **Use through existing glTF tooling when possible**, not another scene engine. Never simplify manufacturing source geometry. |
| [KTX-Software](https://github.com/KhronosGroup/KTX-Software) | [LICENSE.md](https://github.com/KhronosGroup/KTX-Software/blob/main/LICENSE.md): generally Apache 2.0 for own files, many bundled licenses; explicitly identifies a non-open-source Ericsson ETC fallback decoder. | KTX2/Basis texture build pipeline and runtime support. The documented `LIBKTX_FEATURE_ETC_UNPACK=NO` build option omits that decoder. Review REUSE SPDX inventory and bundled dependencies. | Official Khronos project, platform builds, docs, release notes and REUSE compliance. **Optional build-time tool only when texture memory/download measurements justify it**. Do not label the whole repository simply Apache/MIT. |

## Floor-plan parsing research: do not mistake research availability for production rights

| Project | License and input facts | ULTIDA decision |
|---|---|---|
| [CubiCasa5k](https://github.com/CubiCasa/CubiCasa5k) | [LICENSE](https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE) is **CC BY-NC 4.0**. Dataset and multi-task floorplan image analysis model; root page has model/training/evaluation code. | Research reference only unless separate commercial permission is obtained. Do not infer that public code/weights are commercially usable. Automated extraction still needs dimension/scale and topology review. |
| [Floor-SP](https://github.com/woodfrog/floor-sp) | [LICENSE](https://github.com/woodfrog/floor-sp/blob/master/LICENSE) is MIT. It takes **aligned RGBD scans**, produces top-view images and estimates floorplans; Python 3.5/PyTorch 0.4 environment. Authors explicitly describe a merging simplification as suitable for non-product use. | Research reference, poor fit for a general uploaded PDF/image parser. Significant maintenance and domain adaptation burden; separately audit submodules/assets/weights. |
| [HEAT](https://github.com/woodfrog/heat) | [LICENSE](https://github.com/woodfrog/heat/blob/master/LICENSE) explicitly **forbids commercial use of code, data and weights**; research use follows separate GPLv3 text. Python 3.7 and compiled deformable attention. Floorplan task uses point-density images. | Exclude from commercial deployment absent separate permission. A GPL badge alone is misleading. Do not conflate reconstruction from scans with interpretation of arbitrary floorplan images. |

Practical path: prefer structured IFC/DXF where supplied; otherwise present assisted wall/door/window extraction as a draft that users calibrate and correct. Require scale/dimension confirmation and a geometry approval checkpoint before furniture fitting or quantity generation. Research model outputs must never become unreviewed manufacturing dimensions.

## Recommended minimum build direction (analysis)

Keep ULTIDA's existing scene/rendering engine. Make a canonical parametric cabinet/part model the source for both dossier and factory pack. Add ezdxf only for explicit DXF exchange, IfcOpenShell only for explicit IFC intake, and glTF Transform only as an asset-processing step if asset metrics justify it. Select **one** cutting route: vendor-supported optimizer integration, or a rectpack-based prototype with factory rules and deterministic validation; consider OR-Tools only if measured constraints/quality justify replacing or augmenting the strategy within one optimizer service.

Acceptance pilot: include unequal face laminates, 90-degree grain prohibition, adjacent door grain matching, multiple thicknesses, mixed stock dimensions, reused offcut, nonzero trim/kerf, oversized/unplaceable part, and a revision changed after client approval. Require exact reconciliation between XLSX quantities, labels and all sheet-layout placements. Record purchased-sheet count and usable-offcut outcome against the factory's present workflow; do not claim a universal percentage saving.

## Evidence handles for parent response

- CABINET VISION: `turn6search1`; Microvellum processes/manufacturing: `turn6search5`, `turn6search0`.
- OptiCut: `turn17view3` (grain/trim/offcuts/labels/Windows CLI); PolyBoard: `turn17view4`.
- Mozaik: `turn18view3` (editions, Windows, outputs).
- imos iX CAM: `turn17view6` (external cutting optimization; barcode IDs; specific workflow integration).
- Core license files: `turn15view0` IfcOpenShell, `turn15view1` ezdxf, `turn19view3` rectpack, `turn15view3` OR-Tools, `turn15view4` OpenCutList, `turn15view5` BlenderProc, `turn15view6` glTF Transform, `turn15view7` meshoptimizer.
- KTX special case: `turn17view0`; CubiCasa noncommercial: `turn17view1`; Floor-SP scope/old runtime: `turn19view2`; HEAT commercial prohibition: `turn21view0`.

Parent should open sources itself before using citation references, as required by browsing tool instructions.


---

## Appendix C: repository audit

# ULTIDA repository audit — 2026-10-17

Scope: recovered repository at `ultida`, branch `codex/ultida-research-audit-20261017`, starting from local integration `bdcdfcd` / remote main `a281f45`. No AGENTS.md was found in this checkout or its parent search. This is a source-and-test audit, not deployed-service certification. No NaCl graph MCP or graph validation ran. Paths below are repository-relative. Confidence **high** means directly inspected source/tests or executed behavior; **medium** means a wiring inference requiring live confirmation; **unknown** means no physical/live evidence was obtained.

## Conclusion

The application already contains the requested plan → spaces → modules → materials → moodboard → render → dossier → manufacturing pipeline. It should be completed by connecting and reconciling its existing authorities, not by replacing the application or introducing another optimizer. Important pieces are more complete than roadmap prose suggests: persisted scenes, exact module parts, approved-scene export guards, revisioned materials, moodboard recovery, image-based render QA, printable labels, real XLSX serialization, substrate grouping, grain-aware nesting, and production reviews are present.

There are still significant boundaries: scene production snapshots do not carry authoritative face-A/B laminate schedules or per-panel machining records; final exports do not consume the separate production-review record; the comprehensive dossier has unknown laminate counts represented as zero; its project endpoint chooses the latest room scene rather than assembling all room scenes. Physical site/factory validation is not established by the tests.

## Exact implementation map

| Flow | Authoritative implementation and symbols | UI / API wiring | Evidence and limits |
| --- | --- | --- | --- |
| Plan intake | `apps/api/src/plan-jobs.ts`: durable job claiming, leases, OCR/tracing and coordinate reconciliation; `apps/api/src/plan-analysis-service.ts`: `analyzePlanFile`, `runWallTracer`, `reconcileToElements`, `extractOcrMeasurements`; `apps/api/src/fast-wall-tracer.ts`: bundled Sharp/TS CV | `apps/web/src/components/plan/PlanReviewWorkspace.tsx`; `apps/api/src/index.ts`: floor-plan initiate/complete, active plan, plan draft, `/plan/approve` routes | High source confidence. Proposed detections still require reviewed scale/geometry. Provider, worker queue, storage and OCR assets need deployed checks. |
| Plan contracts | `packages/plan-core/src/plan-schema.ts`, `coordinate-system.ts`, `scale-engine.ts`, `vector-extractor.ts`, `validators.ts` | Canonical schema parsed before scene compilation; approved active plan required | High. `apps/api/test/plan-job-coordinate-reconciliation.test.ts`, `plan-reconciliation.test.ts`, `plan-analysis*.test.ts`, plan-core coordinate/feet-inch tests exist. |
| Spaces | `packages/spaces-core/src/index.ts`: `deriveSpaceGeometry`, `computeSpaceReadiness`, `canApproveSpaces`, `computeUsableWallLength`, fragment wall/opening/split/merge edits | `apps/web/src/features/spaces/SpacesWorkspace.tsx`; API `/spaces`, `/spaces/:spaceId`, `/spaces/commit-geometry`, `/spaces/approve`, `/spaces/:spaceId/design-inputs` | High. Initial-design vs final-production geometry modes exist. Survey truth is not implied by `configured` or automated geometry. |
| Layout and modules | `apps/api/src/module-anchor.ts`, `module-edit.ts`, `scene-module-parts.ts`, `scene-module-revisions.ts`; `packages/module-framework/src/compilers.ts`: wardrobe/kitchen/crockery/study/pooja/bed/utility/island compilers and `COMPILER_REGISTRY` | API module placement requires an approved layout; module patch has revision invalidation; `/scenes/compile` loads persisted module IDs for one room and validates room/layout/wall anchor/dimensions | High. Framework tests cover shared carcasses, wardrobe composition, islands, lighting and TV units. Catalog families are intentionally not all cutlist-certified. |
| Scene | `packages/scene-core/src/index.ts`: schema/migration; `packages/scene-compiler/src/index.ts`: `compileSceneV1`, `compileScene`, `resolveRoomWalls`, `reconcileSceneBays`, `checkRenderReadiness` | API `/scenes/preflight`, `/scenes/compile`, `/:sceneVersionId/approve`; `apps/api/src/scene-approval-write.ts` | High. Scene compile is explicitly room-scoped. `assertSceneBayReconciliation` runs before manufacturing exports. |
| Materials | `apps/api/src/scene-material-assignments.ts`: `sceneMaterialAssignments`, `sceneDefaultMaterialSlots`; `scene-part-material.ts`; `supplier-material.ts` | Organization material library; revisioned `/material-assignments`; `RoomMaterialBoard.tsx` saves assignments. Compile reads persisted assignments/library instead of accepting browser material facts | High. Starter materials explicitly remain placeholders pending supplier verification. A material slot is not yet an authoritative two-face substrate/laminate manufacturing schedule. |
| Moodboard | `apps/api/src/moodboard-store.ts`: `moodboardFingerprint`, `loadMoodboardContext`, `saveMoodboard`, signed assets, swatch attachment; `packages/contracts/src/moodboard.ts` | `apps/api/src/moodboard-routes.ts`: `/rooms/:roomId/moodboard`; `apps/web/src/components/design/MoodboardMaker.tsx`, `moodboard-layout.ts`, `moodboard-draft.ts`, `moodboard-export.ts` | High. Optimistic revision checks, source fingerprint conflicts, stale-source handling and local recovery exist. Exports PNG/print/specification JSON. Moodboards remain presentation intent, not a geometry/material approval shortcut. |
| Render | `apps/api/src/visual-jobs.ts`: `renderInputFingerprint`, `compileRenderGeometryContract`, `measureRenderImage`, `evaluateRenderImageQA`, `assertSceneRevisionActive`, `reviewVisualJob`; `packages/render-pipeline` and provider gateway | API render-readiness, create/poll/list/review routes; `VisualizeStudio.tsx`, `RenderLauncher.tsx`, scene saved-camera helpers | High source confidence, live provider unknown. Masks/depth/edges/object/finish regions and stale-scene checks exist. QA measures image evidence; it does not prove every cabinet dimension in a photoreal image. |
| Dossier | `apps/api/src/index.ts`: `buildDossierSpecFromContext`; `apps/api/src/scene-document-sections.ts`: `sceneDocumentSections`; `packages/drawing-core/src/production-dossier-pdf.ts`: `generateProductionDossierPdf` | Authenticated `/projects/:projectId/dossier.pdf` and `/scenes/:sceneVersionId/production/package.pdf`; production UI release pack | High. Floor plan, module elevations, material schedule, brief, nesting, flooring, BOM and cutlist come from saved scene. Project/designer/factory contact fields may be placeholders. Renders/moodboard pages are not assembled here. |
| Production snapshot | `packages/drawing-core/src/index.ts`: `buildProductionSnapshot`, `FABRICATION_CERTIFIED_FAMILIES`, `UNCERTIFIED_MODULE_FAMILIES`, `productionDimensions`, `edgePolicy` | API `buildCutlist`, `readApprovedProductionContext`, `/production-snapshot`, `/production-review`; `ProductionWorkspace.tsx` | High. Requires approved/locked scene and moduleParts. Catalog-gated, physical IDs, exclusions/warnings and separate hardware list exist. Per-part edge/grain defaults need fabrication review. |
| XLSX | `packages/drawing-core/src/production-workbook.ts`: `generateProductionWorkbookXlsx`, `generateDrawingCutlistWorkbookXlsx`, real zipped OpenXML writer | Approved scene GET `/production/cutlist.xlsx`; size-entry POST `/production/cabinet-cutlist.xlsx` | High. Production sheets include release summary, panels, labels, materials, board requirements, laminate limitations, edging, hardware, nesting/layout and audit. Size-entry workbook is explicitly draft. |
| Labels / nesting | `packages/drawing-core/src/index.ts`: `generateProductionLabelsSvg`, `generateProductionNestingSvg`, `nestPanels2D`, `optimizeMultiSheetNesting` | Approved-scene `/production/labels.svg`, `/production/nesting.svg`; production UI downloads | High. Stable component IDs survive into drawings/nests/labels. SVG labels print human-readable scan IDs; no actual QR/barcode symbology is emitted. |

## Authorities and overlapping implementations

1. **Authoritative scene manufacturing:** drawing-core `buildProductionSnapshot` → `nestPanels2D` → approved-scene workbook/labels/dossier API. Grouping is substrate `materialCode` plus thickness. This is the path to enhance.
2. **Standalone imported/measured draft:** `apps/web/src/features/tools/cutlist-optimizer.ts` → `optimizeGuillotineNesting`; `CutlistStudio.tsx`, `measured-unit-cutlist.ts`, `cutlist-draft-workbook.ts`. Groups core + thickness + decorative finish + internal liner and estimates laminate face area by finish. Its export says DRAFT / NOT FOR CONSTRUCTION. It must not quietly become the approved scene authority.
3. **Size-entry cabinet draft:** drawing-core `drawing-cutlist-analyzer.ts` → `generateDrawingCutlistWorkbookXlsx`. Carries face finishes, wardrobe vertical schedules, substrate takeoff, draft nesting and physical label IDs. This is useful input/review capability, not equivalent to a persisted approved scene.
4. **Browser previews / compatibility:** drawing-core has multiple drawing entrypoints; API compatibility comments identify TS as the DXF geometry authority. Keep strict production paths separate from plan-review Initial Design DXF and empty-scene drawing compatibility.
5. **Python:** `python/plan-intelligence/README.md` and `python/cad-workers/README.md` are scope placeholders, not implemented worker services. `apps/api/cv/README.md` explicitly marks `wall_tracer.py` legacy: active floorplan runtime uses bundled TypeScript/Sharp. `workers/elevation/elevation_worker.py` is a real Python SVG/DXF/PDF exporter with tests, but no invocation was found in active API/worker/TS drawing source. `scripts/validate_dxf.py` is a validator, not app export authority; `scripts/curate_reference_vault.py` curates image reference assets using hashes/classification/scores, not runtime geometry.

## Confirmed gaps and bounded improvements

| Priority | Observation | Smallest safe improvement and validation | Confidence |
| --- | --- | --- | --- |
| P0 — fixed in this audit | `nestPanels2D` sorted largest-first then iterated backward, causing smallest-first placement. A 1000×600 panel and 400×400 panel unnecessarily consumed two 1000×1000 sheets with zero trim/kerf | Traverse the existing descending queue forward; preserve guillotine geometry and grain constraints. Regression proves one sheet with both IDs | High, observed red then green |
| P0 — fixed in this audit | It cloned quantity-expanded group entries then mutated only those clones; returned `updatedParts` had no placements. Production workbook consumed those untouched rows, producing UNNESTED and failed reconciliation despite actual nesting | Return the same physical-panel objects placed by the engine, expanded to quantity=1 rows. Regression checks both IDs, sheet/XY/rotation consistency and no source mutation | High, observed red then green |
| P1 | Export helpers rebuild raw review_required snapshot and do not apply persisted `production_snapshot_reviews`; UI review and downloadable workbook status diverge | Define whether downloads are review drafts or releases. Apply exact matching review to export snapshot; require review for any production-release download, with draft download explicitly labeled. Test unauthenticated/unapproved/partial/full/mismatched review cases | High source observation; release policy must be chosen |
| P1 | Authoritative `CutlistPart` / production snapshot uses `part.materialId` as `materialCode`, but lacks face A/B finishes and stock configuration. Production workbook correctly says NOT IN SNAPSHOT | Add optional versioned face schedules with provenance to scene parts, compile from persisted assignments, then share a pure takeoff helper. Nest substrates by substrate/thickness; calculate and separately nest laminate only from authoritative face rectangles/supplier stock. Tests for different cores/same finish, two-sided faces, grain, quantity and unavailable stock | High; not implemented here |
| P1 | `buildDossierSpecFromContext.bom.boardNesting.sheetsLaminate = 0`; `generateProjectBOQ` also hard-codes laminate count 0 | Represent unknown as unknown/action-required; align PDF/BOQ with XLSX's honest unavailable status. Do not replace with area-only sheet estimate labeled exact. Test PDF/spec for unknown vs confirmed zero | High |
| P1 | Project dossier selects latest `scene_versions` row; compile creates one room at a time | Add a project dossier manifest referencing exact approved scene revision for every in-scope room. Detect absent/stale room revisions. Aggregate module/part IDs without duplicate panels. Test two-room coverage and newer draft behavior | High source, intended project aggregation medium |
| P2 | Labels carry plain text barcode payload only | Add actual encoded QR/Code128 from immutable project/scene/part identity, printable scale/margins and stable lookup route if needed. Test decoding exported labels, long IDs and XML escaping | High |
| P2 | API production nest remains fixed standard stock; multi-size optimizer is advisory. UI draft optimizer has a different finish grouping model | Persist reviewed supplier stock/kerf/trim/grain rules with snapshot provenance before changing released nests. Test same source snapshot produces consistent XLSX, SVG, counts and labels | High |
| P2 | Hardware machining records are absent from authoritative snapshot; generated workbook accurately says NOT IN SNAPSHOT. A separate `generateCncPanelDxf` demonstration exists | Add actual operation records only after compiler-to-part coordinate contracts are reviewed. Never infer CNC readiness from generic hinge/System32 export tests | High |
| P2 | `sceneDocumentSections` has empty coreSubstrates/edgebanding/hardwareStandards; module hardwareSchedule empty and missing project fields become placeholders | Populate from exact snapshot/organization reviewed facts with missing-data flags. Test no invented product or personnel values | High |

## Test evidence and implementation delta

- Before modification, focused snapshot/workbook suite: **13 passed**, proving existing tests did not catch the two defects.
- Added tests only to `packages/drawing-core/test/production-snapshot.test.ts`:
  - `nesting avoids an extra sheet when a large panel and small offcut fit together` failed as intended, `2 !== 1`.
  - `nesting returns a placement for every physical panel without mutating the source schedule` failed as intended, returned `['shelf']` instead of `['shelf#1','shelf#2']`.
- Minimal source fix only in `packages/drawing-core/src/index.ts`: expand physical instances before grouping, retain group references, iterate descending list forward while adjusting removal index.
- After fix, `npm run test --workspace=@ultida/drawing-core`: **52 tests passed, zero failures**, including production workbook, size-entry workbook, labels, certification, grain, multiple sheet sizes, oversized panel rejection, dossier, shop drawing and DXF validation tests.
- Drawing-core TypeScript build passed during initial root test bootstrap. Root `npm test` was initiated, then interrupted at the coordinator's request so the coordinator can run full verification after all changes. This report does not claim a full root green run.
- API consumer verification: `node --import tsx --test apps/api/test/cutlist-authority.test.ts apps/api/test/production-dossier-endpoint.test.ts`: **8 tests passed, zero failures**. This covers exact part requirements, traceable identical components, certified-module exclusions, oversized back panels, context-derived PDF spec/stream and export authentication. A direct single-panel probe confirmed returned placement metadata and re-nesting that returned schedule still emits exactly one panel.
- Public TypeScript return type remains `CutlistPart[]`, but `updatedParts` now correctly represents one physical panel per quantity=1 row. For quantity>1 inputs this changes returned cardinality from aggregate input rows to the already-used physical label IDs. Authoritative scene snapshot inputs are already quantity=1. Existing workbook consumers need those physical rows; their tests passed. No second optimizer, laminate schema change, API route change or production policy change was made.

## Outstanding validation

Local unit tests establish deterministic software behavior only. They do not establish actual current provider access, deployed migrations/RLS/storage/queue health, supplier SKU availability, actual board/laminate thickness, face matching and grain agreement, calibrated field dimensions, machine kerf, joinery/hardware fit, or factory assembly quality. Run one measured room with actual supplier sheets through the existing pipeline, reconcile every physical part ID across XLSX/nest/label/elevation, and inspect a real fabrication sample before widening family certification.


---

## Appendix D: design specification

# ULTIDA document and production design specification

Status: proposed architecture and acceptance contract. Existing bounded defect repairs are separate; the subsystems below are not represented as implemented. Evidence: `docs/research/2026-10-17/ULTIDA_Strategy_and_Gap_Audit.md` and its competitor/tool/repository appendices.

## Purpose and users

A residential/modular design studio must capture measured space, select and customize real furniture, obtain client decisions and issue consistent design and workshop documents. Designers edit; clients review selected versions; production reviewers approve exact physical parts and machine profiles; installers consume release documents. Organization and project isolation apply throughout.

Success is one real kitchen and one wardrobe passing all source, refresh, export and workshop checks without manual geometric re-entry. A large render library, a unit-test fixture or an AI approval flag cannot replace this proof.

## Constraints

- Keep React/TypeScript, Supabase, `scene.v1`, existing compilers and drawing package.
- One authoritative production snapshot and one persisted nesting result feed all factory exports.
- Internal geometry units remain millimetres; display-unit conversion never changes stored geometry.
- Unknown quantity, price, stock, machining or approval is not represented as zero or approved.
- Purchased furniture is excluded from fabricated-panel quantities.
- A material image or generated mesh never supplies manufacturing dimensions.
- No new paid infrastructure, supplier asset rehosting or machine-code release without explicit scope and valid rights/profile evidence.
- No guaranteed zero waste, automatic universal CNC compatibility or supplier certification claims.

## Alternatives and selected architecture

Finishing the existing authority chain is preferred over a new full-stack CAD engine. A commercial optimizer can be an optional workshop-specific adapter after license/runtime evaluation. Generative 3D remains a decorative/concept channel, excluded from fitted-cabinet construction authority.

Extend the existing part/snapshot contracts with planned structured records:

`PanelSurfaceSpecV1`: `partInstanceId`, substrate material-version ID, nominal core thickness, construction method, face A/B material-version IDs and orientation, edge records L1/L2/W1/W2, finished/net/raw dimensions, allowance rule version, grain/match group and recipe version. Do not remove the existing material display field until consumers migrate.

`StockProfileV1`: supplier material/stock SKU and version, workflow `prelaminated | core_then_laminate`, actual stock sizes and available quantities, kerf, perimeter trim, grain axis/rotations, defect zones, machine strategy and offcut policy. Raw panel size includes approved allowance exactly once.

`ProductionReleaseManifestV1`: release ID/revision, project/organization, exact scene ID and source hash, recipe/material/fitting/profile versions, sorted physical part IDs, review ID/hash, persisted nesting ID/hash, artifact hashes, issue time and reviewer identities. A released manifest is immutable; a change creates another version and a visible supersession link.

`ProjectDossierManifestV1`: selected brief/plan revision, all in-scope room IDs, exact scene revision per room, render/camera/material references and requested sheet sections. Missing or stale selected rooms block a complete issue. A newer draft does not replace a selected approved scene.

These are additive design interfaces, not promises that matching tables already exist. Final field types and migration need a contract review against current schemas before implementation.

## Output authority and statuses

Use `draft`, `review_required`, `approved`, `released`, `superseded` as typed workflow decisions, not stylistic labels. Preserve existing scene and production review records during migration. Scene approval enables a reviewed design snapshot; factory release additionally requires exact production-part review, complete material/fitting/profile facts and feasible nesting/process validation.

A shared API loader must resolve the exact requested scene, check ownership and review coverage and supply the same reviewed snapshot to CSV, XLSX, nesting diagrams, labels and production PDF. Draft exports may remain available with `NOT FOR CONSTRUCTION`; a request for released output must fail closed when any proof is missing. Generic CNC demo functions must not be reachable as a factory-ready export without operations and machine-profile approval.

## Laminate and stock rules

Prelaminated stock grouping includes ordered face-A/face-B identities and orientation; reverse faces are not interchangeable unless the construction/machining profile explicitly permits them. With post-cut lamination, core nesting and finish-sheet nesting are distinct computations linked to the same physical panel. Material sheet dimensions and finish allowance are explicit. Multi-face grain permissions are the intersection of permitted orientations; matching adjacent fronts also requires a continuity/sequence constraint.

The nest validator proves containment within trimmed stock, no overlaps/kerf violations, legal rotation/grain, material compatibility, exact quantity and identity conservation, no double-counted losses and supported cutting strategy. A panel-saw release requires a valid guillotine cut tree; free rectangle packing alone cannot satisfy it. Compare alternatives on purchased sheet count, cost, recoverable offcuts and cut effort; record solver strategy/seed/time budget and gap when available.

## Dossier and label requirements

Client dossier sections: actual project/revision register, brief and scope, measured plan and furniture layout, room renders/boards, all requested elevations/sections/details, substrate/face/edge/hardware/appliance schedules, commissioned services only, BOQ/quote with exclusions and approval/handover record. Missing fields are visible completeness issues.

Workshop workbook tabs and cross-format identity requirements are specified in the research report. Labels contain an encoded QR or Code128 with opaque release/part identity, readable identity, dimensions, faces, edge map, grain, room/module and sheet position. Print dimensions must be driven by a reviewed label/printer profile and checked at 100% scale. A scan must preserve tenant authorization and not reveal a signed asset URL.

## Knowledge and AI

Every production-capable recipe and fitting rule carries a source record, source page/diagram, region, effective version, units, rights and reviewer. Catalog retrieval filters hard constraints before semantic ranking. AI proposals produce real template IDs and transparent assumptions; they cannot write approvals or change immutable released parts. Factory feedback creates reviewed recipe-change proposals and reruns a regression corpus. Keep NaCl development graph setup distinct from customer product data.

## Failure behavior

Expired sign-in: no success banner or approval. Revision race: conflict with preserved local draft. Missing source material/stock: issue list and blocked release. Oversized/unsupported panel: named exception with source module. Provider render failure: retryable/terminal status and retained technical input; no fake photoreal image. Missing PDF/image asset: explicit incomplete dossier. Partial artifact generation/upload: manifest remains unissued; idempotent retry never creates conflicting releases.

## Acceptance corpus and measurements

Start with rectangular measured kitchen, L kitchen with a door/window/service conflict, hinged wardrobe with loft/drawers, sliding wardrobe with overlap/access limits, mixed-thickness TV/study, utility with appliance access and pooja/crockery with glass/lighting. Include poor scan, multi-page/vector PDF, feet/inch annotation, mirrored walls, sloped/beam constraints, changed scene after review, two concurrent editors and a second organization.

Required evidence: geometric error against survey; blocked invalid placements; exact part/quantity reconciliation; same revision after refresh/sign-out/in; render camera/opening/front fidelity; actual DXF import; PDF scale/section completeness; XLSX reopen; QR decode and physical print size; sheet containment/non-overlap/grain/cut-sequence checks; procurement totals and remaining offcuts; shop assembly and installation deviation record. Thresholds for survey tolerance and workshop acceptance must be set with the actual measurement method, material and machine—not guessed globally.

## Rollout

First fix release authority, then panel-face/stock contracts, then project dossier completeness and persisted nesting/labels. Pilot the single kitchen and wardrobe before expanding family certification or machine formats. Pair the earlier transactional migrations with the RPC-aware API so older deployed callers are not broken. Test migrations and cross-organization policies in an isolated authorized environment. Release behind feature flags with exact commit, migration history, rollback and supersession records.


---

## Appendix E: implementation plan

# Production Release Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every factory export use the same exact reviewed production snapshot and block released downloads without manufacturing approval.

**Architecture:** Reuse `scene.v1`, `buildProductionSnapshot`, the existing `production_snapshot_reviews` record and the existing export serializers. Add one shared API authority loader and a pure review validator; do not create a second cutlist or nesting engine. This is the first independently shippable sub-project, not the implementation of the whole strategy.

**Tech Stack:** Node 24, TypeScript, Express, Supabase, existing drawing-core PDF/XLSX/SVG writers and Node/tsx tests.

**Spec:** `docs/superpowers/specs/2026-10-17-ultida-document-production-design.md`

## Global constraints

- Keep React/TypeScript, Supabase, `scene.v1`, existing compilers and drawing package.
- One authoritative production snapshot and one persisted nesting result feed all factory exports. This first project unifies snapshot review; persistence of nesting is a later bounded project.
- Internal geometry units remain millimetres; display-unit conversion never changes stored geometry.
- Unknown quantity, price, stock, machining or approval is not represented as zero or approved.
- Purchased furniture is excluded from fabricated-panel quantities.
- No new paid infrastructure, supplier asset rehosting or machine-code release without explicit scope and valid rights/profile evidence.

## Review focus

1. A newer draft must not silently replace a specifically requested approved scene.
2. A review containing extra or missing part IDs must not authorize release.
3. A record from a different organization/project must not supply review evidence.
4. Storage/export failure after compilation must not mark a document issued.
5. Existing draft/size-entry downloads must remain useful and visibly non-construction.

## Task 1: Define a pure production review authority validator

**Files:** Create `apps/api/src/production-release-authority.ts`; test `apps/api/test/production-release-authority.test.ts`.

**Interfaces:** Consume `ProductionSnapshotV1` and current review `{status, approved_part_ids, fabrication_rules_version}` plus exact scene ID. Produce `applyProductionReleaseAuthority(snapshot, review, intent: 'draft'|'released')` returning the reviewed snapshot or typed error with code/status. Use the existing `applyProductionReview` behavior as the compatibility reference; relocate only after tests pin it.

- [ ] Write failing tests with a two-part snapshot: exact matching approved review succeeds; missing/extra/duplicate IDs, wrong rules version, absent review or rejected review cannot yield released output; draft intent returns review-required with no false approval.
- [ ] Run `node --import tsx --test apps/api/test/production-release-authority.test.ts`; require the intended failure before implementation.
- [ ] Implement exact set equality and rules-version checks. Do not infer review from scene approval or the current browser selection.
- [ ] Run the test and `npm run check --workspace=@ultida/api`; inspect all typed status consumers.
- [ ] Commit the pure validator and regressions.

## Task 2: Load exact scene and production review through one request-scoped boundary

**Files:** Modify `apps/api/src/production-release-authority.ts`, `apps/api/src/index.ts`; extend `apps/api/test/cutlist-authority.test.ts` and add `apps/api/test/production-release-loader.test.ts`.

**Interfaces:** `loadProductionExportContext(client, {projectId, sceneVersionId, intent})` returns `{scene, snapshot, review}`. `client` is the existing request-scoped Supabase client. Parse/migrate the exact stored scene, call existing bay reconciliation and production compiler, query review with both project and scene keys, then call Task 1. No latest-scene fallback.

- [ ] Write failing tests for exact requested scene vs newer draft, denied cross-project read, missing scene, database error, rules drift and a missing review migration. Assert no success response for denied/unavailable evidence.
- [ ] Run the two focused test files and observe the intended missing-loader failure.
- [ ] Implement the loader with existing compiler/catalog inputs. Preserve distinct 404, 409/422 and 503 conditions; do not hide database errors as empty reviews.
- [ ] Reuse the loader in snapshot/review reads before changing download serializers.
- [ ] Run API type check and authority tests; commit.

## Task 3: Route all factory download formats through the same authority

**Files:** Modify factory CSV/XLSX, nesting SVG, label SVG, PDF and production ZIP handlers in `apps/api/src/index.ts`; test `apps/api/test/production-export-authority.test.ts`; inspect existing serializers in `packages/drawing-core/src/index.ts`, `production-workbook.ts`, `production-dossier-pdf.ts`.

**Interfaces:** Every handler consumes Task 2's returned `snapshot`. Add a documented explicit draft/released intent at the API boundary, preserving existing draft downloads with their warnings; the UI must not label a default draft as factory released.

- [ ] Write failing HTTP tests for each format: draft permitted with review-required status; released request denied without complete review; complete exact review authorized; every accepted format carries the identical scene ID, part set and review status.
- [ ] Ensure a test changes the scene/part source between review and download and checks release refusal. Use an immutable source hash or compare exact saved snapshot facts; do not compare a count alone.
- [ ] Replace repeated raw snapshot generation with the shared returned snapshot. Do not change dimensional calculations in serializers.
- [ ] Verify that no generic CNC preview can acquire released status without real operations and a machine profile; keep unsupported formats blocked.
- [ ] Run `npm run test:drawing`, focused API tests and `npm run check`; commit.

## Task 4: Surface the authority decision in the existing production workspace

**Files:** Modify `apps/web/src/features/production/ProductionWorkspace.tsx` after confirming its current export actions; existing actual UI may delegate through `apps/web/src/components/design/DesignFlowWorkspace.tsx`. Create a pure helper `apps/web/src/features/production/production-export-state.ts`; test `apps/web/test/production-export-state.test.ts`.

**Interfaces:** Consume `{sceneId, snapshotStatus, review, unresolvedChecks}` from the exact API context. Produce draft/released action availability and clear status copy; no independent panel calculator.

- [ ] Write helper tests: approved scene + missing factory review offers draft only; complete current review enables release; changed room/scene disables old release; failed/expired-session save keeps the unsaved state visible.
- [ ] Run tests red, implement the helper and wire current buttons; remove contradictory “production approved” labels based only on scene status in the touched flow.
- [ ] Verify keyboard/touch, room switching, refresh and actual downloads with an authenticated browser against isolated data.
- [ ] Run web build and full project tests. If browser/runtime or credentials are unavailable, record the blocked gate by name rather than skip to a release verdict.
- [ ] Commit UI integration.

## Task 5: Complete a reviewable pilot and publish the tested integration

**Files:** Add `docs/production/release-consistency-pilot.md`; use existing migration/deployment scripts, do not create parallel deployment tooling.

- [ ] Record exact Git base/candidate and paired migrations from the previous approval integration. Reconcile any newer main changes; preserve existing working implementations.
- [ ] Verify tenant isolation with two authorized test identities, immutable revision selection, failed writes, concurrent review and export failure.
- [ ] Export one measured approved kitchen through every supported format, reopen PDF/XLSX/DXF and compare exact physical part IDs/quantities; inspect factory status and exclusions. Keep a signed operator evidence record.
- [ ] Run `npm test`, `npm run check`, `npm run build`, secret scan and appropriate Python tests. Name pre-existing failures and unavailable checks explicitly.
- [ ] Push the tested branch/PR and pair API/migration rollout only when GitHub write access and isolated hosted tests succeed. Do not deploy the old remote main and describe it as this integration.

## Subsequent bounded plans, in dependency order

These are planned work, not accomplished features. Each needs its own schema/API review and focused test-first implementation plan.

| ID | Deliverable and exact proposed code boundary | Depends on | Required adversarial acceptance |
|---|---|---|---|
| F01 | `packages/contracts/src/panel-surface.ts`; extend compiler part output and `buildProductionSnapshot` with ordered core/face/edge data | Authority tasks | Same finish on different cores; unequal A/B faces; edge allowances applied once; unknowns block procurement |
| F02 | Pure surface takeoff in `packages/drawing-core/src/material-takeoff.ts`; adapt workbook/dossier BOQ | F01 | Missing laminate is unknown, not zero; actual zero remains distinct; per-face quantity and supplier sheet provenance |
| F03 | `packages/contracts/src/stock-profile.ts`, reviewed profile persistence and a strategy wrapper around existing `nestPanels2D` | F01 | Multiple sizes, nonzero kerf/trim, no-go defects, unavailable stock, oversized part, grain prohibition and ordered face compatibility |
| F04 | Persist one `NestingResultV1` and independent validator; connect XLSX, diagrams and labels to it | F03 | Quantity/area conservation, no overlaps, exact placement set, unsupported panel-saw cut sequence blocked |
| F05 | QR/Code128 label renderer replacing plain “scan ID”; authenticated release/part lookup | F04 | Decode exported image, long IDs, print scaling, escaped names and cross-org denial |
| F06 | `ProjectDossierManifestV1` contract and exact per-room scene selection; adapt `buildDossierSpecFromContext` | Authority tasks, F01 | Two rooms; absent room; newer draft; revised selected room; missing render/image; no duplicate part aggregation |
| F07 | Versioned recipe registry and supplier-fit evidence in existing `module-framework`/catalog | F01 | Minimum/maximum inside dimensions; wrong runner/hinge variant; corner/swing/appliance obstruction; unsupported recipe cannot be released |
| F08 | Space-aware layout scoring in existing `layout-core`/AURA | F07 | Three distinct feasible layouts, rotated polygons/no-go zones, explicit infeasibility, no invented template IDs |
| F09 | Final-render worker/asset pipeline pilot from exact saved scene/camera | F06 | Camera/opening/shutter fidelity, collateral-edit test, PBR asset rights, bounded cost/latency and failed-provider recovery |
| F10 | Workshop-specific machining/postprocessor adapter | F04, F07 | Supplier drilling template/version, toolpath side/units/origin, dry-run and machine/factory signoff |

No calendar date promises are made before the pilot, team capacity and actual factory inputs are known. Each row closes with evidence, not a feature-count milestone.


---

## Appendix F: execution evidence

# Research and implementation evidence

## Scope and provenance

Recovered remote main `a281f4542fbf73b65f22ac34482a608b8b33a2a9` and the saved integration `bdcdfcd8a5eae056ee41584018fbe27dc07dfc64`. Preserved the existing implementation; no framework rewrite or additional optimizer was installed. Competitor research covers nine design/workflow products and six manufacturing/ecosystem comparisons, with primary-source URLs and explicit unknowns. Duplicate overlap between the comparison sets is intentional (OpenCutList).

## Changes made

- `packages/drawing-core/src/index.ts`: corrected descending-area traversal so the largest physical panels are packed first; kept returned physical panel rows linked to their sheet/placement metadata. Quantity>1 now returns expanded quantity=1 rows with stable physical instance IDs, matching the placements/labels; quantity=1 IDs remain unchanged. Source input remains unchanged.
- `packages/drawing-core/test/production-snapshot.test.ts`: two regressions failed first (two sheets rather than one; returned aggregate row rather than two physical IDs) and passed after the fix. This is a concrete fixture improvement, not a universal waste-saving percentage or optimality proof.
- `workers/elevation/elevation_worker.py`: stopped inventing a centre shutter/hardware division from each module envelope, preserved `position.zMm`, rejected invalid heights/openings/modules beyond the wall, and made SVG text escaped UTF-8. Corrected the stale product name to ULTIDA.
- `workers/elevation/tests/test_elevation_worker.py`: four new tests failed first, then all five tests passed. Added worker README describing the envelope/scale/rotation limitations; the worker is not another manufacturing authority.

## Executed checks

- `npm test`: 583 passing test results were reported before four browser tests failed to launch due to the missing Playwright Chromium executable. This command is RED, not a green release gate.
- The four unavailable browser cases in `apps/web/test/room-catalog.test.mjs` are: switching rooms clears filters; failed request retains bundled templates; broad response narrows to selected room; late responses cannot replace selected catalog. Their assertions did not execute successfully because launch failed.
- Drawing-core suite: 52 tests passed. API consumer subset: eight tests passed, including cutlist authority and production dossier generation.
- `npm run check`: passed for all configured workspaces.
- `npm run build:packages`: passed.
- `npm run build:apps`: passed for all configured applications.
- Python elevation tests: five passed. Combined CV/elevation run: eight passed after installing missing test-environment dependencies (pytest, Shapely and OpenCV); the initial broader run could not collect CV tests before OpenCV was available. Product requirements were not replaced by these scratch environment installs.
- Whitespace validation: passed. `npm run scan:secrets`: passed; no tracked provider or Supabase secret keys detected.

## Unperformed checks and limits

No authenticated hosted application journey, paid competitor demo, measured competitive benchmark, real workshop assembly, label-print calibration or machine dry-run was completed. Earlier GitHub 403, paired unpublished migration and hosted-isolation issues are not declared resolved. No live migrations, customer data mutations, paid infrastructure or deployment were performed for this audit.

The proposed architecture, contract extensions and implementation backlog are not implemented features. All source/fitting/stock/physical tolerances need approval against actual products and the partner workshop. “All documents needed by a design firm” is scoped into the client dossier and workshop pack, with commissioned specialist documents explicitly identified rather than fabricated.

## Skill evidence

Superpowers: using-superpowers, brainstorming, dispatching-parallel-agents, systematic-debugging, test-driven-development, writing-plans and verification-before-completion were read and used for scoped research, failing-first repairs and planning. This task's broad user authorization was retained for the existing bounded repairs; the architectural backlog remains proposed.

NaCl goal/init and their runtime contracts were inspected. No project `nacl_neo4j` tools were exposed, so graph orchestration is `BLOCKED/PROJECT_MCP_NOT_CONFIGURED`. No Neo4j project bootstrap, graph write, NaCl `/goal` run or graph verification is claimed. The requirements/spec/plan/evidence documents are normal repository artifacts, not a substitute claim of verified graph state.


Local candidate commit: `db0d0816cfe2df7b37386d9bf96179eec9c3bb7f`. Fresh Git push failed because GitHub credentials are absent in this environment; remote main remains `a281f4542fbf73b65f22ac34482a608b8b33a2a9`. Source and recovery verification passed; this is not a hosted release.

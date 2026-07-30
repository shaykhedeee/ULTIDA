# GitHub Interior Design Repository Audit

Date: 2026-07-29
Scope: public repositories supplied for Ultida research

## Decision

Ultida will borrow patterns, not copy application code blindly. The existing
architecture remains authoritative:

`approved plan.v1 -> persisted Spaces/Layout/Modules -> scene.v1 -> render,
drawing, production, and commercial artifacts`

AI may interpret, propose, and explain. Deterministic Ultida code remains the
authority for dimensions, anchors, collisions, cabinet parts, scene geometry,
elevations, cutlists, and BOMs.

## Highest-value findings

| Repository | Evidence | Ultida adoption | Copy status |
|---|---|---|---|
| AlpacaLabsLLC/skills-for-architects | Local studio/project memory, governed skills, decisions, provenance, product libraries, review gates | Add a project decision register and evidence-linked design context; keep it in Supabase/versioned project data rather than a second filesystem authority | MIT; patterns only |
| qzh3722/awesome-nano-banana-spatial-design | Stage-based prompts, grid scan, clockwise wall tracing, room checklist, JSON prompt contracts, one-space-at-a-time revision | Add these as versioned prompt templates for plan analysis and render revisions; never use prompts as geometry | License must be checked per asset; educational/reference images are not production assets |
| allgpt-co/openlintel | End-to-end home design framing with cutlists, wire runs, and pipe fittings | Use as a product-scope checklist for production dependencies and service constraints | No source reuse until repository license is confirmed |
| Ashad001/RoomAligner | Object detection, natural-language explanation, layout suggestions, multipart upload API | Treat object detection and suggestions as a non-authoritative proposal adapter; persist evidence and require review | No source reuse until license/dependencies are reviewed |
| sakshi01coder/Vision_nest | Three.js browser visualization and live layout customization | Use as UI acceptance criteria for scene selection, real-time material changes, and object selection | MIT; do not copy static demo scaffolding |
| krishaa1803/3D-Interior-Designing | Simple Three.js customization with furniture and wall options | Use for low-friction catalog interactions and onboarding, implemented against Ultida scene.v1 | MIT; reference only |
| ibadami/3D-semantic-segmentation-of-modular-furniture | Functional segmentation of doors, drawers, and shelves | Use as a future data/model reference for cabinet-face evidence and QA; not an authority for dimensions | Research/model license and dataset terms require review |
| MurtazaKafka/artki | CLIP taste learning plus Claude-generated Three.js scenes | Use only the idea of separating taste retrieval from deterministic scene compilation; never let generated scene JSON bypass validation | License and provider terms require review |
| alaradirik/sd-interior-design | Layout-preserving image-to-image interior restyling | Use the geometry-lock prompt/evaluation concept for draft enhancement; final render still requires base scene artifacts | Check model/code license before reuse |
| anton-karlovskiy/ai-interior-restyler | Small focused room-photo restyler with style selection and image model | Use the narrow revision UX: upload, choose style, generate, compare; connect it to scene-linked RenderRequestV1 | License/provider terms require review |
| TeamFWS/room-designer | Quest MR/VR furniture placement and layout experimentation | Future spatial input/AR roadmap; not a replacement for the browser Scene Studio | License and platform dependencies require review |
| pascalorg/editor | 3D architectural project editor | Review editor interaction and project persistence patterns; retain Ultida's approved-version lineage | License and dependency review required |
| catherinevidos/Pinteriors | Pinterest-like designer pinboard and saved references | Add reference boards, project shortlist, tags, and source provenance to the existing reference library | License review required |
| ZORY-AI/zory-ai | AI visualization connected to real product inventory, dimensions, and shopping workflows | Strengthen catalog item dimensions, availability, supplier data, and quote/BOM links; do not treat visual matches as product truth | License and product data terms require review |
| Aiman20003/Chic-Lighting-Design | Lighting catalogue/storefront patterns | Use only as inspiration for a proper lighting/material library and lighting metadata | License review required |
| Aeroer-Live/Vainara | Branded interior styling presentation | Reference only for curated visual presentation and brand storytelling | No source reuse established |
| mrspartak/awesome-interior-design | Resource list | Research index only; no runtime dependency | List license/individual licenses apply |
| Luminescense-Studios | Organization link did not expose a verified repository for direct reuse in this scan | Revisit only when a specific public repository is named | No reuse |

## What is safe to implement now

1. Store prompt templates by workflow stage and version them with the provider
   request. Include plan scan, scale reconciliation, material revision, camera
   revision, and geometry-lock instructions.
2. Add a project reference board with source URL, image hash, room/category,
   selected status, and provenance. References remain visual evidence only.
3. Add catalog metadata for functional zones: module family, compatible room,
   wall-anchor requirement, dimensional bounds, manufacturing rules, material
   slots, and preview image.
4. Add a reviewable object-detection evidence layer that records model,
   confidence, source hash, and proposed anchor without mutating CanonicalPlanV1.
5. Add scene interaction acceptance tests: select room, select module part,
   change material, preserve millimetre dimensions, and persist a new version.
6. Add production readiness checks for service clearances, appliance envelopes,
   cabinet-face counts, and missing material assignments.

## Explicitly rejected approaches

- Do not import a second backend, database, or geometry authority from any repo.

## Second repository pass: provider, staging, Vastu, CAD, and evaluation

### `narender-rk10/Gen-AI-Home-Interior-Designer`

The repository documents a compact React + FastAPI + Gemini flow: upload an
image, choose room/style/colour inputs, receive an image result plus a textual
design explanation, and retain session history. Its README identifies a
Creative Commons Attribution-NonCommercial-NoDerivatives licence. This is a
useful interaction pattern for Ultida's visual proposal and explanation layer,
but the non-commercial/no-derivatives terms make copying code or assets
inappropriate for a commercial product. Ultida should keep its existing
provider gateway and persist the equivalent inputs, provider, prompt version,
usage, and result lineage.

### `immex-tech/decor8ai-sdk`

This is an SDK/API integration repository rather than a geometry engine. It
advertises virtual staging, sketch-to-3D, kitchen/cabinet changes, wall and
cabinet colour changes, object removal, and upscaling, with Python, Node,
Dart, ComfyUI, and REST integrations. The README describes segmentation,
specialized models, ControlNet-style placement, and upscaling. Treat it as a
candidate external provider adapter only: verify commercial terms, API
capabilities, image retention, and geometry guarantees before enabling it.
Do not make it a dependency or allow it to replace scene.v1.

### `SamurAIGPT/ai-real-estate-stager`

This is a Next.js SaaS pattern for empty-room staging with accounts, credits,
Stripe, NextAuth, and Prisma. It is relevant to render-job lifecycle,
quotas, billing, and before/after presentation, not modular manufacturing.
Ultida should adopt the product concepts only after inspecting its license and
provider terms: render credits, idempotent jobs, provider cost tracking, and
revision history belong in the existing Supabase job/artifact model.

### `Blacksujit/AntarAalay.AI`

This MIT-licensed Indian design prototype combines room uploads, three design
variations, Vastu analysis, budget breakdowns, and direction-specific advice.
Its stack uses FastAPI, Supabase PostgreSQL, Firebase storage/auth, Stability
AI, React Query, and Zustand. Ultida should adopt the domain separation:
Vastu is an explicit, reviewable advisory constraint and budget is a derived
commercial estimate. It must not silently alter geometry or be presented as
an engineering guarantee.

### `eavemma5-tech/ai-interior-design-resources`

This is a small curated resource hub linking to an external AI interior design
site and localized product pages. It has no reusable application runtime or
catalog data model. It is useful only as a content/discovery reference; no
dependency or content should be imported into Ultida without source and usage
review.

### `Nirmit-Angane/Vastuflow`

The repository describes client-side floor-plan geometry, 16-zone Vastu
mapping, issue detection, and PDF reporting. This aligns with Ultida's need
for deterministic geometric advisory checks. The implementation lesson is to
keep Vastu overlays as derived evidence over CanonicalPlanV1, with explicit
direction/orientation and explainable findings. It is not a replacement for
Ultida's plan approval or room geometry validation.

### `nitin-rachabathuni/property-design-cad`

This MIT project is the closest architectural reference: hierarchical room
data, Three.js PBR dollhouse viewing, SVG plan generation, FreeCAD/Blender
pipeline steps, GLB and walkthrough outputs, and India-specific Vastu hooks.
Its JSON project/interior split and staged 2D -> CAD -> 3D pipeline are useful
patterns. Ultida should implement the same separation through its existing
plan.v1, scene.v1, drawing, and production contracts rather than importing a
second pipeline. Third-party bundled tools retain their own licences.

### `Anni-16/Cosmic-Ecommerce`

This is a PHP-oriented spiritual/Vastu ecommerce application with shop,
cart, checkout, admin, and product/order concepts. It is not relevant to
scene compilation or modular furniture. At most, it reinforces the need for
catalog, quote, order, and approval boundaries in Ultida; no code or assets
should be copied.

### `clvrai/furniture-bench`

FurnitureBench is a research benchmark for real-world furniture assembly,
not a design application or product catalog. It can inform future assembly
verification and manipulation research, but it does not provide production
cutlists, cabinet rules, or scene geometry. Any dataset/model use requires a
separate license and dataset review.

## Consolidated adoption plan

1. Keep Supabase, the existing API, Cloudflare queue, and `scene.v1` as the
   only runtime authority.
2. Add provider adapters behind `ProviderCapabilityV1`; image providers may
   create visual proposals or edits, never dimensions or production parts.
3. Add render credits, cost/usage, idempotency, and before/after revisions to
   the existing render job and artifact contracts.
4. Add Vastu orientation, zone overlays, findings, and remedies as persisted
   advisory evidence linked to a plan version.
5. Use the CAD repository pattern to expand scene compiler outputs into SVG,
   FreeCAD/Blender interoperability, GLB preview, and deterministic drawings.
6. Use benchmark ideas to add golden-room metrics for overlap, circulation,
   opening access, service clearance, and cabinet-face consistency.
7. Require license, model, dataset, provider, and asset provenance review
   before any external code, model, texture, or reference is shipped.

## Non-adoption decisions

- No repository is copied wholesale.
- No new backend, auth system, database, or geometry authority is introduced.
- No commercial provider is enabled merely because its README claims
  photorealism or precise placement.
- No image-generation result is promoted to an approved scene, elevation,
  cutlist, DXF, BOM, or CNC asset without deterministic validation and review.
- Do not use a hosted demo endpoint as Ultida production infrastructure.
- Do not copy images, model weights, datasets, or prompts marked educational,
  fair-use, or without a clear license into the product catalogue.
- Do not use a text-to-image model to infer exact walls, doors, windows,
  cabinet divisions, dimensions, or CNC geometry.
- Do not replace Three.js Scene Studio with a static image or iframe.

## Implementation order

### Now

- Keep the existing catalog API and persist all placed modules as anchored
  `module_instances`.
- Replace any remaining hardcoded UI catalogue entries with catalog API data.
- Add prompt/version provenance to render and analyzer requests.
- Add reference-board persistence and source hashes.

### Next

- Add evidence-backed object detection and spatial suggestions as draft
  proposals.
- Add material-slot editing and targeted scene recompilation.
- Add production preflight and cabinet-face QA before cutlist release.

### Later

- Evaluate a furniture-face segmentation model on a licensed internal fixture
  set.
- Add optional AR/VR input after browser scene selection and persistence are
  stable.
- Evaluate external scene synthesis research only as a proposal generator;
  every result must compile through scene.v1 validation.

## Modular furniture and constraint-planning extension

The additional modular-furniture references reinforce a product decision rather
than justify copying another application:

- `ibadami/3D-semantic-segmentation-of-modular-furniture` is relevant as a
  semantic vocabulary for visible cabinet faces: shutters, drawers, shelves,
  carcass and functional regions. It should be evaluated only with licensed
  model/data terms and used as evidence, never as authoritative dimensions.
- `openkb-modular-studio-furniture` is a useful interaction pattern for
  body/gear-aware workstation configuration and a catalog of reusable design
  choices. Its repository is an early personal-workstation project, so Ultida
  should borrow the parameterized-workstation idea, not its implementation.
- `Modular-Office-Furniture` is currently an empty repository and contributes
  no code or assets.
- The modular furniture repositories named by the user vary in maturity and
  do not replace Ultida's canonical catalog, scene compiler, or manufacturing
  contracts. External furniture imagery must remain reference material until
  dimensions, rights, and production metadata are verified.

FlairGPT's published method is the strongest planning insight in this batch:
parse the brief into room facts, generate functional zones, create an ordered
object list, express relationships as a layout graph, translate relationships
to deterministic cost/constraint functions, then optimize placements before
retrieving visual objects. Ultida now implements the first deterministic slice
of that method in `@ultida/layout-core`: each placement can carry typed
constraints, the evaluator checks wall anchoring, openings, circulation and
services, and the result is an explainable score rather than an opaque AI
decision. The AI may propose candidates; approval still requires the persisted
plan, wall IDs, openings and millimetre geometry.

### Adopt next

- Add semantic part metadata to catalog templates: `carcass`, `shutter`,
  `drawer`, `shelf`, `loft`, `dummy/filler`, `profile-glass`, `lighting-anchor`,
  `service-void`, and `production-part`.
- Persist the layout constraint graph alongside each candidate draft so the
  review UI can show why a candidate lost points.
- Add candidate diversity by changing object priorities and valid shapes, not
  by randomizing approved geometry.
- Add accessibility metrics for door reachability, circulation path length,
  overlap, and opening obstruction before layout approval.
- Link accepted catalog templates to scene module parts and production
  preflight; never allow a visual-only catalog card to become a factory part.

### Sources added

- [FlairGPT method and results](https://flairgpt.github.io/)
- [3D semantic segmentation of modular furniture](https://github.com/ibadami/3D-semantic-segmentation-of-modular-furniture)
- [OpenKB modular studio furniture](https://github.com/travisdetert/openkb-modular-studio-furniture)
- [Modular Office Furniture](https://github.com/bloomsburyfurn/Modular-Office-Furniture)
- [I-Design](https://atcelen.github.io/I-Design/)

## Sources

- [skills-for-architects](https://github.com/AlpacaLabsLLC/skills-for-architects)
- [sd-interior-design](https://github.com/alaradirik/sd-interior-design)
- [room-designer](https://github.com/TeamFWS/room-designer)
- [openlintel](https://github.com/allgpt-co/openlintel)
- [awesome-nano-banana-spatial-design](https://github.com/qzh3722/awesome-nano-banana-spatial-design)
- [RoomAligner](https://github.com/Ashad001/RoomAligner)
- [ai-interior-restyler](https://github.com/anton-karlovskiy/ai-interior-restyler)
- [artki](https://github.com/MurtazaKafka/artki)
- [Pinteriors](https://github.com/catherinevidos/Pinteriors)
- [ZORY-AI](https://github.com/ZORY-AI/zory-ai)
- [Vision_nest](https://github.com/sakshi01coder/Vision_nest)
- [3D-Interior-Designing](https://github.com/krishaa1803/3D-Interior-Designing)
- [Vainara](https://github.com/Aeroer-Live/Vainara)
- [Chic-Lighting-Design](https://github.com/Aiman20003/Chic-Lighting-Design)
- [3D semantic segmentation of modular furniture](https://github.com/ibadami/3D-semantic-segmentation-of-modular-furniture)
- [pascalorg/editor](https://github.com/pascalorg/editor)

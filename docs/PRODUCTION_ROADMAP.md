# ULTIDA production roadmap

Status: active canonical roadmap. Last reviewed: 2026-08-13.

## Product contract

ULTIDA's authoritative chain is:

`Guided Plan -> Space Setup -> Approved Layout -> Parametric Modules -> Materials -> scene.v1 -> Render / Drawings / Production`

Generated images and imported CAD/PDF files are evidence, never geometry authority. Initial Design may continue with visible assumptions. Final Production requires an approved, measured scene and explicit manufacturing review.

## Release order

1. Prove guided upload, calibration, room/wall/opening review and Review DXF on a matching Preview worker/API environment.
2. Prove persisted Spaces, validated layout approval, wall-anchored modules, component materials and scene approval.
3. Prove one Cloudflare scene-linked render and one component-specific laminate revision with geometry locks.
4. Generate PDF, SVG, DXF, SketchUp review Ruby, BOM and cutlist from the exact approved scene.
5. Release CNC v1 as validated SVG/DXF patterns, nesting sheets and labels. G-code remains unavailable until a named machine postprocessor is tested.

## Current production rules

- Default carcass and shutters: 18 mm; studios may select the supported 16 mm alternative through a versioned ruleset.
- Back panel: 6 mm.
- Visible edges: 2 mm PVC; internal exposed edges: 0.8 mm PVC; hidden/back/glass edges: none unless explicitly configured.
- Stock sheet: 2440 x 1220 mm, 10 mm trim, 3 mm kerf by default.
- Every physical panel has a unique part instance ID and retains its scene component, module, room, material and version lineage.
- Hardware and machining operations are never inferred from rectangle dimensions.

## Release gates

- No durable job remains active past its deadline without heartbeat or terminal state.
- Manual plan completion works when all AI providers are unavailable.
- Three representative plans complete Guided + Auto review without fabricated success.
- Spaces, layouts, modules, materials and scene versions survive refresh and sign-in resume.
- A real render and targeted laminate revision pass scene-lock validation.
- Production downloads have correct MIME type, filename, content and reopen successfully.
- Cross-organisation API and private-storage access is denied.
- The exact tested Vercel Preview is promoted; production is never rebuilt from a different commit.

## Remaining milestones

- Persist production snapshots, approvals, labels, stock sheets, offcuts and revision comparisons in Supabase with organisation-scoped RLS.
- Add a reviewed CAD/PDF production-import workspace. Detected dimensions and annotations such as AS/EQ remain untrusted until mapped to scene components.
- Add parameterised Om, jaali, lattice, arch, floral and geometric CNC templates with bridge and clearance validation.
- Complete the standalone project-attachment flow for Plan Tracer, Room Builder, Layout, Module Planner, Material Preview, Render, Drawing and Cutlist tools.
- Add authenticated desktop/tablet/mobile browser coverage and provider canaries before production promotion.

## Safety constraints

- Cloudflare is the automatic hosted provider. Gemini is optional enrichment only after a successful funded health probe. OpenAI is not an automatic fallback.
- AURA may read, explain and prepare proposals; it cannot silently mutate approved geometry, estimates, cutlists, quotes or release state.
- LocalAI and ComfyUI are optional studio-local providers and are not demo dependencies.
- SketchUp exports are reviewable Ruby scripts derived from scene.v1. Hosted ULTIDA never executes arbitrary Ruby.


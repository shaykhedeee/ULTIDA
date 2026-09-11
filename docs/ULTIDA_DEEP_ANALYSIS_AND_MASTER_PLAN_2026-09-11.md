# ULTIDA — Deep Analysis & Master Plan

Date: 2026-09-11
Analysed commit: `7cf3f51` (`codex/release-recovery-20260728`), now mirrored onto `arena/01a08e58-ultida`.
Scope: full repository read (64,355 TS/TSX lines across 4 apps + 19 packages), competitor scan, and per-repository assessment of every GitHub link supplied.

---

## 0. The single most important finding

**Your test suite is not broken, and your machine is not out of memory.**

Previous sessions reported: *"The full test suite is blocked by the machine's Node ENOMEM startup failure before tests execute."* That diagnosis was wrong, and it has been hiding a real release gate for several sessions.

I ran the full matrix in this environment:

| Suite | Result before | Root cause | Result after fix |
|---|---|---|---|
| `test:drawing` | 24 pass / **1 fail** | `ezdxf` Python package not installed | **25 pass / 0 fail** |
| `test:api` | **exit 1** after all tests "passed" | same — `dxf.test.ts` | **all pass, exit 0** |
| `test:rooms` | 15 pass | — | 15 pass |
| `test:render` | 22 pass | — | 22 pass |
| `test:aura` | 6 pass | — | 6 pass |
| `test:providers` | 4 pass | — | 4 pass |
| `build:packages` | pass | — | pass |
| `check --workspace=@ultida/web` | pass | — | pass |

The fix was one command: `pip install ezdxf==1.4.4`.

The failing assertion was `python ezdxf validator approves canonical dxf output`. The test has an `isPythonAvailable()` guard, but the guard only checks that **Python** exists — not that **ezdxf** exists. On a host with Python but no ezdxf (Vercel CI, a fresh clone, this sandbox), the guard passes, the validator runs, and the test fails with `ERROR: ezdxf is not installed`.

**Why this matters more than any feature:** your CAD export path — the thing that turns a design into something a factory can cut — has had **no working independent validation** for several sessions, and the failure was being explained away as a hardware problem. Everything downstream of DXF (SketchUp interop, CNC post-processing, panel labels) has been running unverified.

**Action (P0, one hour):** make the guard check ezdxf specifically and skip honestly when absent; add `pip install -r requirements-test.txt` to the CI workflow so the gate actually runs in CI rather than being skipped everywhere.

```ts
// apps/api/test/dxf.test.ts + packages/drawing-core/test/wall-elevation.test.ts
function isDxfValidatorAvailable(): boolean {
  const py = spawnSync('python', ['-c', 'import sys; print(sys.version_info.major)'], { encoding: 'utf8' });
  if (py.error || py.status !== 0 || !/^\s*3\s*$/.test(String(py.stdout))) return false;
  const ez = spawnSync('python', ['-c', 'import ezdxf'], { encoding: 'utf8' });
  return !ez.error && ez.status === 0;   // ← the missing half
}
```

---

## 1. What ULTIDA actually is (and why that's the whole strategy)

After reading the code rather than the docs, ULTIDA is **not** an AI interior design app. It is a **measured manufacturing pipeline** that happens to have an AI renderer bolted to the visual end:

```
plan.v1 (measured, approved)
  → spaces (rooms, walls, openings — millimetre)
  → module instances (wall-anchored, keep-out checked)
  → scene.v1 (with moduleParts = actual panels)
  → { 3D · AI render · elevations · DXF · cutlist · BOQ · CNC }
```

The `moduleParts` concept is the crown jewel. `packages/module-framework/src/compilers.ts` (705 lines) turns a wardrobe into individual carcass panels, shutters, drawers, fillers, lofts, LED channels — each with `bom: { sku, qty, lengthMm, widthMm, thicknessMm }` and `drawing: { layer, sortOrder }`. `generateFullProductionCutlist` throws `AUTHORITATIVE_MODULE_PARTS_REQUIRED` rather than guessing. That is a genuinely serious piece of engineering.

**Nobody in the competitive set has this.** I verified against the full 2026 comparison landscape:

| Competitor | Their strength | What they cannot do |
|---|---|---|
| Planner 5D | Measured 2D/3D layouts, auto-furnish | No shop drawings, no cutlist, no CNC |
| Coohom / Homestyler | 100K–300K furniture models, 8K rendering | Catalog models are visual, not manufacturable |
| Foyr Neo | 60K models, CAD-like, 4K render | Not panel-level; no Indian modular standards |
| Decor8 / REimagine / Interior AI | Fast photo restyle, virtual staging | Explicitly *"a generated photo is not a measured plan"* |
| MeltFlex | Floor plan → 3D + shoppable furniture at true scale | Retail-scale, not fabrication-scale |
| Maket AI | Generative floor plan layouts | Layouts only |

Every source in the comparison landscape independently reaches the same conclusion: the photo tools cannot produce measurements, and the planning tools cannot produce fabrication output. [8 Best AI Interior Design Tools in 2026](https://www.krea.ai/blog/8-best-ai-interior-design-tools-in-2026-compared) rates Planner 5D as *"the better choice when dimensions and furniture placement must be resolved before decorative rendering"* while noting no tool bridges to construction. [Roomagic's use-case comparison](https://roomagic.me/blog/home-interior-design-apps) states outright that for *"making construction decisions: none of the image tools alone"* suffice. [Decorb's tested comparison](https://decorb.app/blog/homeowners/best-ai-interior-design-tools) concludes *"there is no single best AI interior design tool because the category serves at least four different jobs."*

**That four-way split is your moat.** ULTIDA is the only one attempting all four in one lineage. The strategic error would be to chase Decor8 on photo restyling — you would be the 15th-best photo tool. The correct move is to be **the only tool where the pretty picture and the factory cutlist come from the same approved geometry**, and to make that provably visible in the UI.

**Positioning line to build the product around:**
> Every ULTIDA render is a photograph of something you can actually build. Change the render, the cutlist changes. Change the cutlist, the render changes. There is one geometry.

No competitor can copy this without rebuilding their foundation. Decor8 would need a scene graph; Planner 5D would need panel compilers; Coohom would need Indian modular manufacturing rules.

---

## 2. Why the app "feels disconnected" — the actual diagnosis

You said: *"THE APP FEELS DISCONNECTED AND FEELS LIKE THERE'S STILL SO MUCH WORK LEFT. WHAT I WANT IS NOT THIS COMPLEX."*

This is a precise and correct instinct. Here is the mechanical reason, measured:

### 2.1 You have two competing applications inside one repository

| | SpacesWorkspace | DesignFlowWorkspace |
|---|---|---|
| Lines | 4,796 | 4,388 |
| `useState` | 54 | 59 |
| `useEffect` | 6 | 19 |
| `fetch()` calls | 13 | 27 |
| Posts to `module-instances` | yes | yes |
| Renders `WallBayEditor` | yes | yes |
| Renders `FlooringStudio` | yes | yes |
| Renders `ModulePreview` | yes | yes |
| Generates elevation SVG | yes | yes |
| Reachable from the sidebar | **yes** | **no** |

`/projects/:id/design` is a **9,000-line orphan**. It is registered in `App.tsx:1517` but appears nowhere in `Shell.tsx` navigation. Two full implementations of module placement, bay editing, flooring and elevations exist, drift apart with every change, and one of them is invisible.

**This is the primary source of "so much work left."** It is not that work is missing — it is that ~4,400 lines of work are duplicated and orphaned. Deleting `DesignFlowWorkspace` after porting anything unique out of it is the single highest-leverage change available.

### 2.2 The catalog covers the room while you place into it

`spaces.css:819` — `.design-library-drawer-backdrop { position: fixed; inset: 0; ... }` with `.design-library-drawer { width: min(720px, 92vw) }`. On a 1440px screen, the catalog covers **half the viewport** and dims the rest. You cannot see the room while choosing furniture for it.

### 2.3 There is no spatial interaction anywhere in the app

I grepped the entire `apps/web/src` tree for `onDrop`, `onDragOver`, and `draggable`. **Zero results.** Not one draggable element in the whole application.

Placement today: select wall → open modal → click card → `reconcileCatalogModuleFit()` runs → `suggestedOffsetMm` computed silently → POST → modal closes → panel switches to 'modules' → you find out where it went.

You never see where it lands before committing. For a *spatial* tool, that is the core defect. Your own suggested redesign identifies this correctly, and it is right.

### 2.4 Eight sidebar stages for what is conceptually four jobs

`Brief → Plan → Spaces → Scene Studio → Elevations → Costing → Presentation → Production`.

A designer thinks in four: **measure the room · furnish it · show the client · send it to the factory.** Eight stages with hard lineage gates between them makes every step feel like a checkpoint rather than progress.

### 2.5 One 2D canvas concept implemented 15 times

Fifteen files render room polygons in SVG: SpacesWorkspace, DesignFlowWorkspace, PlanReviewWorkspace, LayoutConfigWorkspace, FlooringStudio, ModulePreview, ArchitecturalElevationSignOffSheet, WorkingDrawingsDossier, CncPatternStudio, ModularUnitPlanner, RoomBuilder, VisualizeStudio, DesignWorkspace, SceneStudio, App.tsx. Each has its own scaling, its own colours, its own selection model. The app feels different on every screen because it *is* a different implementation on every screen.

---

## 3. Every GitHub repository you supplied — assessed individually

I checked each against the codebase to determine what is genuinely extractable versus what is already covered.

### 3.1 `alaradirik/sd-interior-design` — **MIT · adopt the technique, not the code**

Realistic Vision V3.0 inpainting + **segmentation ControlNet + MLSD ControlNet**, packaged with Cog for Replicate. MIT licensed.

**Verdict: do not import.** It is a GPU Python service; ULTIDA is serverless TypeScript on Vercel. Running it would mean a second backend.

**What is genuinely valuable — the conditioning stack.** Their pipeline conditions on *segmentation* (what each region **is**) plus *MLSD* (straight architectural lines). Compare with what ULTIDA sends to Cloudflare FLUX today (`provider-gateway/src/index.ts:271`):

```
input_image_0 = base render      input_image_1 = depth map
input_image_2 = edge map         input_image_3 = material-region map
```

Four slots, all used. Cloudflare's limit is exactly 4 ([FLUX.2 klein 4B changelog](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/): *"supports up to 4 image inputs... must be named input_image_0..3... all input images must be smaller than 512x512"*). You are at the ceiling and correctly resizing to 511px.

**The insight worth stealing:** sd-interior-design gets layout preservation from **MLSD (line segments)**, not from a depth map. Depth is the weakest of your four channels for interiors — interior depth maps are mostly flat walls, and the model learns little from them. Your `edge_map` is already an MLSD-equivalent and is doing the real work.

**Concrete change:** make the fourth slot adaptive rather than always the material map.
- Material-swap operation → material-region map (as now)
- Wide room render → **object-mask composite** (which module is where) instead of depth
- Detail/close-up → **skirting + opening masks** (you already generate both in `base-render.ts` and currently send neither)

That is a pure prompt/slot-allocation change in `executeCloudflare`, no new dependency, and it uses artifacts you already compute and throw away.

### 3.2 `immex-tech/decor8ai-sdk` — **commercial API · one feature worth copying**

50+ styles, 25+ room types, virtual staging, wall/cabinet colour change, sketch-to-3D, object removal, upscaling to 4–8x.

**Verdict: do not integrate as a provider.** It is a paid third-party API that would generate images with no relationship to your scene geometry — the exact "pretty lie" your architecture is built to prevent.

**The one feature you should copy: image upscaling as a separate final step.** Decor8 exposes `upscale_image(input, scale_factor)` as its own call. ULTIDA generates at 1024×1024 and stops. For a client presentation PDF, 1024px is visibly soft.

Add a **post-QA upscale stage**: render at 1024 → run QA against geometry → *only if QA passes* → upscale 2× → store both. QA must run on the 1024 image (where masks align), never on the upscale. This is ~60 lines in `render-pipeline` using `sharp`, which you already depend on.

**Also worth copying: their taxonomy.** 25 room types and 50 styles as flat enums. Your `RoomTypeSchema` has 13; your `STYLE_PRESETS` is a short array in `SpacesWorkspace.tsx`. Styles should be a versioned catalog record with prompt fragments, not a UI constant.

### 3.3 `awesome-nano-banana-spatial-design` (`qzh3722`) — **CC-licensed prompts · highest immediate value**

I fetched the repository. It is a bilingual EN/中文 prompt library, 137 commits, organised into a **six-stage workflow** that maps almost perfectly onto ULTIDA's pipeline:

| Their stage | ULTIDA stage |
|---|---|
| 1. Concept Ideation | Brief |
| 2. Space Planning | Spaces / layout candidates |
| 3. Technical to Visual (CAD → visualization) | **scene.v1 → render** ← the one that matters |
| 4. Material & Styling | Material assignment |
| 5. Scene Rendering | Final render |
| 6. Specialized Tasks | Detail revisions |

**Verdict: adopt the structure, write your own prompts.** Licence is CC (prompts are documentation, not code), and their prompts are Nano-Banana/Gemini-tuned while your primary is Cloudflare FLUX.

**The structural insight is the payload.** Today your prompt is one hardcoded string in `apps/api/src/index.ts`:

```ts
structuredPrompt: 'Compiled server-side from the approved ULTIDA scene.'
```

That is doing almost nothing. The reference-image instruction in `executeCloudflare` is carrying the entire burden.

**Build a `packages/prompt-core`** with versioned, stage-specific templates that compile *from scene.v1 facts*:

```ts
compileRenderPrompt(scene, room, camera, style) → {
  version: 'ultida-render-prompt-v2',
  spatial:   `${room.widthMm}×${room.depthMm}mm ${room.type}, ${ceilingMm}mm ceiling,
              ${doors} doors, ${windows} windows with ${sillMm}mm sills`,
  contents:  modules.map(m => `${m.name} ${m.widthMm}mm wide on ${wallLabel}`),
  materials: assignments.map(a => `${a.slot}: ${a.materialName}`),
  camera:    `${lensMm}mm lens at ${eyeHeightMm}mm eye height`,
  lock:      'Preserve every wall position, opening, sill/head height, skirting, cabinet division',
  negative:  buildForbiddenChanges(geometryLock),
}
```

Two more of their techniques worth adopting directly:
- **Clockwise wall tracing** — deterministic wall ordering so a described room is unambiguous. Directly applicable to your plan analyser and prompt compiler.
- **One-space-at-a-time revision** — never re-render the whole apartment when one room changed. Maps onto your `stale` render invalidation.

Store `promptVersion` on every render record (the field already exists in `provenance`), so you can A/B prompt versions against QA pass rates. **This is your fastest render-quality win: better prompts cost nothing per request.**

### 3.4 `smdogroup/paropt` — **not applicable, but the idea is**

C++/MPI interior-point and trust-region optimiser for large-scale distributed **topology optimisation** (structural design, 90M+ DOF). Requires MPI and Cython.

**Verdict: reject as a dependency, unambiguously.** This is aerospace/structural research tooling. It has no path into a Vercel serverless TypeScript app, and topology optimisation solves a problem you do not have.

**The transferable idea:** ULTIDA has a genuine constrained-optimisation problem it currently solves with hardcoded heuristics — `defaultCategoriesForRoom(roomType, priority)` returns fixed category lists for `circulation | balanced | storage | luxury`. That is four canned answers, not optimisation.

The real problem is small and well-posed: *given a wall of length L, keep-outs K, and a set of modules with widths W and priorities P, choose the subset and arrangement maximising utilisation subject to clearances.* That is 1D bin-packing with constraints, solvable exactly with dynamic programming for realistic sizes (a wall has <20 candidate modules). ~200 lines in `packages/layout-core`, no dependency, deterministic and testable. Do this, not ParOpt.

### 3.5 `itsalmv/custom-ai-project-management-system` — **could not verify**

The repository is not publicly resolvable; search returned only unrelated results (an IRJMETS paper on GitHub PM automation, and `sdi2200262/agentic-project-management`).

**Verdict: no adoption.** Your `docs/research/GITHUB_INTERIOR_DESIGN_REPOSITORY_AUDIT_20260729.md` already covers project-memory patterns via `AlpacaLabsLLC/skills-for-architects`, and you already have `project_operations`, `reviews`, `comments`, `risks` and `design_decisions` tables in Supabase. This need is met. If you can share the correct URL I will assess it specifically.

### 3.6 GRID System — **link is dead (404)**

`gridinteriorsystem.com/modular-furniture-catalogue` returns 404 from LiteSpeed. Cannot assess.

**However, the underlying need is real and I have a concrete answer — see §4.3.** Your catalog has **74 modules with only 6 preview images and 4 GLB URLs pointing at files that do not exist.**

### 3.7 The furniture-library question — the honest answer

You said *"I've added a few GitHub repos with furniture library. Better integrate them."*

I checked. **`apps/web/public/assets/models/` does not exist.** The four `glbUrl` values in `catalog-core` (`/assets/models/lighting/arco-floor-lamp.glb` etc.) are **dangling references**. `SceneStudio.tsx` will attempt to `gltfLoader.load()` them and fail. The recovery-branch note *"unavailable catalog GLBs no longer cause broken loading attempts"* was a guard, not a fix — there are still no assets.

Licensing reality for the datasets in this space:
- **3D-FUTURE / 3D-FRONT** (9,992 furniture models, professionally designed): `cc-by-nc-4.0` — **non-commercial**. You cannot ship these in a commercial product.
- **Poly Haven**: CC0, genuinely free, but few furniture pieces and none are Indian modular.
- **Smithsonian Open Access / The Base Mesh**: CC0, ~900 models, mostly not furniture.

**Verdict: there is no licence-clean GLB library for Indian modular furniture. Stop looking for one — and you do not need one.**

`module-framework/compilers.ts` already generates exact panel geometry for every module. A wardrobe is *already* a set of positioned boxes with real millimetre dimensions. **Generate GLB from `moduleParts` at compile time.** See §4.3 — this is better than any downloaded library because the 3D model is guaranteed to match the cutlist.

---

## 4. The plan — sequenced by impact per unit of risk

### PHASE 0 — Stop the bleeding (1 day)

**0.1 Fix the DXF release gate** *(described in §0)*
Guard on `ezdxf`, not just Python. Add `pip install -r requirements-test.txt` to `.github/workflows`. **Your CAD export is currently unvalidated in every environment.**

**0.2 Remove the last two CUBEDECORS references**
You asked for this twice. Two remain:
- `apps/web/src/components/drawings/WorkingDrawingsDossier.tsx:194` → `CUBEDECORS × ULTIDA`
- `packages/drawing-core/src/production-dossier-pdf.ts:247` → `CUBEDECORS × ULTIDA ARCHITECTURAL STUDIO`

Both should read the studio name from `studio_settings` (the table exists, and `ShopDrawingOptions.studioName` is already plumbed) with `ULTIDA ARCHITECTURAL STUDIO` as fallback. Add a lint test asserting the string appears nowhere outside a studio-name field.

**0.3 Delete the orphaned second application**
Port anything unique out of `DesignFlowWorkspace.tsx`, then delete it and its route. **−4,388 lines.** Half of "how much work is left" disappears, and the drift between the two placement implementations ends permanently.

---

### PHASE 1 — Make furnishing spatial (1 week) ← *the thing you are most unhappy with*

Your proposed redesign is correct. Refined against what the code actually supports:

**1.1 Catalog becomes a docked rail, never an overlay**
```css
/* replace .design-library-drawer-backdrop entirely */
.spaces-layout {
  grid-template-columns: minmax(240px, 290px) minmax(0, 1fr) 340px;
  grid-template-areas: "rooms canvas catalog";
}
@media (max-width: 1400px) { /* catalog collapses to an icon rail */ }
```
Reuse `catalogQuery`, `catalogFilterFamily`, `catalogFitFilter` unchanged — only the container changes. **This alone fixes "I can't see the room while choosing furniture."**

**1.2 Drag-and-drop with live green/red ghost**

The critical detail your plan gets right: **call `reconcileCatalogModuleFit()` on every drag-move, not on drop.** It is synchronous and cheap (pure arithmetic over the wall's openings array), so per-move evaluation at 60fps is fine.

```
onDragStart(card)  → draggedModule ref
onDragOver(svg)    → nearest wall from cursor
                   → project cursor onto wall → offsetMm
                   → fit = reconcileCatalogModuleFit(wall, module)
                   → ghost rect at real widthMm × depthMm, green if fit.fits else red
onDrop             → valid: placeModule(wall, offsetMm)   ← explicit params
                   → invalid: tooltip with fit.issues[0] at the cursor
```

**Refactor required:** `placeCatalogModuleOnSelectedWall(module)` reads `activeCatalogWall` and `fit.suggestedOffsetMm` from closure. Change to `placeModule(module, wall, offsetMm)` and have the existing click path call it with the suggested offset. Both interaction models keep working. **Do not touch the validation, the API contract, or the post-placement `spacePanel('modules')` switch.**

**1.3 Keyboard/accessibility path**
Drag-and-drop is not accessible. Keep click-to-place as an equal peer: click card → module "armed" → arrow keys nudge along the wall → Enter commits, Escape cancels. Same ghost preview, same validation.

**1.4 Split the state (do this *with* 1.2, not after)**
54 `useState` calls in one 4,796-line component is why every change is risky. Extract per-panel reducers:
```
useModulePlacement()   — catalog, drag state, ghost, fit, placement
useRoomGeometry()      — walls, openings, columns, beams, services
useFloorSurfaces()     — flooring, skirting
useSceneCompilation()  — compile, approve, staleness
```
Do it as part of the drag work while you are already in the file. Deferring it means doing the archaeology twice.

---

### PHASE 2 — Elevations to genuine production quality (1 week)

`shop-drawing-renderer.ts` (685 lines) produces a good sheet: top view, red dimension chains, Gola profiles, System-32 annotations, laminate matrix, title block, and (new this week) measured door/window openings with sill datums.

**But it has three defects I can prove from the code:**

**2.1 It invents modules when the scene has none** (line 237)
```ts
const activeModules = modules.length ? modules : (targetModule ? [targetModule] : [
  { id: 'mod-1', family: 'kitchen-base', widthMm: Math.min(2400, wallLengthMm), ... },
  { id: 'mod-2', family: 'kitchen-wall', ... },
  { id: 'mod-3', family: 'loft', ... }
]);
```
A wall with no modules silently produces a **fabricated three-tier kitchen elevation**. In a production dossier that is dangerous — it is exactly the "fake truth" your architecture forbids everywhere else. **Replace with an explicit "NO MODULES PLACED ON THIS WALL" sheet.** Same for `wallLengthMm ?? 3200` and `wallHeightMm || 2718` — an unmeasured wall must be labelled TBC, not silently defaulted.

**2.2 It ignores `moduleParts` entirely**
`grep -c moduleParts shop-drawing-renderer.ts` → **0**. The renderer re-derives bays with `Math.ceil(baseW / 600)` while `scene.moduleParts` contains the **actual compiled panels** with exact positions, sizes, semantic types and material slots.

This means **your elevation drawing and your cutlist can disagree.** The cutlist uses `moduleParts` (`AUTHORITATIVE_MODULE_PARTS_REQUIRED`); the elevation guesses. For a manufacturing dossier that is the most serious correctness bug in the codebase.

**Fix:** draw each `part` at `part.transform` with `part.size`, coloured by `part.meta.semanticType` (`shutter | drawer | shelf | filler | loft | lighting_channel`). Every rectangle on the sheet then corresponds to a row in the cutlist. Dimension chains come from real part boundaries, not `numBays` arithmetic.

**2.3 It ignores the composition schedule**
`grep -c compositionSchedule` → **0**. Bay edits made in `WallBayEditor` do not reach the drawing.

**2.4 Enhancements that make it best-in-class**
- **Section view** (currently only external/internal/top) — carcass depth, back panel, wall fixing, scribe
- **Hardware schedule** — hinges, runners, handles, per bay, from `part.meta.bom.sku`
- **Part-number callouts** — every panel tagged `W06-01`, matching `generateW06PanelSchedule` and the label sheet, so the factory can cross-reference sheet ↔ cutlist ↔ label
- **Material key** on the sheet keyed to `materialSlot` with real EGGER decor codes (your `import-egger-laminates.ps1` already verifies these properly)
- **Revision cloud + revision table** — a dossier reissued after a change must show what changed
- **Scale bar and stated scale** (`1:20 @ A3`) — currently the sheet has dimensions but no declared scale

---

### PHASE 3 — Floor-plan analyser, ten-fold (2 weeks)

Current pipeline: `raster → sharp normalise → [OpenCV wall tracer ‖ Tesseract OCR] → Gemini vision → reconcileToElements`.

`wall_tracer.py` (513 lines) is solid: adaptive threshold, morphological close, `HoughLinesP`, axis snapping, collinear merge, thickness dedup, corner snapping, opening classification.

**Six specific upgrades, in order of value:**

**3.1 Wire up `vector-extractor.ts` — 519 lines of finished code that nothing calls**

`grep -rn "extractSvgVectorSegments" apps/` → **only the barrel export.** You have working native vector extraction — path streams, sub-pixel corner refinement, collinear merging, thickness validation, ROI clustering, calibration cross-checking — and the analyser never uses it.

Most builder floor plans are **vector PDFs**. Extracting geometry natively is not 10× better than Hough on a rasterised PDF — it is exact versus approximate. **Route: if the source has a vector layer, use it as primary and treat CV/OCR as corroboration.** This is the single largest accuracy win available and the code is already written and tested.

**3.2 Wire up `scale-engine.ts` — also written, also unused**

`resolveScale(observations)` with typed sources exists. `grep` → no callers. Scale is currently a single value with a `scaleVerified` boolean. Multi-source scale resolution (printed dimension text · known door width · scale bar · stated ratio) with disagreement detection is exactly what `crossCheckCalibrationDimensions` in the vector extractor was built to feed. **Two finished modules that need connecting to each other.**

**3.3 PDF rasterisation on the server**

`plan-analysis-service.ts:410`: *"Without a PDF rasterizer on this host we skip deterministic CV/OCR for PDF and rely on the vision provider (honest: deterministic evidence absent)."*

So for PDFs — **your most common input** — you get zero deterministic evidence and depend entirely on Gemini. And non-Gemini providers throw `PDF_REQUIRES_GEMINI` (415). Add `pdfjs-dist` (pure JS, serverless-safe) to rasterise page 1 at 300 DPI. Instantly: CV + OCR + vector extraction all work on PDFs, and provider lock-in disappears.

**3.4 Give OCR real coordinates**

`plan-analysis-service.ts:107`: *"OCR has no reliable source coordinates in this runtime. We therefore only promote a recognised OCR value into geometry when there is exactly one..."*

Tesseract.js **does** return bounding boxes — `worker.recognize()` gives `data.words[].bbox`. You are discarding spatial information you already have. With word boxes you can associate `"3'-6\""` with the *nearest wall segment* instead of refusing to use it. This converts your most conservative rule into a precise one and lifts dimension recall substantially.

**3.5 Symbol detection for doors and windows**

`classify_opening` uses Hough lines inside gaps. Door swings are **arcs** — add `cv2.HoughCircles` / contour-arc detection to distinguish door (arc present, hinge side inferable) from window (parallel lines) from passage (nothing). Also detects swing direction, which feeds your keep-out logic and makes placement validation strictly better.

**3.6 A room-graph pass instead of independent rooms**

Rooms are currently detected individually. Add a post-pass: rooms sharing a wall are adjacent; a room with a door to a corridor is accessible; a room with no door is a detection error. Cheap graph reasoning, catches whole classes of errors, and gives the Vastu module real adjacency data.

**Explicitly reject:** ML floor-plan models (CubiCasa5K, TF2DeepFloorplan, RoomFormer). Your existing audit already rejected them for good reasons — licence, CUDA, stale weights. The six items above are all deterministic, all testable, all serverless-compatible.

---

### PHASE 4 — Measurement-accurate furniture in renders (1 week)

This is your headline question: *"the best way I can integrate measurement accurate furniture to renders."*

**The answer is that you have already solved it and are not using the solution.**

`renderScenePerspectiveArtifacts` projects real scene geometry — including `moduleParts` (line 279) — into a perspective base render with depth, edges, object masks, opening masks, skirting masks, and material regions. FLUX then *enhances* that base rather than inventing a room. That is architecturally correct and better than every competitor's approach.

**Four specific improvements:**

**4.1 Send the right four conditioning images** *(see §3.1)*
Four slots is the Cloudflare hard limit. Choose by operation instead of always sending depth. You generate `openingMasks` and `skirtingMasks` and currently transmit neither — those encode exactly the details QA later checks for.

**4.2 Make the prompt describe the geometry** *(see §3.3)*
`'Compiled server-side from the approved ULTIDA scene.'` tells the model nothing. Compile spatial facts from scene.v1.

**4.3 Generate GLB from `moduleParts` — the furniture-library answer**

Instead of hunting for licence-clean furniture models:

```ts
// packages/scene-compiler/src/glb-exporter.ts
export function compileModuleGlb(parts: CompiledModulePart[]): ArrayBuffer
```

Each part is a box at a known transform with a known material slot. glTF 2.0 is a documented binary format; emitting boxes + PBR materials is ~400 lines with no dependency. Result:

- **3D always matches the cutlist** — same source, structurally impossible to diverge
- **No licence exposure** — you generated it
- **No dangling `glbUrl`** — remove the four broken paths; generate on scene compile, cache by `geometryKey` (`getCatalogDigitalTwin` already computes a stable one)
- **Better base renders** — the perspective projection gets real shutter/drawer divisions, which is precisely what `cabinetDivisions` QA measures
- **A real export** — clients and contractors can open the GLB

This is strictly better than any downloaded library, because a downloaded wardrobe is *decoration* while a generated one is *the thing being manufactured*.

**4.4 Close the QA loop honestly**

`measureRenderImage` is genuinely good — real edge alignment, mask boundary alignment, per-object visibility. Two gaps are honestly commented in the code:
- `cabinetDivisionCount` — left `undefined`; needs a semantic detector. With generated GLB, divisions are projected exactly, so count vertical edges within each module mask.
- `cameraSimilarityMm` — currently `(1 - alignment) * 1000`, a proxy. A proper PnP solve against edge-map correspondences would make it real. Medium effort; do after 4.3.

---

### PHASE 5 — Simplify the shell (3 days)

**5.1 Eight stages → four**
```
MEASURE   (Brief + Plan)
DESIGN    (Spaces + Modules + Materials + 3D)   ← one screen, tabs inside
PRESENT   (Renders + Presentation)
PRODUCE   (Elevations + Cutlist + BOQ + CNC)
```
Same routes, same gates, four sidebar entries. The lineage stays; the perceived complexity drops by half.

**5.2 One shared canvas component**
Extract `<PlanCanvas>` handling polygon rendering, mm↔px scaling, selection, zoom/pan. Fifteen implementations → one. The app stops feeling different on every screen.

**5.3 A design-token layer**
`packages/ui` currently contains exactly one component (`ProvenanceBadge`). 8,928 lines of CSS across 19 files with repeated colours. Move tokens into `packages/ui`; move `Button`/`Card`/`Badge`/`Input` out of `components/ui/primitives.tsx` into the package.

**5.4 Repository hygiene**
`size-pack: 450 MiB`, with `ENHANCMENTS/references/` holding 52 MB, 34 MB, 21 MB PDFs and `apps/web/public/reference-vault/` at **99 MB tracked and shipped to every browser**. Move both to Supabase Storage. Clone time and Vercel build time drop dramatically.

---

## 5. Sequenced roadmap

| Phase | Work | Effort | Why this order |
|---|---|---|---|
| **0** | DXF gate · CUBEDECORS · delete DesignFlowWorkspace | 1 day | Unblocks CI truth; −4,388 lines |
| **1** | Docked catalog · drag-drop ghost · state split | 1 week | The complaint you raised most |
| **2** | Elevations from `moduleParts` · no invented modules | 1 week | Correctness bug: drawing ≠ cutlist |
| **3** | Vector extractor · scale engine · PDF raster · OCR boxes | 2 weeks | Two finished modules just need wiring |
| **4** | GLB from parts · conditioning slots · prompt-core | 1 week | Solves furniture-library + render accuracy together |
| **5** | 4-stage shell · shared canvas · tokens · repo slimming | 3 days | Makes it *feel* finished |

**Six weeks to a genuinely complete product.** Phases 1 and 2 are independent and can run in parallel.

---

## 6. What to say no to

| Temptation | Why not |
|---|---|
| Integrate Decor8/Pedra as a render provider | Generates images unrelated to your geometry — destroys the moat |
| Import 3D-FRONT / 3D-FUTURE furniture | `cc-by-nc-4.0` — non-commercial; and §4.3 is better |
| Add ParOpt or any MPI/CUDA dependency | Cannot run serverless; solves a problem you don't have |
| Deploy sd-interior-design as a service | Second backend, GPU cost; adopt the conditioning idea only |
| ML floor-plan models | Already rejected in your own audit, for correct reasons |
| Chase 50+ decorative styles | You compete on buildability, not style count |
| Refactor everything to a state library | The four extracted reducers in Phase 1 are sufficient |

---

## 7. Verification gates

Every phase must pass before the next begins:

```bash
npm run check                       # 23 workspace type checks
npm run build                       # packages + apps
npm run test:drawing                # 25 tests — now genuinely green
npm run test:api                    # full API suite — now exit 0
npm run test:rooms                  # 15
npm run test:render                 # 22
npm run test:aura                   # 6
npm run test:providers              # 4
npm run validate:reliability
npm run preflight
```

Plus per-phase acceptance:
- **P0** — `grep -ri cubedecors` returns only studio-name fields; DXF test skips honestly without ezdxf and passes with it
- **P1** — drag a 2100mm wardrobe onto a 1800mm wall → ghost red, drop rejected, `fit.issues[0]` shown at the cursor; drop on a valid wall → lands exactly where previewed
- **P2** — elevation of a wall with zero modules shows "NO MODULES PLACED", never an invented kitchen; every rectangle maps to a cutlist row
- **P3** — a vector PDF resolves scale from ≥2 independent sources and flags disagreement
- **P4** — generated GLB bounding box equals the module envelope to ±1mm
- **P5** — one `<PlanCanvas>` import across all plan-drawing screens

---

## 8. Summary

**What is genuinely strong:** the scene.v1 lineage, `moduleParts` panel compilation, deterministic base-render conditioning, honest QA that refuses to fabricate evidence, the vector extractor, the EGGER import script's verify-or-reject ethos.

**What is genuinely broken:**
1. The DXF release gate has been silently failing and was misdiagnosed as a hardware fault
2. Two applications, one invisible, drifting apart
3. Elevations invent modules and ignore the authoritative parts the cutlist uses
4. Two finished plan-analysis modules (519 + 45 lines) that nothing calls
5. Zero drag-and-drop in a spatial design tool
6. Four `glbUrl` values pointing at files that do not exist

**The strategic answer to "how do I make this the next best app":** stop trying to beat Decor8 at photo restyling. You will never win that and it does not matter. Win the four-way split that every comparison in the market identifies as unsolved — be the only tool where the render, the elevation, the cutlist and the CNC file come from one approved geometry, and make that visible on screen. The engineering for that already exists in `module-framework` and `scene-compiler`. The work ahead is connecting it, not inventing it.

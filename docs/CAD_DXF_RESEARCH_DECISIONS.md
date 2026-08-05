# CAD, DXF and manufacturing research decisions

Reviewed August 2026 against ULTIDA's scene-linked drawing and production
pipeline. These repositories informed implementation choices; ULTIDA does not
copy code into a second geometry authority.

## Adopted in the current product

| Area | References | ULTIDA decision |
| --- | --- | --- |
| CAD format boundaries | `qcad/qcad`, `mlightcad/libredwg-web`, `ieskudero/three-dxf-viewer`, `dotoritos-kim/dxf-json`, `chuyentt/dxf`, `xxxgggyyy/dxfReader` | Keep server DXF export authoritative, millimetres-first, layered, and independently validated. Add browser previews only from the generated artifact, never from a re-created client geometry. |
| Vector/CAD conversion | `orcastor/cad2x-converter`, `Lampkeeper/CAD2SVG`, `mjecke/pyPDFtoDXF`, `aspose-free-consulting/convert-dwg-to-dxf`, `AKaratayev/AutoCADConverter`, `ycxGHub/librarycad` | Treat conversion as an explicit import/export boundary. Do not promise DWG conversion until a verified converter is hosted and tested against real files. |
| 2D editor interaction | `CCWI/building-plan-viewer`, `prolincur/Vectra2D`, `JamesHodgkins/OpenDraft`, `dubstar-04/Design-Core`, `uberCad/uberCad`, `ntd/adg` | Preserve snap, pan/zoom, layer visibility, selection and editable entities in the existing review canvas. These controls operate on drafts, not approved scene facts. |
| CNC and nesting | `kenzap/nesting-app`, `WillAdams/gcodepreview`, `GSStnb/dxfBlocks`, `FreeCAD-Cookie-Cutter` | Keep nesting/cutlist as production preflight outputs. Validate bounds, part dimensions, kerf, grain, edge schedule and duplicate IDs before a file is downloadable. G-code remains a future machine-specific adapter. |
| Image-to-CAD research | `adityaintwala/Image2CAD`, `jeremylongshore/cad-ai-agent`, `ishan-parihar/AI-CAD`, `Vartmor/CADLift` | AI output remains a proposal with source hash, model/version, confidence and review state. It cannot bypass plan calibration or scene approval. |
| 3D / walkthrough | `tentone/dt3d-ha`, `fougue/mayo`, `thingraph/dwg-viewer-example`, `orion4d/ComfyUI_DAO_master`, `alekssadowski95/FreeCAD-Cookie-Cutter` | Use as interoperability and viewing references. The approved `scene.v1` remains the input to renders, elevations, SketchUp and production. |

## Reviewed but intentionally not imported

- `qcad/qcad` is GPLv3; `qcad/qcad` is useful as a manual validation target,
  not a library to embed in the commercial web bundle.
- `mlightcad/libredwg-web` separates its copyleft DWG parser from an MIT DXF
  core. A future DWG reader can be an isolated worker or server service; it is
  not enabled as a silent browser dependency.
- `openwisp/django-loci`, `pkozul/ha-floorplan`-style location/home
  automation projects, `mrspartak/awesome-interior-design`, and the
  AutoCAD-specific `luanshixia/AutoCADCodePack` are reference material rather
  than drop-in ULTIDA dependencies.
- Repositories with no clear license or unclear asset provenance are not
  copied, bundled or used as catalogue geometry.

## Concrete correction shipped from this audit

Wall elevation SVG generation previously included every module in the scene on
every wall. It now uses the canonical drawing projection's nearest-wall
assignment and wall-relative offset. This keeps SVG, DXF and PDF elevations
consistent and prevents unrelated furniture from appearing on a wall sheet.

## Plan-review DXF and PDF/image vectorization

The locally installed `pdf-to-cad-vectorizer` skill (based on
`Ai-LaoHuang/pdf-to-cad-vectorizer`) is retained as an interoperability aid for
native-vector PDFs and raster drawings. Its useful guardrails are now reflected
in ULTIDA: prefer native vector paths when available, keep raster conversion
separate, report scaling caveats, and never claim that visual tracing recovered
semantic CAD constraints. The skill recommends separate visual-ink,
centerline, and outline outputs; ULTIDA's plan-review export follows the same
separation by exporting calibrated editable entities with explicit review
warnings.

The new `/api/projects/:projectId/drawings/plan.dxf` endpoint and Plan screen
button generate a calibrated review DXF before a scene exists. It is marked
`PROVISIONAL INITIAL DESIGN` (or `REVIEWED FINAL PRODUCTION`) and explicitly
states that it is not a fabrication release. Production DXF remains generated
only from the approved `scene.v1`, so visual vectorization cannot bypass
calibration, entity review, or scene approval.

## Release rules for future CAD integrations

1. Source must be an approved `scene.v1` with a stable scene version.
2. Every output records source scene/version, units, geometry mode and warnings.
3. Duplicate/coincident walls are removed by the canonical projection before
   DXF, SVG, PDF or SketchUp generation.
4. Generated DXF must reopen in an independent validator and preserve layers,
   dimensions and module boundaries.
5. No AI or conversion service may silently change walls, openings, module
   extents, camera, or material assignments.

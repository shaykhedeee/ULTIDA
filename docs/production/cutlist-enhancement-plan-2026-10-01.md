# Cutlist builder: simple entry, explicit construction

## Implemented in the local candidate

The standalone Cutlist Studio starts without fabricated sample panels. Enter a unit name, overall W/H/D in millimetres, open or two-door inset fronts, shelf count, and 6/18 mm back. Add multiple units without replacing previous work. Each unit has stable scoped panel IDs and a material specification captured when added. Reference photos are style-only. 2D/3D envelope schematics show the current dimensions; they are not photorealistic digital twins or complete machining drawings.

The new recipe is deliberately narrow: butt joints, full-height sides, decks between sides, inset swing fronts and a surface-mounted full back. Overall depth includes the back; deeper backs reduce usable depth. It does not silently add fillers, plinths, drawers or hardware. Draft construction, laminate allowances and joinery need confirmation before manufacture.

DXF intake reviews closed axis-aligned four-vertex LWPOLYLINE outlines only, with explicit millimetre units. Select a real unit elevation rectangle, verify orientation and enter missing depth and internals. Text, dimension entities, arbitrary lines, blocks, curves and nested symbols are not parsed into panel anatomy. DWG requires conversion/export to DXF; there is no native DWG reader.

## Next structural work

1. Store a versioned UnitSpecification with per-unit material IDs, board thickness, finished-versus-core dimension convention, joinery, back mounting, laminate face schedule, edging and internal bay layout. Extend the shared module compiler rather than grow a second manufacturing authority in the browser. The new standalone recipe remains a draft until it is certified through that path.
2. Provide a small guided form per family: wardrobe hanging/drawers/shelves; kitchen appliance/service zones; TV/crockery shelves and drawers. 1050 mm hanging and 200 mm drawer fronts are editable proposals, not universal manufacturing rules. Reject internal arrangements that do not reconcile.
3. Generate 2D internals, component 3D and cutlist from the same compiled parts. Match reference/style choices to explicit shutter/handle/material choices; images never redefine geometry. Add editing, duplication, per-unit quantities and project persistence without losing earlier units.
4. Upgrade CAD review: unit selector, source layer/entity IDs, unit confirmation, dimension attachment and an ambiguity list. Add DWG conversion only through a supported licensed tool/runtime. Do not infer board thickness or concealed joinery from external elevations.
5. Model laminate per face: internal liner, external decorative finish, balancing face and unlaminated faces. Group plywood by substrate/thickness, laminate by supplier decor/thickness/grain/batch, and edging by code/thickness. Apply explicit trimming and face allowances. Current area-based laminate sheet figures are lower-bound estimates, not optimized face cutting plans.
6. Nest board blanks and laminate faces separately using shared geometry, grain constraints, saw kerf, sheet trim and candidate stock sizes. Report oversized/unplaced parts, remnants and actual yield. Never promise a universal waste percentage. Calculate prices only with confirmed units/rates in INR.
7. Generate a real XLSX workbook with unit register, panels, face laminate schedule, edging, hardware, machining, sheet layouts and totals. Stable IDs must match labels and CNC exports. Standalone CSV is not a replacement for the project production workbook. Review the supplied reference spreadsheets before finalizing columns/print sheets.
8. Require construction/material confirmation and scene certification for production release. Distinguish downloadable draft schedules from factory-ready outputs. Edits must invalidate prior quantities/approval; plans and references alone cannot certify them.

## Acceptance

Test a 914.4 × 2133.6 mm wardrobe with separately confirmed depth; compare 6/18 mm back deductions. Add a second unit with a different finish; verify no ID collision or material mutation. Confirm empty/invalid inputs block generation. Import one mm DXF rectangle and reject unknown units. Compare panels, previews, workbook, labels and nesting from the same final specification. Then save/reload the project and verify matching revision.

## Verified continuation
- Fixed nesting stopping after a full sheet: remaining panels retry on fresh stock.
- Standalone XLSX includes units, physical panels, finish estimates, nesting, edging/labels and actual stock counts. It is explicitly a draft, not an approved production release.
- Removed hardcoded 9mm procurement backing; mixed 6/18mm stock remains separate.
- Local account-scoped draft recovery preserves panels and nesting settings. Initialization blocks adding/importing panels until restoration completes.
- Conditional scene approval cannot overwrite a scene already made stale.
- Focused regression run: 10 tests passed, 0 failed. Full launch remains unverified: hosted authenticated AI generation, PDF rasterization capability, finished laminate allowances and hardware/joinery certification require evidence.

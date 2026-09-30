# ULTIDA cutlist workbook contract

ULTIDA supports two Excel exports with different authority. Both use stable
physical panel labels and explicit units, but a hand-entered size schedule is
not promoted to an approved production release.

## Approved scene workbook

`generateProductionWorkbookXlsx()` accepts only a `production.snapshot.v1`
derived from the persisted approved or locked scene. Scene component dimensions,
materials, grain, edge schedules, labels, stock rules, and nesting placements
come from that snapshot and its deterministic nesting pass.

| Sheet | Factory use | Authority and key fields |
| --- | --- | --- |
| Release summary | Identify the release being cut | Project, scene revision/status, rules, stock size, kerf, trim, provenance, sheet count, utilization and waste |
| Panel cutlist | Cut instruction | Stable component/label ID, room/module/family, L × W × T, substrate, grain, four edge lengths, tape, rotation policy, CNC-operation availability and nesting placement |
| Panel labels | Identify each physical part | Barcode payload equals the unique component ID |
| Materials | Substrate purchase check | Material, thickness, panel count and net area |
| Board requirements | Board order by actual nesting sheet | Material, thickness, stock format, sheet ID, placed parts, utilization, waste and scene revision |
| Laminate requirements | Finish-order status | Explicitly states when face finishes and supplier stock data are absent; never treats substrate as laminate or guesses inventory |
| Edgebanding | Edge-machine schedule | Tape type, thickness and total linear metres |
| Hardware | Purchasing and assembly | Item, category, quantity and unit |
| Nesting | Sheet-level saw verification | Sheet, stock, used area, utilization, part count and scene revision |
| Nesting layout | Panel placement verification | Per-panel sheet, stable ID, X/Y, cut dimensions, rotation and grain |
| Audit | Release decision | Scene, physical IDs, nesting reconciliation, warnings and measurement authority |

The approved-scene workbook reports the source revision on every board and
placement record. Laminate quantity is intentionally reported as unavailable
until face A/B finish assignments and supplier sheet sizes are present in the
authoritative production data model.

## Size-entry cabinet workbook

`generateDrawingCutlistWorkbookXlsx()` accepts explicit cabinet dimensions,
back-board selection, face finish codes, bay schedule, materials, and hardware.
The authenticated size-entry endpoint returns a review-required workbook. It
is a design and estimating handoff and is always stamped **NOT FOR
CONSTRUCTION** until site dimensions, construction details, and manufacturing
decisions are checked and approved through the scene workflow.

Its tabs are `Job summary`, `Internal layout`, `Cutting list`, `Board
requirements`, `Laminate requirements`, `Edgebanding`, `Hardware`, `Nesting`,
`Panel labels`, and `Audit`. The cutlist separates substrate from face A/B
finishes and records each L1/L2/W1/W2 edge length independently. It supports
explicit 6mm captured-groove and 18mm overlay-structural back-panel options;
the selected thickness and material remain visible in the workbook.

The current draft generator uses 2440 × 1220mm stock, 4mm kerf, and 10mm trim
only as labelled estimates. The nesting positions are deterministic for those
assumptions, but supplier sheet sizes and machine kerf must be confirmed before
ordering or cutting. Laminate rows show net face area; sheet counts remain TBC
until supplier sheet dimensions and finish-specific grain/match rules are
provided. No balance or inventory values are copied from reference workbooks.
Machining fields are present for shop handoff but explicitly read “not
provided”; drilling, hinge-cup, groove, and connector coordinates are not
fabricated from a cabinet outline.

## Accuracy rules

1. Each exported label represents one physical panel instance; quantities are
   expanded before labels and nesting are generated.
2. Length, width, and thickness come from compiled scene parts or the explicit
   size-entry construction calculation, never from a render or moodboard.
3. The 6mm captured back and 18mm overlay structural back are distinct build
   methods and produce different carcass depths. Other thickness/mount pairs
   require a separately engineered detail.
4. Edge lengths are independent values (`L1`, `L2`, `W1`, `W2`); a generic
   edging name is not treated as an edge schedule.
5. Grain direction prevents prohibited stock rotation. Nesting, board counts,
   labels, and placement coordinates share one nesting result.
6. Substrate and decorative laminate are separate takeoffs. Stock area,
   inventory, waste, and purchase quantities are not guessed when source data
   is absent.
7. Accepted geometry, material, or composition edits invalidate outputs from
   earlier scene revisions.

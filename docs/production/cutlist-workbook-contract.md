# Cutlist workbook contract

The ULTIDA production workbook is an `.xlsx` file generated only from an
approved or locked scene's `production.snapshot.v1`. It never derives panels
from a module bounding box, a render, a moodboard image, or an example list.

## Workbook sheets

| Sheet | Factory use | Authoritative fields |
| --- | --- | --- |
| Release summary | Establish the exact release being cut | Project ID, scene revision, rules version, stock size, kerf, trim, provenance |
| Panel cutlist | CNC/beam-saw cut instruction | Stable label ID, source component, room/module/family, finished L x W x T, material, grain, four edge lengths, tape, status and nesting placement |
| Panel labels | Print/apply labels | Stable barcode payload equal to the physical panel instance ID |
| Materials | Purchase and stock check | Material, thickness, physical panel count and net area |
| Edgebanding | Edge-machine schedule | Tape specification, thickness and total metres |
| Hardware | Purchasing and assembly | Item, category, quantity and unit |
| Nesting | Saw/CNC verification | Stock sheet, material, thickness, usable stock, area, utilisation and component count |
| Audit | Release decision | Scene identity, part identity, deterministic nesting result, warnings and measurement authority |

## Accuracy rules

1. A label ID equals a single `scene.moduleParts` record; duplicated quantities
   are expanded before nesting and labelled as separate physical items.
2. Length, width and thickness come from the exact compiled part dimensions.
3. Edge lengths are independent values (`L1`, `L2`, `W1`, `W2`), so an edge
   tape total can be checked rather than assumed from a generic edging name.
4. Grain direction prevents prohibited stock rotation in the nesting engine.
5. Nesting uses the same scene parts and fabrication kerf/trim rules as the
   workbook, labels and visual nesting sheet.
6. Any changed accepted edit invalidates the old scene revision and therefore
   requires a newly generated workbook.

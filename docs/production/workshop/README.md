# ULTIDA workshop acceptance — pending physical evidence

Software tests cannot certify a saw, CNC postprocessor, material batch or assembled cabinet. No physical trial has been performed for this release.

1. Select a small approved cabinet with two different front/back recipes, a grain-sensitive shutter and a bare panel. Confirm that the generated component dimensions are the required **cut dimensions**. Edge-banding and face pressing change finished sizes; do not automatically subtract edge tape from geometry that already includes machining allowances.
2. Record project ID, saved scene UUID, manufacturing review, material batch, operator, date, saw/CNC model, measured kerf, squaring trim, stock dimensions and printer model. Use the same stock/kerf/trim as the exported pack. The default values are assumptions, not measurements.
3. Print SVG stickers at 100%, disable fit-to-page, and scan every QR with the intended shop phone/scanner. Compare its project, scene and physical part identity with the Excel workbook. Repeat on a spare label after abrasion/dust handling. A QR identifies a part; it does not authorize cutting.
4. Check that each prelaminated sheet has one ordered A/B recipe; never interchange A and B. For laminate-after-cut, match each `:faceA`/`:faceB` blank to its source panel, verify per-edge overhang and grain. Explicitly bare faces require no laminate sheet.
5. Cut a coupon and measure kerf. Cut the test cabinet. Measure every panel at both ends, squareness/diagonals, thickness, edge-band build-up, and finished outside sizes. Record agreed tolerances **before** cutting. Do not use a generic tolerance as machine certification.
6. Dry assemble. Verify overall envelope, clear openings, hinge/runner operation, services access and site fit. Per-panel drilling/grooving remains separately reviewed: nesting rectangles are not a validated CNC machine program.
7. Record consumed sheets, reusable offcuts and unusable waste separately. Do not count hypothetical reusable areas as recovered inventory or claim zero waste.
8. Fill `measurements.csv` and run `python scripts/validate_workshop_trial.py measurements.csv`. Attach signed operator findings, calibrated measurements, assembly photos and the exact exports. The script validates recorded values only; the named workshop reviewer must sign physical acceptance.

Stop on any recipe mismatch, missing panel, unreadable QR, grain error, overlap, stock mismatch or dimensional failure. Revise the source design/rules, regenerate documents, and repeat the affected tests. Never hand-correct an already issued Excel cutlist without a new scene revision.

## Trial record

- Project / saved scene / source fingerprint:
- Operator / date / machine / material batch:
- Kerf / trim / stock sizes / printer and label media:
- Agreed panel, squareness and assembly tolerances:
- Cut count / assembled modules / waste and retained-offcut inventory:
- QR scan pass count / total labels:
- Evidence filenames and hashes:
- Workshop reviewer / disposition / signature:

Status: **PENDING — no operator measurements received**.

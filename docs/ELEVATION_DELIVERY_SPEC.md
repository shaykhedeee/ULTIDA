# ULTIDA elevation delivery specification

ULTIDA must produce a signed elevation package after the room scene is approved and every wall elevation has passed validation. The package is derived from the approved scene version, never from a rendered image.

## Required package contents

1. Cover and revision block: project, room, wall ID, scene version, author, date, scale, units, approval state and source geometry hash.
2. Wall schedule: every wall in stable order (A, B, C...), wall length, height, thickness, base elevation, openings and confidence.
3. Front elevations: chained bay dimensions, overall width and height, plinth, loft, shutters, drawers, open niches, appliances, handles, Gola/profile, lighting and material callouts.
4. Internal elevation/section: carcass thickness, back rebate, shelf tiers, System 32 drilling centres, service voids, fillers and anti-gravity offsets.
5. End section: total depth, back panel, shutter/front projection, countertop, skirting and wall anchoring.
6. Production schedules: panel cutlist, hardware, material slots, edge banding, lighting, appliance voids and unresolved site checks.
7. Render evidence: approved perspective/elevation renders linked to the same scene version, with a visible “visual reference only” label.
8. Revision and sign-off page: validation results, QA evidence, reviewer, approval timestamp and export fingerprints.

## Two views, one source of truth

The System 32 Elevation Canvas is an interactive inspection view. It is used to move modules, inspect vertical datums, configure shutters/drawers/lofts and resolve collisions.

The Technical CAD Drawing Sheet is the fabrication view. It is an orthographic, dimensioned and exportable record. It must use the same compiled module geometry, wall opening data and material assignments as the canvas. A CAD export is blocked while the scene is unapproved, dimensions are uncertain, or a collision/opening conflict exists.

## Kitchen acceptance rules

For kitchen walls, the generated sheet must preserve measured bay widths (including 34/30 mm edge clearances when present), base/loft/shutter heights, countertop and plinth heights, appliance void dimensions, Gola/profile locations, strip-light zones, and side-section depth. Every inferred value is marked as inferred until confirmed.

## Export contract

The UI offers SVG for review, DXF for CAD exchange, and a PDF production pack. All files carry the same `sceneVersionId`, wall IDs, revision number and geometry fingerprint. Re-exporting unchanged data produces the same geometry and fingerprint.


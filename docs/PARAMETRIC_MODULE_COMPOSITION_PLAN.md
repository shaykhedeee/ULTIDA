# Parametric module composition plan

ULTIDA modules are starting templates, not fixed-size products. A designer may widen or narrow a composition, add or remove shutters, drawers, shelves, lofts, fillers, lighting bays and appliance voids. The saved composition remains valid only when its resulting geometry fits the measured wall and preserves all required clearances.

## Behaviour

- Keep catalog dimensions as defaults and manufacturing starting points.
- Store the user dimensions and configuration separately from the catalog template version.
- Derive shutter count from usable width only as a suggestion; allow an explicit override when bay widths remain valid.
- Recompute bay widths, fillers, reveals, drawer fronts, shelf spans, hardware quantities and material coverage after every edit.
- Validate the complete composition before saving: wall bounds, openings, end fillers, minimum circulation, appliance/service clearances, structural limits and family-specific rules.
- Reject the edit atomically when any rule fails; retain the last valid saved revision.
- Mark compiled scenes, elevations, renders, BOMs, cutlists and quotes stale after a valid edit.
- Compile a new scene revision only after the edited composition passes validation.

## Wall-fit model

`usableWall = measuredWallLength - leftClearance - rightClearance - openingKeepOuts`

`compositionWidth = sum(bays) + fillers + reveals`

The placement is valid when `compositionWidth <= usableWall` and every bay rectangle is clear of door/window keep-out rectangles. Offsets are clamped to the measured wall; automatic centering is offered as a convenience, never as an unverified measurement.

## Acceptance tests

1. Widen a TV wall and add shutters; the bay schedule, elevations and cutlist update together.
2. Add a loft and 50 mm ceiling closure; the elevation shows the new datum and the scene compiler preserves it.
3. Move a composition across a door opening; save is rejected with the exact conflicting range.
4. Add two modules to one wall; overlap is rejected before persistence.
5. Refresh after a valid edit; the same module configuration and scene-stale state return.
6. Compile after approval; every export cites the new scene revision and geometry fingerprint.

## Product flow simplification

Use one contextual inspector with three groups: **Size**, **Composition**, and **Finish**. Show a single fit indicator with expandable reasons. Keep advanced manufacturing fields collapsed until the designer asks for them. Place “Apply changes” and “Revert” together, then show one saved-state message that names the affected outputs.


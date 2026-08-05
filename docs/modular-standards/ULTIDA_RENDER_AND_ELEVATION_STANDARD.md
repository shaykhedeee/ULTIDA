# Ultida Render and Elevation Standard v1

## Authority

Approved `plan.v1`, layout, module instances, material assignments, and compiled `scene.v1` are the only geometry authority. A reference image or AI render is visual evidence and inspiration; it never supplies dimensions or silently changes the design.

## Drawing defaults

- Units are millimetres.
- Standard panel thickness is 18 mm.
- Wardrobe carcass depth is 560 mm plus a 20 mm back, giving 580 mm total unless the approved design overrides it.
- Granite/quartz default thickness is 20 mm.
- A 30 mm dummy/reveal is explicit geometry, not an inferred gap.
- Every view carries an overall dimension and segment dimension chains.
- Elevations use external and internal views where storage or hardware is relevant; top/section views are added for depth, corners, appliances, granite, or services.

## Elevation conventions

External views show wall limits, fillers, lofts, shutters, handles, glass/profile frames, grooves, skirting, lighting anchors, and openings. Internal views show carcass divisions, shelves, hanger spaces, drawers, adjustable shelves (`AS`), equal shelves (`EQ`), appliances, service clearances, and hardware positions.

Dimensions must be derived from the scene parts and wall-local coordinates. Dimension totals must equal their segment sum. Invalid or missing dimensions block release instead of being rounded into a plausible drawing.

For wardrobes, the external view distinguishes lofts, sliding/swing shutters, open units, mirrors, profile-glass bays, handles, fillers, skirting, and storage-only zones. The internal view distinguishes hanger spaces, adjustable/equal shelves (`AS`/`EQ`), drawer stacks, fixed shelves, shoe storage, and blind-corner or inaccessible areas. External and internal widths must reconcile to the same approved carcass boundaries.

A wardrobe elevation is not complete unless it identifies the source scene version, overall width/height, horizontal and vertical chains, shutter operation, internal storage elements, and material slots. Profile-glass elements must name their frame/glass material and light anchor; a generic rectangle is insufficient.

## Modular rules

- Keep shutter divisions and cabinet proportions unchanged during rendering.
- Sliding and swing shutters are distinct operations with their own clearances and hardware schedules.
- Aluminium profile glass shutters include the frame, glass specification, shelf count, and light anchors.
- Kitchen drawings include base/wall/tall/corner units, 20 mm countertop, backsplash/dado, sink/hob/appliance positions, fillers, and skirting.
- Pooja drawings include skirting shutters, two drawers, one pull-out pooja tray, main fluted-glass shutters, bells, lighting, and any reviewed jaali/CNC panel.
- Study drawings can use a marker-safe whiteboard laminate back panel and omit drawers when the approved brief requests it.

## Render standard

Use the compiled perspective scene as the base image. Preferred presentation is premium Indian residential architecture: straight verticals, eye-level wide architectural camera, warm 3000 K lighting, realistic laminate/wood/granite/glass, soft contact shadows, restrained reflections, and no invented furniture or LEDs. Render revisions must name the operation and preserve locked geometry, openings, shutter counts, ceiling gaps, material zones, and camera unless the approved revision explicitly changes them.

## Release gate

The app must report source scene version, provider/model, reference hashes, drawing standard, and warnings. Technical preview, SVG, or an AI image must not be labelled as a production-approved photoreal render or manufacturing drawing.

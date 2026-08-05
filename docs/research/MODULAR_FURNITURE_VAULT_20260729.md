# Ultida Modular Furniture Vault v1

## Purpose

This vault turns interior-design references into reusable, manufacturing-aware knowledge for Ultida. It is not a source of measurements. Approved millimetre geometry remains authoritative in `plan.v1`, layout versions, `scene.v1`, and production contracts.

## Knowledge layers

### 1. Design facts

- Room function, user priorities, circulation, openings, services, and existing objects.
- Style direction, material intent, lighting intent, and reference imagery.
- Required furniture family and the requested composition: linear, L, U, parallel, floating, full-wall, walk-in, partition, or mixed.

### 2. Modular construction vocabulary

- Carcass: structural panel enclosure, normally panel-based and part of the assembly/cutlist.
- Shutter: hinged, sliding, profile-glass, fluted-glass, or decorative front.
- Drawer: drawer box/front and hardware schedule; quantity and stacking are explicit.
- Shelf: fixed, adjustable, glass, or illuminated shelf.
- Loft: upper storage, separate from the main cabinet body; it may touch the ceiling only when the approved design says so.
- Dummy/filler: a deliberate closure or clearance element. It is never invented by a render model.
- Back panel: TV, study whiteboard, decorative, service, or illuminated panel.
- Countertop: granite/stone/quartz element with explicit thickness and cutouts.
- Profile glass: aluminium frame, glass type, shutter, shelf, and light anchors are separate production facts.
- Plinth/skirting: lower closure and height, kept separate from cabinet body dimensions.
- Service void: plumbing, power, appliance, ventilation, and access zone that blocks fabrication release until verified.
- CNC panel: reviewed vector geometry attached to a part; raster AI output is ideation only.

### 3. Production facts

Every module can expose semantic elements with a production role: visual, assembly, cutlist, service, or accessory. A module also exposes placement constraints such as wall anchoring, opening clearance, service clearance, circulation, adjacency, and stacking.

## Family coverage

The catalog currently covers kitchen base/wall/tall/corner, wardrobes, TV units, crockery, study, pooja, utility, beds, dining, sofas, storage, and false-ceiling lighting. The API exposes the complete versioned vault through `/api/catalog/vault`.

Core templates include:

- TV wall: floating base, back panel, display/profile-glass bay, cable management, controlled lighting.
- Wardrobe: equal shutters, loft, hanger zone, drawers, shelves, filler/dummy, sliding hardware.
- Kitchen: base, wall, tall, corner, sink/service, countertop, backsplash, appliance void, task lighting.
- Study: desk, overhead storage, open shelves, marker-safe back panel, optional drawer-free configuration.
- Crockery: display carcass, glass shutters, shelves, profile lighting.
- Pooja: two drawers, single tray, main shutters, fluted glass, bells, concealed light, CNC jaali panel.
- Utility: storage, service voids, appliance openings, washable/material-aware fronts.

## Research adoption rules

The supplied interior-design resource collection is useful for design principles, ergonomics, proportion, material research, CAD/BIM workflows, and professional practice. Its links are references, not runtime dependencies. External models, images, and code are adopted only after license, provenance, hosting, and geometry-safety review.

The FlairGPT research pattern is adopted conceptually: parse brief facts, define zones, build a prioritized object list, express constraints as a graph, optimize layout deterministically, then retrieve visual references. Ultida’s implementation keeps all final dimensions and approvals outside the model.

Semantic modular-furniture segmentation research is useful for recognizing shutters, drawers, and shelves from RGB-D or 3D input. It does not replace approved CAD geometry, and its model/data license must be reviewed before any production use.

## AI prompt context

AI tools should receive:

1. approved room facts and stable wall/opening/service IDs;
2. the selected module family and variant;
3. the module element list and constraints;
4. material assignments by semantic slot or exact part ID;
5. the current version lineage and stale state;
6. a request to return a proposal, never an authoritative measurement.

AI must not add shutters, drawers, lights, lofts, fillers, appliances, or decorative objects that are absent from the approved design. A proposal becomes geometry only after deterministic validation and designer confirmation.

## Next vault increments

- Add vendor/material records with board sizes, thickness, edging, hardware, cost, and availability.
- Add parametric variant schemas for shutter count, drawer stack, loft height, profile type, handle, grain direction, and service allowances.
- Add golden fixtures for TV, wardrobe, kitchen, study, pooja, and utility modules.
- Add scene-to-production checks that every visible semantic element has a part or explicit non-production role.
- Add evidence-backed reference ingestion with source URL, license, attribution, and review status.

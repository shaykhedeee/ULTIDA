# Projection Contract

`approved scene.v1 -> drawing.projection.v1 -> DXF | SVG | PDF`

The projection carries project and plan provenance, millimetre units, floor lines, openings, module footprints, wall-local elevations, warnings, and scene status. Writers serialize this structure only.

Required consistency checks:

- Wall endpoints match the approved scene exactly.
- Module footprints preserve position, width, depth, height, and rotation metadata.
- Elevation module offsets are derived by vector projection onto the selected wall.
- Opening offsets, widths, heights, and wall IDs agree in every output.
- Invalid dimensions are rejected or recorded in projection warnings.
- DXF contains HEADER and ENTITIES sections, ENDSEC markers, EOF, millimetre units, and stable ULTIDA layers.
- SVG and PDF include source project/scene provenance and visible review status.

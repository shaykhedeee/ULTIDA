# Production authority decision

- `scene.v1.moduleParts` are the only automatic source of manufactured panel geometry.
- A production snapshot expands every physical part into a unique traceable instance before nesting.
- Board thickness is the smallest orthogonal component dimension; panel length and width are the remaining two dimensions. This prevents a shutter's height from becoming its board thickness.
- Identical panels remain individually traceable even when schedules later group them for display or purchasing.
- Hardware, holes, grooves, rebates and tooling require explicit component data and review.
- CAD/PDF imports create review evidence; they do not release fabrication data directly.
- CNC v1 emits SVG/DXF, cut diagrams and labels. Generic G-code is prohibited.

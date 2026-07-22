---
name: ultida-cad-qa
description: Validate ULTIDA scene-linked DXF, SVG, PDF, elevations, dimensions, cutlists, and production release gates. Use when reviewing drawing-core changes, checking an approved scene export, comparing output formats, or auditing whether a drawing package is safe to release.
---

# ULTIDA CAD QA

Validate production artifacts without introducing another geometry authority. Treat the approved `scene.v1` and its `drawing.projection.v1` derivative as canonical.

## Workflow

1. Confirm the source scene is `approved` or `locked`; reject draft, superseded, stale, malformed, or missing scene versions.
2. Build one `DrawingPackageProjection`. Do not calculate geometry independently inside a format writer.
3. Inspect projection warnings. Block release for invalid walls, dimensions, openings, or module sizes; keep advisory assumptions visible.
4. Compare DXF, SVG, and PDF outputs against the same projection.
5. Verify millimetre units, wall endpoints, opening offsets, module width/depth/height, wall-local offsets, layers, sheet provenance, and final file structure.
6. Run focused drawing tests, then workspace check, build, test, and preflight.
7. Report release status as `ready`, `review_required`, or `blocked` with exact reasons.

## Hard Rules

- Never derive measured geometry from an AI render.
- Never copy generated drawings or user project files from legacy repositories as fixtures.
- Never silently skip invalid production entities. Return a structured warning or rejection.
- Preserve CRLF-safe ASCII DXF output and explicit millimetre units.
- Keep SketchUp, CadQuery, IFC, Blender, and ComfyUI downstream of the canonical projection.
- Use AI enhancement only as a presentation reskin; it cannot alter geometry or production truth.

Read [references/projection-contract.md](references/projection-contract.md) when comparing writers or adding a new output format.

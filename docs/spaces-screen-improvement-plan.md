# Spaces screen improvement plan

## Implemented in this pass
- Replace the misleading black pseudo-preview with a responsive placed-furniture list showing width, depth and height.
- Isolate that list from the global 3D viewport CSS.
- Name the compilation action Build 3D scene, keep its result on screen, and prevent repeated clicks while saving.
- Expose Approve scene next to Open room in 3D; show failures without claiming approval succeeded.
- Keep compilation readiness checks and persisted material requirements intact.
- Constrain the catalog elevation preview to its column.

## Next acceptance gates
1. Run an authenticated room through placement, finish saving, compilation, 3D review, approval and rendering. Verify persisted version IDs at every step.
2. Invalidate the visible approval immediately on every accepted module or material edit, including edits from another screen.
3. Consolidate the outer Spaces footer with this action bar so there is one next-step action.
4. Put room and wall selection above a shared Plan / Elevation / 3D workspace; move dimensions and finishes into a selected-unit inspector.
5. Show each blocked compilation requirement beside the affected unit with a link to fix it.
6. Verify narrow-screen layout, keyboard selection, reload recovery and failed API requests.

Scene approval confirms a specific saved version. Furniture counts describe placed units; reference images and material swatches must be counted separately. AI render output remains a visualization, never the source of fabrication measurements.

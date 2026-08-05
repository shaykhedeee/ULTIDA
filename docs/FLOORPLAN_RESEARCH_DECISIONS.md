# Floor-plan research decisions

Reviewed August 2026. These projects are references for ULTIDA's analyser and
editor; none becomes a second geometry authority. The approved `plan.v1` and
`scene.v1` records remain the only sources for Spaces, 3D, drawings, estimates
and production.

## Adopt now: proven interaction and data ideas

| Reference | ULTIDA decision | Why it helps |
| --- | --- | --- |
| `Cornell-VAILab/Raster2Seq` | Keep room boundaries as labelled polygon proposals with per-edge confidence. | Modern raster-to-vector framing; ULTIDA cross-checks each proposed room edge against independent CV walls before a designer approves it. |
| `ywyue/RoomFormer` | Preserve variable-length room polygons, semantic room labels and door/window candidates in the provider contract. | Better than fixed rectangles for L-shaped and irregular rooms; still review-only. |
| `zlzeng/DeepFloorplan`, `zcemycl/TF2DeepFloorplan` | Keep wall, opening and room semantics as separate evidence classes. | Prevents a detected room label from becoming a wall measurement or a production fact. |
| `art-programmer/FloorplanTransformation` | Use a vector wall/opening/room candidate format and deterministic topology reconciliation. | Directly supports ULTIDA's no-double-wall and editable-plan goals. |
| `cvdlab/react-planner`, `oodavid/SVG-Floorplan-Editor`, `nicosandller/easy-floorplan` | Retain ULTIDA's editor approach: select, draw, move, undo/redo, rooms, walls, openings and a catalogue. | These validate the core editing vocabulary, but ULTIDA keeps persistence and production gates. |
| `ahmadjaved97/ImageAtlas` | Continue hashing, classifying and reviewing reference images before they enter the vault. | Keeps the studio reference library clean and attributable. |

## Use only as optional, isolated future adapters

| Reference | Boundary |
| --- | --- |
| `RoomFormer`, `Raster2Seq` | A self-hosted GPU sidecar may submit review proposals through ULTIDA's existing plan-analysis contract. It must never approve plans, infer site measurements, or bypass reconciliation. |
| `FloorNet`, `joyjo/to-generate-2D-floorplan-CAD-from-3D-point-clouds` | Relevant only when ULTIDA accepts RGB-D/point-cloud capture. They do not improve a scanned 2D drawing upload today. |
| `grebtsew/FloorplanToBlender3d`, `PuneetKohli/Step-Inside-2D-Floorplan-to-3D-Walkthrough`, `CodeHole7/threejs-3d-room-designer`, `Kdcius/3Dash_webapp` | Useful output/UI references only. ULTIDA exports from approved scene data rather than reconstructing production geometry in Blender/Unity/Three.js. |
| `milvus-io/milvus` | Do not add now. Supabase-backed metadata/search is sufficient for the current reference vault; reconsider only for a substantially larger multi-studio semantic corpus. |

## Deliberately not integrated

| Reference group | Reason |
| --- | --- |
| `DeepFloorplan`, `TF2DeepFloorplan`, `FloorplanToBlender3d`, `floorplan-graph` | GPL-licensed. Their ideas can inform independent work, but their code is not copied into ULTIDA. |
| `pkozul/ha-floorplan`, `ESPresense/Floorplan-Creator`, `algenty/grafana-flowcharting`, `mexchy1000/dicomclaw`, `d3-floorplan` | Different domain or not relevant to an interior-design production workflow. |
| Repositories without a clear license | No code or assets are imported until licensing is explicit. |

## Implemented from this review

- Vision room polygons are now cross-checked edge-by-edge against CV wall
  traces. Each room stores `boundaryWallIds` plus `candidate`, `partial`, or
  `unconfirmed` evidence status.
- This changes review guidance only. It does not convert any proposal into
  verified geometry, alter measurements, or relax Final Production gates.
- A low-evidence room presents one actionable boundary-review warning instead
  of pretending the room was fully detected.

## Acceptance checks for a future model sidecar

1. Input is an ULTIDA-normalized raster, not an uncontrolled browser file.
2. Output conforms to the existing 0..1000 evidence proposal contract.
3. Every output is persisted with model/version, source hash, latency and
   provider failure details.
4. CV reconciliation and designer review remain mandatory.
5. Initial Design can accept labelled assumptions; Final Production cannot.

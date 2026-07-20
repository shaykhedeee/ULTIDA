# SketchUp and DXF Interoperability

ULTIDA owns measured truth in the approved `scene.v1`. SketchUp is an optional downstream bridge for studios that need editable presentation or legacy model exchange.

## Canonical flow

`approved scene.v1 -> server drawing projection -> DXF/PDF`  
`approved scene.v1 -> optional GLB/SketchUp bridge -> external editing -> reviewed import`

The browser must never create a second production geometry model. Any imported SketchUp or GLB change is an untrusted revision until it is reconciled against the approved scene.

## Reference decisions

- Use the Yulio SketchUp glTF exporter pattern for optional GLB interchange, not as a replacement for the scene model.
- Use the daltxguy/OpenCutList lineage as a reference for panel grouping, grain direction, edging and sheet layouts. Reimplement the required output contracts inside ULTIDA after license review.
- Use SketchUp MCP or VBO-style bridges only as opt-in studio connectors. Credentials and local bridge endpoints stay server-side or in a controlled desktop connector.
- Keep DXF generation server-side, deterministic, ASCII-safe and layer-based.

## Current endpoint

`POST /api/drawings/dxf` accepts `projectId`, `sceneVersionId` and a scene payload, then returns an AutoCAD-readable ASCII DXF with `ULTIDA-WALLS` and `ULTIDA-MODULES` layers. This is the first canonical export fixture; production dimensions and title-block sheets will extend the same projection.

## Required release tests

1. DXF contains `SECTION`, `ENTITIES`, `ENDSEC` and `EOF`.
2. Every wall endpoint matches the approved scene in millimetres.
3. Every module rectangle uses its approved width and depth.
4. No draft or stale scene can be exported for production.
5. A round-trip comparison fixture detects any dimension drift before duplicate exporters are archived.

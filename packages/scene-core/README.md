# Scene Core

`schema/scene.v1.json` is the canonical interchange contract. TypeScript uses the exported Zod schema and inferred `SceneV1` type; Python uses `python/scene_models.py` as a validation boundary against the same field contract. Frontend and workers must import `@ultida/scene-core` instead of defining scene interfaces.

Coordinates are millimetres in a right-handed, Z-up system: X east/right, Y north/forward in plan, Z up. Plan points use `xMm/yMm`; 3D positions use `xMm/yMm/zMm`.

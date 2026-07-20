# Reference Admission Register

No external repository code enters ULTIDA without a confirmed license, secret scan, dependency review, isolated build, compatibility fixture, owner and removal strategy.

| Reference | Candidate use | Current decision |
| --- | --- | --- |
| pedra-ai/pedra-python | Server-side visual edits and staging | Adapter candidate; MIT; beta; never geometry truth |
| AIHomeDesign/aihomedesign-mcp | AURA visual-tool lifecycle | Architecture reference; credentials remain server-side |
| google/adk-python | Tool confirmation and agent evaluation | Later evaluation after deterministic tools work |
| infiniflow/ragflow | Retrieval UX and provenance | Pattern reference only; too heavy for first release |
| Floor planner repositories | Wall graph and canvas interaction | Compare in isolated fixtures before adoption |
| maxxliu/underlay | Image-underlay interaction patterns | Inspect only for viewport, transform and annotation ergonomics; do not import its model or persistence layer |
| proecheng/cad-spec-gen | Drawing/specification language | Candidate for a future ULTIDA skill after licence, dependency and DXF-fixture verification |
| Powerpuffer/Modular-Furniture-Configuration-system | Parametric catalog interaction | Domain-pattern reference; ULTIDA modules must conform to `scene.v1` and production metadata |
| tvran/blender_interior_visualizer | Render conditioning and camera references | Research only; ULTIDA visual output remains provider-backed and fully labelled |
| microsoft/maker.js | 2D parametric geometry and drawing primitives | Candidate for isolated drawing-core comparison; do not replace the canonical server projection until DXF fixtures pass |
| MrXujiang/HiCAD | CAD/editor interaction patterns | Quarantine pending licence, build and geometry-contract review; no direct runtime dependency |
| Research scene-generation repositories | Conditioning and evaluation ideas | Research only |
| Missing-license or download repositories | None | Quarantined |

The remaining supplied repositories are reviewed in batches and recorded with commit, license, activity, security and test evidence before any implementation decision.

## Current Admission Sequence

1. Finish ULTIDA's own plan-review fixture: source image, calibration, manual walls, room zones and approval gate.
2. Compare one candidate underlay/canvas implementation against that fixture without copying code.
3. Admit only isolated behaviour with a testable ULTIDA interface and a removal path.
4. Do the same for modular catalog patterns after `scene.v1` is persistent.

This keeps external projects as evidence, not dependencies that can reintroduce the legacy application's duplicate runtimes.

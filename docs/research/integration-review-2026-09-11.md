# ULTIDA reference integration review

## Evidence scope

Read all three latest supplied texts (master report, prior research report, and original link/Spaces redesign list). Their claims are proposals, not test evidence. The accompanying `repository-inventory.json` records live availability and GitHub-reported license metadata for all 51 fully specified unique repositories. The additional `awesome-nano-banana-spatial-design` name has no owner and remains unresolved. Metadata inspection is not a full source, model, dependency or asset audit.

No third-party repository source or assets were imported in this change. The current rendering fix is original ULTIDA code in the existing adapter. Installing every listed repository would introduce competing scene stores, rendering engines and providers without proving a usable journey.

## Corrections to the supplied research

- [Infurnia](https://www.infurnia.com/interior-design-software) advertises millimetre floor plans, customizable cabinets, collision avoidance, elevations, BOQ and cutlists. The claim that no competitor combines measured design and production is unsupported. These are vendor claims, not an independently tested benchmark.
- [Decor8 SDK](https://github.com/immex-tech/decor8ai-sdk) includes Python, JavaScript, Dart and ComfyUI integrations. It is not Dart-only. API access and model rights are separate from SDK source availability; examine LICENSE and API_LICENSE_NOTICE before reuse.
- [IKEA dataset](https://github.com/IvonaTau/ikea) is product/context photography with non-commercial image restrictions, not a manufacturing-certified parametric furniture library. Do not import these images into the commercial catalog without permission.
- [sd-interior-design](https://github.com/alaradirik/sd-interior-design) documents segmentation and MLSD ControlNets with an inpainting model. Its MIT code license does not grant all model-weight rights. Ordinary multiple-image references are not equivalent to ControlNet inputs; low denoise settings are not automatically supported by every hosted provider.
- A `NOASSERTION` or absent license in the inventory means unresolved terms, not permission to copy. Even recognized code licenses do not automatically cover catalog photographs or model weights.
- The prior report's temporary-directory explanation for the Windows test-runner error was not verified. The runner executes outside the restricted sandbox; do not weaken CI or omit tests to manufacture green status.

## Integration decisions and acceptance gates

| Reference group | Decision | ULTIDA destination | Proof required before adoption |
|---|---|---|---|
| sd-interior-design; ComfyUI-ArchAi3d-Qwen; RoomSense | Evaluate conditioning technique; no unreviewed custom nodes | Existing provider gateway and visual jobs | Pin workflow/model licenses and versions; upload deterministic base + real controls; complete an actual job; compare visible openings and silhouettes |
| arcada-planner; casita; threejs-sims-house-builder | Study interaction/geometry techniques; preserve ULTIDA contracts | Spaces placement controller and renderer | Zoom/pan pointer conversion, exact preview-to-save coordinates, invalid-drop rejection and refresh persistence |
| blueprint3d-babylon; SweetHome3DJS; CanvasAnvil; Desyn | Defer wholesale integration; competing engines/state and unresolved or restrictive terms | No new rendering engine | Source/license review and a bounded improvement outperforming current implementation |
| IKEA dataset; availability-checker; furniture_classifier; Indoor-Style-Image-Classification | Separate imagery/retrieval/availability from certified geometry | Moodboard or optional sourcing tools only | Image rights, provenance, supplier dimensions and verified module correspondence |
| Decor8 SDK; Open-Generative-AI; ZyoraAI | Optional provider/workflow research | Existing provider interface, not a parallel app | Explicit opt-in, supported inputs, durable outputs, failure recovery, no hidden fallback |
| openlintel; roomsmith; woodworking-skill; atelier-mcp; arch-skills; skills-for-architects | Study traceability and drawing workflows | Existing compiler/drawing/production packages | Scene-linked dimensions, stable panel IDs, reconciled quantities and artifact tests |
| paropt; craft-engine | Do not integrate for the stated furniture task | None | Paropt is a general optimizer, not a ready wall packer; craft-engine describes a game-server plugin |
| PM/admin tools; Haystack; API lists; prompt lists; remaining interior demos | Defer until a specific proven gap needs them | See per-repository inventory | Read exact source and dependencies; define a bounded acceptance test before adopting anything |

The final row is a preliminary triage, not a claim of deep source review for those projects. Each inventory entry remains explicitly pending source/asset review.

## Changes verified in this work

`packages/provider-gateway/src/index.ts` now expands ComfyUI tokens inside string values, rather than editing serialized JSON. Quoted/multiline prompts and uploaded filenames remain valid; token-like text in prompts is not recursively expanded; arrays, numeric links, booleans and null remain typed. The configured workflow is not mutated.

The regression test invokes `createProviderGateway().createVisualProposal()` through mocked upload and queue endpoints. It verifies real adapter serialization and job identifiers; it does not claim a live GPU produced an image.

The pending Spaces edit preserves the requested wall offset instead of clamping or substituting a different placement; rejects invalid positions; requires a saved module ID before reporting success. Width editing no longer rounds requested values to ten millimetres. Browser interaction and authenticated save/reload still need verification.

## Remaining release blockers

1. Authenticated project walkthrough: calibrated plan, confirmed openings, room persistence, module placement/resize, refresh, saved scene approval.
2. Hosted image generation: configured eligible provider, actual output, durable image retrieval after refresh, actionable failure state and honest image QA. Unit tests with mocked responses are insufficient.
3. Production: same approved revision across elevation, workbook, labels and nesting; reject stale exports after edits; independent fabrication component certification.
4. Browser layout: docked catalog and inspector remain reachable at supported viewport sizes; valid/invalid placements land at previewed positions under zoom and pan.
5. Analyzer benchmark: held-out plans, door/window precision and recall, dimension error, correction persistence. No tenfold improvement claim without baseline results.
6. Complete deeper source review of shortlisted repositories and commercial workflow comparisons; record pinned files and rights before any code extraction.

Keep the integration branch until these release gates pass. A passing local build is not deployment verification.

## Follow-up: compiled parts in the interactive viewer (September 12)

The five reported arena changes are already present as cherry-picked commits in the unification branch. Remote arena remains `f572b5b00921de9ed50c460b0b3b1d997fbba9a9`; the pre-edit unification head is `9a8691ff39fefe1090d8075b2eaeacb019e42d19`.

`SceneStudio` now prefers persisted `moduleParts` over family-based procedural proxies and reference GLBs. Its new mesh builder uses each part's world-space corner, exact dimensions, rotation, mounting height and material ID, matching the deterministic renderer's axis convention. Lighting anchors remain in the existing lighting pass. Legacy modules without parts retain their current preview fallback.

Design intent still needs authored template/composition parameters and material assignments. A GLB serialized from these parts would contain the same geometry; it cannot invent correctly dimensioned arches, profiles, upholstery or joinery that the compiler never emitted. Current part meshes are rectangular solids, and material appearance remains the viewer's existing approximation. This change improves structural correspondence, not photorealism or universal fabrication certification.

Verification: the complete `npm run reliability` command exited 0 before the viewer change (the API suite contains two skipped tests). Separately, module-framework tests passed 23/23 and scene-compiler tests 15/15. The new viewer geometry tests passed 4/4; web type checking exited 0. The four tests cover exact bounds, five rotations, independent materials and invalid geometry. They do not replace a hosted browser/render smoke test.

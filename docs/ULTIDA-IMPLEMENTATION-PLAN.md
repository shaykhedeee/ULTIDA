# ULTIDA Implementation Plan

## Product rule

ULTIDA remains a measured interior-design and production pipeline:

`brief -> reviewed plan -> calibrated millimetre model -> approved scene.v1 -> materials/modules -> render proposal -> drawings -> cutlist -> quote -> delivery`

AI can propose. Only an explicit confirmation creates a new immutable scene version.

## 3D Quick Changer

The 3D workspace will support entity selection and a prompt-driven change panel. Selection is scene data, not a pixel mask: each selectable room, wall, opening, module, material assignment and decor proposal must have a stable entity ID.

Flow:

1. Load only an approved scene version into the viewport.
2. Select one or more entities, showing IDs, dimensions, materials and provenance.
3. Enter a short instruction such as “remove this lamp” or “change this laminate to walnut matte”.
4. AURA validates the request and compiles a versioned `scene-change-quick-changer` prompt.
5. The provider returns a structured proposal with before/after fields, warnings and confidence.
6. Show a visual and structured diff. Unselected geometry is locked and included as negative constraints.
7. Require confirmation. Reject ambiguous, unsupported or production-invalid proposals.
8. Create a new scene version, preserve the prior version, and mark renders, drawings, cutlists and quotes stale.

AI-generated pixels never become geometry. A render preview may accompany the proposal, but the scene diff is authoritative.

## Harness requirements

- Typed request schema with project, scene version, selected entity IDs, intent and instruction.
- Prompt registry version and provider/model provenance.
- Read, propose and confirm tool modes.
- Idempotency key for each proposal and confirmation.
- Hard constraints for walls, openings, calibrated dimensions, circulation, approved materials and price records.
- Deterministic failure states: unavailable, needs_review, rejected, failed, confirmed.

## Delivery phases

1. **Viewport foundation:** approved-scene loader, stable entity picking, camera state, selection outline and property inspector.
2. **Quick Changer proposal:** API endpoint, prompt compiler, structured output validation, diff panel and provider truth states.
3. **Confirmed mutation:** immutable scene version creation, stale artifact propagation and audit record.
4. **Visual validation:** render the proposed state, compare before/after, and store only confirmed outputs.
5. **Production gates:** regenerate shared SVG/DXF/PDF, cutlist and quote only from the new approved scene.

## Current reality

The existing repository has the AURA registry, render prompt compiler, scene validation, provider gateway and approved-mutation direction. It does not yet contain a full Three.js/React Three Fiber viewport or a complete entity-picking API. The quick changer should therefore be implemented as the next vertical slice, not as an unrestricted image-editing button.

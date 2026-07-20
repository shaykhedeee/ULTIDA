# ULTIDA Continuation Playbook

This is the operating contract for completing ULTIDA without losing the product spine.

## Non-negotiable source of truth

`approved plan version -> scene.v1 -> versioned artifacts`

AI may propose geometry, layouts, materials or visual changes. A designer must review and explicitly approve them. Prompt-only images never become measured geometry, production quantities or client-approved truth.

## Execution order

1. Hosted foundation: inspect the live Supabase schema, apply migrations, verify RLS, Storage and authenticated project creation.
2. Plan intelligence: immutable uploads, preprocessing, OCR/CV proposals, confidence queue, manual corrections and approval locking.
3. Scene persistence: save reviewed plan snapshots, create scene.v1 only from approved plans, version every mutation, stale linked artifacts.
4. Modular design: catalog compatibility, room boundaries, clearances, services, appliances, Indian modular rules and material slots.
5. Visual studio: scene-linked provider jobs, references, masks, camera, prompt, seed, cost, duration, synthetic label and approval state.
6. Drawings: one projection service for floor plans, elevations, RCP, DXF and vector PDF.
7. Production: cutlist, edging, hardware, nesting, BOM, factory pack and release gates.
8. Commercial: estimate, GST quote, variations, vendor comparison, purchase orders, margin and payment status.
9. Delivery: presentation pack, client approval, installation, snagging, warranty and service.
10. AURA: typed read, preview and confirmation tools over all stages with audit history.

## Every feature must pass

- Reads the active organization and project context.
- Declares its source plan or scene version.
- Has an explicit loading, unavailable and failure state.
- Does not silently invent dimensions or provider results.
- Persists or clearly labels local draft state.
- Has a golden kitchen and living-room fixture.
- Marks downstream outputs stale after source mutation.
- Has an explicit approval boundary before release.

## Current checkpoint

The clean ULTIDA runtime has the plan review canvas, confidence-scored baseline detector contract, scene persistence wiring, modular catalog and server-side placement validation. The baseline detector is intentionally conservative and review-required; the next upgrade is actual OCR/CV extraction and proposal-to-canvas acceptance.

## Legacy admission rule

Legacy scripts are candidates, not dependencies. Reuse only after licence/security review, isolated execution, a typed adapter, golden fixture comparison and a removal path. The old repository remains read-only.

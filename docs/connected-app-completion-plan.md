# ULTIDA connected application completion and release plan

Updated 2026-09-09. This plan distinguishes verified repairs from work requiring further evidence. A successful build is not proof of a correct customer project.

## Current delivery

Integrated recovery branch changes through 127593e and main through 92c2355, preserving local material data and production safeguards. Spaces now keeps measured polygon dimensions, uses SVG coordinate transforms for pointer editing, draws windows from measured start offsets and widths, and rejects malformed opening ranges in the preview. The desktop preview sits on the right; controls remain on the left. View buttons do not stretch. Source-image registration requires calibration. Plan approval does not synthesize unseen walls or openings. Room finish suggestions cannot verify measurements.

The existing bay editor, module inspector, wall elevation and material picker from the newer branch are integrated. Their presence does not certify every furniture family. The 20 manufacturer-referenced laminate records and their swatch sources are retained.

## One project flow

Brief → reviewed plan → room requirements → adjustable modules → compiled scene → image review → approved production package → client delivery.

Each transition must load the current persisted version, show unsaved/stale state, retain the selected room, and return an actionable error on failure. Successful local UI state must never substitute for a completed server operation.

## Acceptance work by surface

| Surface | Required completion evidence |
| --- | --- |
| Dashboard and projects | One guided project action; resume the actual unfinished stage; no duplicated tools or invented metrics; loading/error/empty states and mobile navigation tested. |
| Brief | Room requirements, budget in INR, appliance models and retained items persist through refresh and feed layout constraints. |
| Plan analyzer | Independently reviewed held-out scans; normalized CV and OCR reconciliation; dimension-to-line attachment; confidence and provenance; calibrated scale; no silent insertion or invented approval. Measure wall/opening precision and recall, not attractive overlays. |
| Plan editor | Add/move/remove walls and openings correctly at multiple viewport sizes. Preserve door type, hinge/swing, sill/head and width evidence. Unknown values remain unresolved. |
| Spaces | Room selection, right-side preview, Fit room/plan, layer controls, measured dimensions and approval blockers agree. Test the thin-room screenshot case; no display-only dimension inflation. Invalid openings need a visible repair list in addition to excluded preview symbols. |
| Module inspector | Width/depth/height, bay count, independent shutters/drawers/shelves/fillers/lofts/lighting/hardware; apply/cancel and refresh recovery; every accepted edit revises scene state and invalidates outputs. |
| Library | Room-aware categories, measured wall fit and keep-outs; production certification tied to actual template version; favorites/recent/duplicate preset; swatch failures recover; image references remain separate from certified geometry. |
| Materials/flooring | Exact version and slot assignment; calibrated texture scale; grid/brick clipping and quantities share one calculation; room changes never leak into another room. |
| Scene/3D | Bay reconciliation, opening exclusion, component bounds and asset disposal; persisted camera; real per-pixel occlusion and near-plane tests; preserve component elevation. |
| AI render | Persist scene/camera/material input fingerprint; capability-gated provider selection; no unrequested paid fallback; durable recovery; image QA and manual review; no construction dimensions from pixels. Precision mask editing remains blocked until a verified adapter exists. |
| Drawings | Actual elevations/sections on every included wall with readable chains, openings, revision, units, scale and provenance. Dossier must populate real elevation sheets; scaffolded empty sections are unfinished. |
| Cutlist/nesting/workbook | Exact parts and material thickness; stock fit, grain, kerf, edging, hardware and label identity; oversized parts explicitly rejected. Never invent a split in an approved panel. Finish arbitrary stock thickness reporting beyond legacy 18/8 mm summaries. |
| CNC | Vetted vector patterns and manufacturable clearances; unsupported raster references cannot masquerade as machine-ready paths. |
| Estimates/invoices | Approved snapshot quantities, explicit missing-price state, INR, reviewed taxes and auditable totals; no default quote as real commercial output. |
| AURA | Context-bound proposals, visible tool status, explicit approval for mutations and durable result before success messaging. |
| Calendar/team/settings | Permission checks, saved operations, honest errors, no sample dates/users presented as customer records. |
| Client delivery | Immutable versioned PDF/package, scoped share/comment/approve/revoke, expiry and revocation enforced at storage access. |

## Ordered milestones

1. Certify one measured wardrobe room end to end, including refresh and stale-output rejection.
2. Apply the same family certification suite to kitchen, TV, crockery, bed, study, pooja and utility. Include min/nominal/max and invalid compositions; do not stamp certification from family names.
3. Finish analyzer evidence and room-boundary/opening repair UX, then run the same held-out data without tuning to answers.
4. Complete deterministic visibility tests and provider capability profiles; verify actual image output against opening counts, silhouette, camera and material regions.
5. Finish dossier elevations, workbook reconciliation and labels from one approved snapshot.
6. Run authenticated tenant isolation, concurrent edits, client revocation, deployment checks and rollback rehearsal.

## Publication rules

Run relevant tests, full release checks and inspect the built app. Record actual Git SHA and deployment status. Publish without force-pushing shared history. Never call the whole application complete while held-out analyzer accuracy, hosted authentication, full family certification or production delivery remain unverified.

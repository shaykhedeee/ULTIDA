# ULTIDA render and workflow delivery plan

Audit date: 2026-09-07. Baseline: `48f2415` on `codex/release-recovery-20260728`.

## Evidence and current limits

The attached dashboard proposal is a design direction, not release evidence. Its repository snapshot at `ed123af` is outdated. The recovery branch contains the original recovered commits, followed by room-catalog, placement-contract and mounted-render repairs. Baseline hosted Reliability run 26 passed. Production remains on an older deployment; authenticated production compilation and paid-provider rendering have not been verified. This document does not certify the entire application.

Confirmed repairs at baseline: room filtering survives failed and late requests; placement API exposes the validation contract consumed by the UI; raised parts and envelope fallback retain elevation in deterministic rendering. This change adds complete-input render request hashing, removes unrelated module selection from room render targeting, removes unreachable fabricated image-success code, and makes the local reference-photo limitation visible.

## Product structure

Use a single executive dashboard, Projects, Library, Team and Settings. Place specialist tools inside contextual project workspaces and a searchable tools drawer. Keep a light drawing canvas, restrained obsidian navigation and champagne accents. Use shared button variants, loading states, disabled reasons and keyboard focus indicators.

Project flow: brief → measured plan review → room layout → module and surface editing → compiled revision → approval → visualization → production package. Preserve project, room and revision in navigation. Shared Plan / Elevations / 3D views must edit the same model. An AI proposal is reviewed before it mutates that model.

The proposed Sharma demo must be synthetic and isolated from the real client's project. Repeated demo launches must reopen the demo instead of creating duplicates. Never use a public demo flag to bypass hosted tenant authorization.

## Ordered delivery and acceptance gates

| Order | Work | Acceptance evidence |
| --- | --- | --- |
| 1 | Authenticated golden room: 4000 × 3000 × 2700 mm, reviewed door/window, base and raised wall cabinet | Save, refresh, compile, inspect elevation and camera, approve and retrieve the same scene ID |
| 2 | Render admission and provider capability audit | Unsupported masks/reference inputs rejected or clearly disclosed; unconfigured provider gives actionable error; no fabricated success |
| 3 | Durable render request lifecycle | Exact scene/room/style/material/camera inputs identify retries; refresh resumes queued job; failure and cancellation release busy state |
| 4 | Versioned editing across shutters, drawers, shelves, loft, filler, hardware and lighting | Validation precedes save; concurrent stale edits rejected; outputs marked stale; successful edits compile once into a new revision |
| 5 | Unified room inspector and dashboard | Every action has a real route or handler; filters work; loading/error/empty states differ; mobile and keyboard journeys pass |
| 6 | Library capability certification | Every selectable preset compiles exact expected components; unsupported shapes and hardware are disclosed; elevations and quantities agree |
| 7 | Asset digital twins | Immutable asset/material versions, licensed GLB/PBR provenance, units/axes/pivot checks and deterministic missing-asset fallback |
| 8 | Three.js lifecycle | Camera survives refresh; obsolete loaders cannot replace current room; textures, geometries, controls and render targets are disposed |
| 9 | Drawing and production lineage | Window sill and cabinet mounting heights match scene; DXF independently opens; BOM/cutlist/nesting/quote all cite scene revision |
| 10 | Render QA and delivery | Camera-aligned object counts, silhouettes and opening preservation measured; human approval audited; rejected imagery cannot authorize production |
| 11 | Apartment and release gate | Multiroom refresh, approval, exports and two-tenant isolation verified against exact deployment commit |

Do not enable automatic expensive retries. Provider configuration alone does not establish remaining free quota. Run live canaries only with verified permitted allocation. A real 3D scene and a photorealistic AI image are separate deliverables and need separate checks.

## Library expansion specification

The catalog already lists fluted, acoustic-slat, profile-glass, arch, French-beading, asymmetric and full-wall TV units, plus full-wall, sideboard, arch, fluted and window-seat crockery compositions. Adding duplicate names will not improve their construction fidelity. Audit each preset against emitted geometry first.

Next families: compact floor-standing sideboard; two-door glazed display; coffee counter with appliance ventilation; closed crockery base plus independent wall display; shallow media console; media console with study return; modular library/media wall. Separate composite walls into independently dimensioned cabinets and decorative panels. Do not infer an arch, glass profile, drawer runner or window clearance from a marketing description.

Each catalog entry needs: stable ID and version; room compatibility; searchable family/style/function tags; allowed dimensions; material slots; mounting range; opening/circulation rules; exact component generator; hardware schedule; preview; and production capability status. Golden cases must compare component counts, dimensions, mounting heights, material coverage and quantity outputs. CNC curves, sliding mechanisms, electrical layouts and stone fabrication require their own capability validation before manufacture-ready status.

## AI interaction and AI Elements

AI Elements supplies interface components, not a scene compiler or render provider. The existing custom React interface must first be checked for compatibility with its shadcn/Tailwind dependencies. Introduce only the components needed for an actual assistant workflow: conversation, response, tool status and proposal approval. Keep renderer state in durable server jobs. Never let chat text imply a tool succeeded before its persisted result exists.

Reference: [AI Elements components](https://elements.ai-sdk.dev/components/attachments). Current registry APIs must be read before integrating components; no new component dependency has been installed in this repair.

## Competitor-informed decisions

[Coohom](https://www.coohom.com/interior-designer/) presents planning, furnishing and rendering as one flow. Adopt continuity between those tasks and a searchable placement library. [Homestyler AI Studio](https://www.homestyler.com/en/ai-studio) groups planning, staging, modeling, texturing and rendering tools. Adopt contextual discoverability while keeping ULTIDA's core room workflow short. These observations are from public product pages, not authenticated competitor testing or proof of their output accuracy.

ULTIDA's proposed differentiator is traceable manufacturing output from a reviewed modular design. Evaluate improvements by time to first valid room, successful compilation rate, render completion rate, stale-output detection and production reconciliation errors—not number of AI buttons.

## Release checklist

1. Run focused regressions for each change, web type checking and production build.
2. Run repository reliability, API, AURA, rendering and real-browser room suites before candidate release.
3. Publish release branch and verify the preview's exact commit and build status.
4. Authenticate on preview and perform the golden room journey; record scene and job IDs without secrets.
5. Verify provider quota and run an authorized live canary; download the stored output and inspect provenance.
6. Complete tenant isolation and private storage checks. Confirm environment guards from source and target configuration.
7. Obtain approval for the previously blocked broad PR #2 main merge before production promotion. Automatic approval review rejected that specific 519-file recovery merge; do not bypass it through an equivalent direct deployment.

Remaining work stays open until the corresponding evidence is recorded. The dashboard redesign, full library certification and full hosted render journey are not implemented by this document.

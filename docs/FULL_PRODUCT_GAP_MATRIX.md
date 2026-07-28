# Ultida Product Gap Matrix

Updated: 2026-07-28

This document is the working inventory for the complete Ultida workflow. A
feature is only `verified` when its persisted server contract, failure state,
and local tests are present. UI presence alone is `partial`.

## Current Workflow

| Stage | Current state | Main gap |
| --- | --- | --- |
| Brief | partial | Server persistence exists, but completion and workflow display still have local-state coupling. |
| Floor Plan | partial/verified locally | Durable upload, AI job, CV reconciliation, draft review, and approval exist; hosted provider and browser proof are missing. |
| Spaces | partial | Approved rooms load from canonical geometry; room requirements and readiness need complete screen-level persistence and E2E coverage. |
| Layouts | partial/connected | Candidate generation now reads the active approved room polygon, walls, openings, and services through the API; multi-room selection and full interactive editing remain. |
| Modules | partial/verified locally | Catalog, anchors, and deterministic cabinet parts exist; editing, collisions, and all module families need complete UI wiring. |
| Materials | partial | Library and assignments persist; legacy moodboard arrays still influence visual prompts. |
| Scene | verified locally | `scene.v1` rejects missing plans and contains exact cabinet parts; browser visual validation and complete lineage gates remain. |
| Visualize | partial | Perspective deterministic base exists; legacy visual-proposal route remains and image-based QA is not authoritative. |
| Production | partial | Exports exist, but cutlist/CNC must derive only from authoritative scene parts rather than compatibility payloads. |
| Commercial | partial | Estimate/quote screens exist; production-pack lineage and full cost breakdown need completion. |
| Delivery | partial | Delivery artifacts exist; approval package and revision provenance need final integration. |

## P0: Make The First Connected Flow Honest

1. Keep only the durable plan path in production UI: initiate, signed upload,
   complete, durable job, review draft, approve `plan.v1`.
2. Load workflow status from the server and remove authoritative-looking local
   booleans from gating decisions.
3. Replace layout generation's local placeholder IDs and empty geometry with
   approved room, wall, opening, service, and requirement inputs. The first
   server-backed candidate path is now implemented; remaining work is room
   selection, richer requirement inputs, and persisted candidate editing.
4. Make scene compilation require approved brief/plan/space/layout/module and
   material lineage where the selected workflow requires them.
5. Add a local integration fixture that exercises Brief -> Plan -> Spaces ->
   Layout -> Module -> Scene without external AI, while keeping production AI
   failures explicit.

## P1: AI And Visual Truthfulness

1. Configure a real server-side vision provider in staging and record `ai_runs`.
2. Add provider contract tests for malformed output, timeout, rate limit, and
   missing credentials.
3. Route Visualize through the compiled scene render job, then retire the
   legacy `/visual-proposals` caller.
4. Keep technical preview, accurate render, and enhanced render distinct.
5. Add image evidence adapters for openings, module bounds, cabinet divisions,
   camera similarity, and invented/missing objects.

## P1: Libraries And Design Tools

1. Replace moodboard theme/laminate/hardware arrays with organization library
   queries and persisted material assignments.
2. Add catalogue search, filters, favourites, recently used, and place-in-scene
   actions using versioned templates.
3. Add module edit controls for wall offset, width, depth, height, rotation,
   fillers, lofts, shutter count, profiles, hardware, and lighting.
4. Return preview impacts before applying a material or geometry revision.

## P1: Production

1. Compile `ProductionPartV1` only from approved `scene.v1.moduleParts`.
2. Add part, edge, hardware, operation, nesting, CNC cutout, export, and
   release tabs with shared production primitives.
3. Add SVG/DXF CNC cutout preflight without enabling machine-specific G-code
   until a verified postprocessor exists.
4. Ensure drawing, cutlist, BOM, quote, and delivery outputs all reference the
   same approved scene version.

## P2: Hosted Release

1. Apply additive migrations to staging, not the connected production project.
2. Configure Vercel server variables and Cloudflare worker dispatch secrets.
3. Run signed-upload, durable-worker, real-provider, and browser smoke tests.
4. Promote the exact verified commit only after preview build and smoke gates.

## Explicit Non-Goals

- Do not introduce FastAPI while the Express API owns the current domain.
- Do not use generated images as geometry authority.
- Do not fabricate dimensions, rooms, providers, or successful jobs.
- Do not run production migrations or deploy secrets from local files.

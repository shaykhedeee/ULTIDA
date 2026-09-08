# Standalone-first completion matrix

Updated: 2026-08-14. This file records implementation evidence, not product aspiration.

## Completion definition

`Implemented` means the code path and contract exist and local automated checks pass. `Live verified` additionally requires an authenticated hosted journey against the exact Vercel/Cloudflare/Supabase deployment. A configured provider is not counted as a successful generation canary.

## Roadmap status

| Area | Status | Evidence | Remaining gate |
| --- | --- | --- | --- |
| Durable plan jobs | Implemented and hosted-ready | Job-specific atomic claims, lease/deadline columns, heartbeat updates, bounded attempts, expired/unleased recovery, queue consumer and DLQ configuration | Run one authenticated upload through the exact Preview worker and prove terminal state |
| Guided Plan Tracer | Implemented | Immediate stored asset, two-point calibration, analysis guides, room/wall/opening review, undo/redo, accept/reject and Review DXF | Golden-plan browser matrix and three real reviewed plans |
| CV/OCR enrichment | Implemented | OpenCV wall tracer, OCR worker, provider schema validation, coordinate reconciliation and provenance tests | Live PNG, photo and multipage-PDF canaries |
| Room Builder | Implemented | Local measured draft, doors/windows, finishes, camera intent, deterministic shell and project-selection handoff | Persist the attached draft as a first-class standalone draft record rather than only a guided Spaces handoff |
| Spaces | Implemented | Versioned geometry commit, requirements, readiness, room approval, openings and Layout Studio gate | Authenticated refresh/resume and mobile interaction coverage |
| Layout Studio | Implemented | Deterministic strategies, real-space inputs, constraints, validation and approval route | Authenticated adjustment/approval canary against representative rooms |
| Module Planner | Implemented | Parametric catalogue, configurable dimensions, deterministic previews, manufacturing rules and project-selection handoff | Complete professional placement controls for every family and test collision/opening/service cases in browser |
| Materials | Implemented | Component-targeted assignments, laminate/core/edge specifications, revisions and scene compilation | Authenticated before/after assignment and stale-scene recovery test |
| scene.v1 | Implemented | Approved-plan lineage, exact module parts, materials, deterministic artifacts and approval gate | One full hosted compile/approve journey |
| Render Studio | Implemented, live canary pending | Cloudflare FLUX.2 Klein 4B drafts, 9B finals, stable fingerprints, scene artifacts, component masks and provider provenance | Authenticated 4B render on the exact Preview deployment |
| Laminate revision | Implemented, live canary pending | Exact module/component/material request, deterministic mask requirement, scene/input hashes and review state | Generate, compare, approve and reject one hosted component revision |
| Drawing/production | Implemented | Scene-linked SVG/PDF/DXF/SketchUp Ruby/BOM/cutlist exports, exact parts, labels, nesting and production review persistence | Reopen every hosted download and test revision comparison UI |
| CNC Pattern Studio | Implemented | Om, jaali-compatible geometric/arch/floral/ventilation templates, tool diameter, bridge, material and boundary validation; DXF only | Add broader reviewed pattern library; generic G-code intentionally remains unavailable |
| Measurement Converter | Implemented | Offline deterministic unit conversion and feet-inch parsing | Browser accessibility check |
| AURA | Supervised implementation | Typed read/propose tools and proposal/audit lifecycle | Persistent hosted chat/proposal/rollback journey; unavailable tools stay hidden |
| Calendar/invoices/admin | Partial and intentionally secondary | Organization tables/routes and visible workspaces exist | Full create/update/error authorization journeys before calling them production-ready |

## Current live infrastructure evidence

- Production `/api/health` reports Supabase, durable jobs, plan vision and real image generation configured.
- The Cloudflare Worker health endpoint reports an active queue consumer and configured Preview bypass.
- The canonical Supabase project exposes material assignments, production review persistence, durable job lease/transition fields and a private `project-assets` bucket.
- Local root tests, web production build, preflight and secret scan pass on the current branch.

These signals prove configuration and contracts. They do not replace authenticated plan/render/laminate canaries.

## Open release gates

1. Run authenticated desktop, tablet and mobile journeys on one exact clean Preview.
2. Complete three representative Guided + Auto plans and prove manual completion with AI unavailable.
3. Produce one scene-linked Cloudflare 4B render and one locked laminate revision, then exercise approve/reject.
4. Reopen every production download and validate MIME type, filename and source scene version.
5. Prove cross-organization API denial and private-storage denial.
6. Persist provider-canary timestamps and Workers AI budget/usage; current health only proves configuration.
7. Promote only the tested Preview artifact and repeat the authenticated smoke suite on production.

Until those gates pass, ULTIDA is locally implementation-complete for the primary demo chain but not truthfully production-complete.

# Ultida Implementation Inventory

Last verified: 2026-07-27. This document records repository evidence, not intended behaviour.

| Surface | Status | Evidence / required next action |
| --- | --- | --- |
| Brief persistence | Partial | API and workspace exist; complete shared field validation and the AURA consistency shelf. |
| Floor-plan upload | Partial | Signed-upload routes exist, but direct data-URL analysis remains in parallel. Consolidate to one durable path. |
| Plan analysis | Partial | Provider, OCR, and CV code exist; PDF/vector processing and duplicate analysis paths need consolidation and live verification. |
| Plan approval | Partial | Versioning migrations exist; validate one canonical `plan.v1` approval against staging Supabase. |
| Spaces | Partial | Active-plan loading and requirement persistence exist; it is not yet the unified room/layout/module/material studio. |
| Design | Partial | Workspace exists but currently builds example wall/opening context instead of consuming approved geometry. |
| Scene compiler | Partial | Package exists; the render pipeline does not yet consume a three-dimensional compiled scene. |
| Render pipeline | Partial | Phase 0 enforces provenance, image-byte validation, and warning-only completion without QA evidence. |
| Cloudflare worker | Unverified | Queue consumer source and configuration exist; staging deployment and secret configuration are not proven. |
| Supabase migrations | Unverified | Additive migrations are present; apply and verify only through staging before production. |
| Visualize UI | Partial | Existing visual-job routes are separate from the new render pipeline; converge after scene compilation is authoritative. |
| DXF / production | Partial | Drawing packages exist; gate exports on approved `scene.v1` only. |

## Current architecture rule

AI may interpret plans and enhance renders. Approved `plan.v1` and `scene.v1` own dimensions, geometry, drawings, BOMs, and all production outputs.

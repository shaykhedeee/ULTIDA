---
name: ultida-development
description: Safely implement, repair, test, or deploy ULTIDA code in apps/, packages/, and supabase/migrations. Use for the ULTIDA interior-design OS on Supabase, Vercel, and Cloudflare, including plan analysis, Spaces, Design, scene.v1, rendering, drawings, cutlists, AURA, and provider workflows.
---

# ULTIDA development

## Preserve the authority chain

- Keep approved plan versions as measured geometry authority before scene compilation.
- Keep `scene.v1` as measured design authority after compilation.
- Require an exact scene version for every render, drawing, cutlist, quote, and production export.
- Treat AI outputs as reviewable proposals only. Never auto-commit AI-derived dimensions or geometry.
- Keep provider errors visible. Never substitute stock media or a hidden provider fallback.
- Attach organization, actor, source version, reason, and audit data to mutations.

## Work safely

1. Inspect the actual package and route before adding a parallel implementation.
2. Preserve user worktrees and unrelated files. Never reset or overwrite a dirty file without permission.
3. Build shared packages before apps: `npm.cmd run build:packages`.
4. Run relevant type checks and tests, then report the exact verification commands and remaining external gates.
5. Keep legacy or delivered-kit material read-only unless selectively reconciled into the canonical implementation.

## Respect package boundaries

- `spaces-core`: verified rooms and room geometry only.
- `layout-core`, `module-framework`, `material-core`, `design-core`: one approved room's layout, modular configuration, and materials.
- `scene-core`, `scene-compiler`: deterministic compilation and technical inspection only.
- `render-pipeline`: renders locked approved scenes only.
- `contracts`: shared types; build first.
- `aura-tools`: extend the one typed registry; never create a second orchestrator.

## AI and job rules

- Use propose -> review -> confirm for geometry-affecting AI work.
- Show provider, model, scene version, and synthetic/review status for generated UI output.
- Follow `docs/decision-log/2026-08-13-floor-plan-vision-policy.md`: Cloudflare is the automatic hosted route; other providers need explicit opt-in.
- Do not put polling loops inside serverless functions. Cloudflare queue consumers own durable work.
- Claim jobs only through an atomic SQL claim function (`claim_jobs()` or a targeted equivalent); never use select-then-update claiming.

## Read when needed

- `ARCHITECTURE.md` for repository invariants.
- `docs/PRODUCTION_ROADMAP.md` for delivery order and release gates.
- `docs/production/FREE_STACK_AND_TOOLS.md` before changing providers or adding image/vision tooling.

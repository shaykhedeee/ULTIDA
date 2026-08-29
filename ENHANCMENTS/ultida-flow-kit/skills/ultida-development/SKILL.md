---
name: ultida-development
description: Use this skill for any work inside the ULTIDA monorepo (interior design OS: Supabase + Vercel + Cloudflare). Triggers on any request to add, fix, or modify code in packages/, apps/, or supabase/migrations/ for the ULTIDA project. Encodes the project's non-negotiable architecture invariants so they're enforced automatically instead of depending on re-reading ARCHITECTURE.md each session.
---

# ULTIDA Development Skill

## Non-negotiable invariants (from ARCHITECTURE.md — verify, don't assume)

1. Approved plan versions own measured geometry before scene creation.
2. `scene.v1` owns measured design after scene creation. No second geometry
   authority anywhere — not in the browser, not in a render provider's
   response, not in an imported CAD/SketchUp file until reconciled.
3. Every visual, drawing, cutlist, and quote references an exact scene version.
4. AI outputs are synthetic proposals and cannot update dimensions. Any AI
   call that touches geometry must return a **proposal** requiring explicit
   human confirmation before it becomes part of `scene.v1` — never auto-commit.
5. Provider failures are visible and never replaced with unrelated stock
   media or a silently-substituted fallback that looks like success.
6. Every mutation has organization, actor, source version, reason, and audit event.
7. Legacy repos are read-only reference material; imports are selective and reconciled.

## Before writing any code

1. **Run the real build and test suite first.** Do not trust a prior
   session's status report, a markdown doc's claimed state, or your own
   assumption about what already exists.
   ```
   npm install
   npm run build
   npm run check
   npm test
   ```
   If any of these fail, that's the real starting point — fix or
   understand the failure before adding new work on top of it.
2. **Check `packages/` for an existing package before creating a new one.**
   This repo has a documented history of the same capability being built
   multiple times in parallel (multiple AURA services, multiple DXF
   writers, multiple app scaffolds in an earlier iteration) because a new
   session didn't check for existing work first. Search before you scaffold.
3. **Check for stray dump/kit folders** (anything that looks like a
   delivered kit copy-pasted into the repo root rather than integrated —
   e.g. a folder with a space in its name, or a nested `ultida-*-kit/`
   folder) and confirm whether production code actually resolves paths
   into them. If it does, that's a fragility bug to fix, not a pattern to
   extend.

## Package boundary reference (do not re-litigate without a stated reason)

- `spaces-core` — room identification/verification ONLY. No furniture,
  layout, or materials here.
- `layout-core` + `module-framework` + `material-core` (consolidated
  conceptually into "Design") — furniture layout, modular units, materials,
  one approved room at a time.
- `scene-core` + `scene-compiler` — compiles approved Space + Design into
  `scene.v1`. Technical inspection only, no freehand structural edits.
- `render-pipeline` — renders an approved, locked scene version only.
- `contracts` — shared types. Everything else depends on this building
  first (`npm run build:packages` before anything that imports from it).
- `aura-tools` — one typed tool registry. Do not create a second AURA
  orchestrator "for this specific feature" — extend the existing registry.

## When implementing an AI-touching feature

- Route geometry-affecting AI calls through a **propose → review → confirm**
  flow. If you're not sure whether a specific AI output should require
  confirmation, it should — the cost of an unnecessary confirmation click
  is low; the cost of a silently-committed wrong dimension is a
  contractor-facing production error.
- Attach visible provenance (scene version, provider, model, synthetic-vs-
  approved state) to anything AI-generated that reaches the UI — this is
  not optional polish, it's the literal on-screen proof of invariant #4 and
  #5. If a component renders generated content without this, that's a bug.
- Never add a new AI provider as a "quick fallback" without checking
  `docs/production/FREE_STACK_AND_TOOLS.md` and the project's stated
  provider policy first — this project has explicitly rejected ad hoc
  fallback providers before; don't reintroduce that pattern to solve a
  demo-speed problem.

## When a job/worker needs changing

- Never add a polling loop (`setInterval`, `while(true)` with sleep) inside
  a Vercel serverless function — this was a real bug, already fixed once.
  Vercel functions don't stay resident; use the Cloudflare Queue consumer.
- Job claiming must go through `claim_jobs()` (atomic, `FOR UPDATE SKIP
  LOCKED`) — never select-then-update.

## Reporting status

When you finish a unit of work, report it the way status has been reported
successfully in this project before: what you verified by actually running
it (with the command), what you're claiming without having run it
(labeled as such), and what's still blocked and why. A report that reads
"done" with no verification command attached should be treated as
unverified, not as done.

## Reference documents in this repo

- `ARCHITECTURE.md` — the invariants above, source of truth.
- `docs/product/00-workflow-decision-and-overview.md` — Spaces/Design/
  Scene/Visualize boundaries and why.
- `docs/production/AI_CODER_EXECUTION_PLAN.md` — current phase sequencing.
- `docs/production/FREE_STACK_AND_TOOLS.md` — approved tooling, provider policy.

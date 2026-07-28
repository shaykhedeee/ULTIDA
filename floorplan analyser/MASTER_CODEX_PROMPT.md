# Master Codex Prompt — Spaces / Design / Scene / Visualize

Paste this whole file to your coding agent inside the ULTIDA repo root.

---

Restructure ULTIDA's workflow around four production workspaces: **Spaces,
Design, Scene, Visualize.** This reconciles two prior specs that disagreed
on one point — Design absorbs Layout + Modules + Materials, NOT Spaces.
This decision is final; do not re-litigate it mid-implementation. Reason:
ULTIDA's existing `packages/` already separates `spaces-core` from
`layout-core`/`module-framework`/`material-core` — build with that grain.

## Step 0 — Audit first, do not guess

Before writing new code, inspect and report on:
- `packages/spaces-core`, `packages/layout-core`, `packages/module-framework`,
  `packages/material-core`, `packages/scene-core`, `packages/scene-compiler`,
  `packages/render-pipeline`
- `apps/web/src` — existing SpacesWorkspace, any Layout/Module/Material
  screens, DesignFlowWorkspace, render screens, `App.tsx` routes
- Canonical geometry types already defined in `packages/contracts`

Produce a migration map: for each existing component, mark retained /
renamed / merged / split / deprecated / removed. **Do not destroy working
behavior** — if something already works, wrap or extend it, don't rewrite
it from scratch because a new spec exists.

## Step 1 — Canonical contracts first

Add to `packages/contracts/src/`:
- `SpaceV1` (see `docs/product/00-workflow-decision-and-overview.md` for
  the exact shape)
- `DesignVersionV1` (same doc)
- Confirm/extend `BriefCoreV1` and `RoomRequirementsV1` already delivered
  in `server/brief_schema.ts` from the prior kit — move these into
  `packages/contracts/src/` if they aren't there yet, this is their real home.

## Step 2 — Spaces workspace

- Spaces loads ONLY from the active approved floor-plan version — inherit
  polygons, dimensions, area, walls, openings, ceiling height directly from
  the reconciled plan (`reconcile_plan.ts`, already built). **Never** ask
  the designer to re-type a dimension that's already in the approved plan
  at reasonable confidence.
- Implement the room card list, canvas tools, and right-panel inspector per
  `docs/product/01-spaces-and-design-acceptance-criteria.md`.
- A room is `readyForDesign` only when the full gate in that doc passes.
- Persist changes as a versioned space-planning layer — do not mutate the
  immutable approved floor-plan version directly; create a new plan
  revision if geometry itself changes.

## Step 3 — Design workspace (merges Layout + Modules + Materials)

- Operates one approved Space at a time. Implement the three modes
  (Builder-plan interpretation / AI auto-layout / Manual) exactly as
  specified.
- **Wire AI auto-layout mode to `compilePrompt()`** from
  `server/prompt_compiler.ts` (already built and type-checked) — this is
  not optional glue, it's the actual mechanism that makes "AI understands
  each room, no repeated inputs" real instead of aspirational. Confirm the
  escalation order (brief → space geometry → room requirements → only then
  ask designer) is implemented as literal code, not just followed by
  convention.
- Implement wall assignment, module inspector, material tools per the
  acceptance doc. All AI suggestions must be dimensional/symbolic data
  (wall ID, offset, exact width/height/depth), never image-only output.
- Deterministic validation (collision, clearances, door swing, etc.) is
  plain code, not an AI call — keep it that way, it's cheaper and it's
  actually reliable.
- Approval creates an immutable `DesignVersionV1`. Mark any existing Scene
  for this room stale on approval.

## Step 4 — Scene workspace

- Compiles approved Space + approved Design into `scene.v1`. Technical
  inspection only — no freehand structural edits; route corrections back
  to Spaces/Design and require recompilation.
- Implement the dimensional comparison view (plan wall vs. scene wall vs.
  difference vs. pass/fail) — this is the literal, visible proof of
  `ARCHITECTURE.md` invariant #2 working, not just a claim in a doc.
- Any decorative-only addition in Scene must be labeled "Visual only —
  excluded from production," never silently treated as approved geometry.

## Step 5 — Visualize workspace

- Consumes only an approved, locked scene version. Never generates a room
  from a prompt alone.
- Attach `ProvenanceBadge` (already built in `components/ProvenanceBadge.tsx`)
  to every render card — scene version, provider/model, synthetic vs.
  approved state must be visible on screen, not just stored in the database.
- Implement geometry lock as a real, enforced constraint on the provider
  call (forbidden: wall/opening/module/camera/ceiling changes from the AI
  enhancement pass), not just a UI toggle that doesn't actually restrict
  the request sent to the provider.
- Render QA output (geometry score, opening accuracy, module accuracy,
  material similarity, invented/missing objects) is a real check against
  the scene data, not a cosmetic percentage.

## Non-negotiables (apply to all four steps)

- No stage relies only on `App.tsx` local state — persist everything.
- Upstream change marks downstream stale, per the cascade rules in
  `00-workflow-decision-and-overview.md`.
- Do not recreate Layout/Modules/Materials as separate primary nav items
  once merged into Design — that reintroduces the exact fragmentation this
  restructure exists to remove.
- Do not begin by changing render prompts or provider calls — sequence is
  contracts → Spaces → Design → Scene → Visualize, in that order.

## At completion, report

Retained components · merged components · deprecated routes · new
components/schemas · migrations · which of the 5 steps above are actually
done vs. stubbed · tests added · remaining blockers — same honest format
as your last status report on the Brief/Floor-Plan/Spaces work, which was
genuinely good practice. Keep doing that.

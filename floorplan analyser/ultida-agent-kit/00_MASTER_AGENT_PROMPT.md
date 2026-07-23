# ULTIDA — Master Agent Task List (Agent B parity + differentiation)

Give this whole file to your coding agent, running inside your actual local
`C:\Users\USER\Documents\Muskans autocad solution\ULTIDA` folder. It references
the scripts and components delivered alongside it — copy those into the repo
first (paths given in each task).

**Why these files exist**: I don't have visibility into your current local
state (GitHub is stale). Rather than write code blind against an outdated
snapshot, this kit is deliberately self-verifying — every task ends with a
command you (or the agent) run to confirm it actually worked, against
whatever your code actually looks like right now.

---

## Setup (5 minutes)

1. Copy `scripts/audit_design_tokens.mjs`, `scripts/audit_fake_truth.mjs`,
   `scripts/audit_provenance_ui.mjs` into your repo's `scripts/` folder.
2. Copy `components/tokens.ts` → merge into (or create) `packages/ui/tokens.ts`.
3. Copy `components/ProvenanceBadge.tsx` → `packages/ui/src/ProvenanceBadge.tsx`.
4. Copy `components/EntityPicker.tsx` and `components/MaterialSwapPanel.tsx` →
   `apps/web/src/components/design/` — fix the relative import path to
   `ProvenanceBadge` at the top of `EntityPicker.tsx` to match your actual
   monorepo path alias (check `tsconfig.base.json`/`vite.config` for existing
   aliases like `@ultida/ui` before hand-writing a relative path).

Run the baseline audit before changing anything, so you have a real
before/after:
```
node scripts/audit_design_tokens.mjs .
node scripts/audit_fake_truth.mjs .
node scripts/audit_provenance_ui.mjs .
```
Save this output somewhere — this is your real Phase 0 backlog, generated
from your actual current code, not from a doc.

---

## Task 1 — Design token consolidation
**Do:** For every finding in the `audit_design_tokens.mjs` report, replace
the literal color/spacing value with a reference to `packages/ui/tokens.ts`
(or your Tailwind theme extension if you wire `tailwindThemeExtend` in).
**Acceptance:** `node scripts/audit_design_tokens.mjs . --strict` exits 0.
**Do not:** invent new colors while doing this — if a screen needs a color
not in `tokens.ts`, that's a design decision, stop and ask, don't silently add one.

## Task 2 — Fake-truth sweep
**Do:** Run `node scripts/audit_fake_truth.mjs .`. For each finding:
- hardcoded calibration constant → either wire it to real designer input,
  or explicitly mark the UI state as "unreviewed" (use `ProvenanceBadge`
  state='unreviewed') instead of presenting it as fact.
- machine-specific path → replace with `process.env.*` or runtime discovery.
- swallowed error → re-throw, surface to caller, or at minimum return a
  typed failure the UI can display — never just `console.warn` and continue
  as if it succeeded.
- mock/stub/TODO in non-test source → resolve or convert to a tracked issue.
**Acceptance:** re-run the script; each finding is either fixed or has a
one-line comment directly above it explaining why it's intentionally left
(e.g. `// INTENTIONAL: dev-only fallback, gated by NODE_ENV !== 'production'`).

## Task 3 — Wire ProvenanceBadge everywhere it's needed
**Do:** Run `node scripts/audit_provenance_ui.mjs .`. For every component
flagged as missing provenance, add a `<ProvenanceBadge>` (compact variant for
list rows, full variant for detail/card views) sourced from real backend
fields (`sceneVersionId`, provider, model, approval state). If those fields
don't exist yet on the relevant API response, that's a real backend gap —
add them to the response shape rather than faking the badge with placeholder
data.
**Acceptance:** re-run the script; the "missing" list should shrink to zero
or to components that genuinely never show generated content (verify by hand).

## Task 4 — Entity picker + material swap (the core Agent-B-beating feature)
**Do, in order:**
1. Find your existing Three.js/React Three Fiber viewport component (likely
   in `apps/web/src/components/design/` or `packages/scene-core`).
2. Add stable entity IDs to every selectable mesh (wall, opening, module) if
   not already present — these should already exist as scene.v1 entity IDs
   per `ARCHITECTURE.md`; if they don't, that's the real blocker, fix that first.
3. Wire raycasting/click on the viewport to call `onSelect(entityId)` on the
   `EntityPicker` component (pass the resolved `SceneEntity[]` list from
   your scene API, not from pixel data).
4. Wire `EntityPicker`'s `onRequestSwap` to open `MaterialSwapPanel`.
5. Implement `onConfirmCatalogSwap`: call your existing catalog/material-slot
   API, update scene.v1, mark dependent renders/drawings stale (per
   `ARCHITECTURE.md` invariant #3).
6. Implement `onRequestAiProposal` / `onConfirmAiProposal`: route through
   `packages/provider-gateway` and `packages/aura-tools`. The proposal step
   must NOT touch scene.v1 — only `onConfirmAiProposal` does, and only after
   the SKU/material-slot mapping is resolved (per the "Laminate and 'anything
   changer' design" section of `DESIGN_PHASE_AND_AURA_OPERATING_MODEL.md`).
**Acceptance:** write one Playwright/integration test: load a fixture scene,
click a module, confirm a catalog swap updates scene.v1 and marks the linked
render stale. This is your golden fixture — keep it green forever.

## Task 5 — Verify nothing regressed
```
npm run check
npm run build
npm test
```
All three must exit 0 before you consider this done. If `npm test` fails on
something environment-specific (missing provider API keys, browser paths),
confirm it's genuinely environment-dependent and not a real regression before
moving on — don't assume, check the actual error.

## Task 6 — Push it
Once green locally:
```
git add -A
git commit -m "design token consolidation, provenance UI, scene entity picker + material swap"
git push origin main
```
Tell me when it's pushed and I'll pull it and verify independently, the same
way I did with your last two repos — that's the step that actually closes
the loop instead of trusting the commit message.

---

## What this does NOT cover (intentionally, so you know what's left)
- The multi-tier render presets (Space/Studio/Cinematic) — Part 2.3 of
  `ULTIDA_VS_AGENTB_BUILD_PROMPT.md`. Do this after Task 4 is solid, not before.
- The client/commerce package assembly (Part 2.4) — depends on Task 4's
  stale-artifact propagation actually working first.
- Multi-vertical org config (Part 2.5) — lowest priority, cosmetic/config layer.

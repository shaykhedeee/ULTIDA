# AI Coder Execution Plan — Sequencing the Production Completion Roadmap

Your pasted "ULTIDA Production Completion Roadmap" is genuinely well-designed
— the geometry-authority rules, the scene-first cutlist model, the refusal
to emit unsafe generic G-code, the SketchUp review-export instead of
"hallucinated image-to-Ruby automation" — these are the right calls, not
just cautious ones. This document doesn't replace it. It sequences it
against what's **actually verified true in the repo right now** (checked by
running the real build/test suite, not by reading a status report), so your
AI coder starts from real ground instead of assumed ground.

## What's already real (verified by running it, this session)

- `claim_jobs()` with `FOR UPDATE SKIP LOCKED` — done, in migrations.
- The Vercel `setInterval` polling anti-pattern — gone, confirmed absent
  from both workers.
- The hardcoded `pixelPerMm` fake-calibration constant — gone.
- `packages/design-core` — real, matches your Layout/Modules/Materials
  consolidation decision, Zod-validated, immutable versioning, not a stub.
- `apps/api/cv/wall_tracer.py` — real deterministic wall detection,
  verified against both a synthetic and a real annotated floor plan in
  this conversation (see the earlier overlay proof images).
- `api/[...path].ts` — a real fix for the "Vercel deployed only 4 files"
  bug from an earlier session.
- Full monorepo build: clean, verified twice on two separate fresh clones.
- Test suite: 69/73 passing, with the 4 failures root-caused (3 are
  Supabase-not-configured-in-sandbox, correctly returning 503 before auth
  — a real ordering question, not a broken feature; 1 is a browser-e2e
  test needing a graceful skip on machines without Chrome).

## What's NOT yet verified — your coder should check these first, not assume

Section 1 of your roadmap ("Stabilize the demo path") lists job leases,
heartbeats, deadlines, retry limits, and cancellation states as still
needed. I have not personally verified whether these exist yet in the
current `apps/worker` / `apps/cloudflare-ai-worker` code — the last thing I
confirmed was that `claim_jobs()` exists and the polling loop is gone,
which is necessary but not sufficient for everything Section 1 describes.
**First task for your coder: audit `apps/worker/src` and
`apps/cloudflare-ai-worker/src` against every bullet in your roadmap's
Section 1, and report which are real vs. still needed** — the same
verify-before-build discipline used throughout this conversation.

## Sequencing (why this order, not a different one)

### Phase 0 — Finish the fixes already in flight (days, not weeks)
1. Apply the `check` script ordering patch (already delivered, verified twice).
2. Consolidate `wall_tracer.py` to one location (`apps/api/cv/`) — delete
   the `floorplan analyser` dump folder's copy once `plan-analysis-service.ts`'s
   path resolution points at the real one.
3. Auth-before-availability middleware ordering (401 before 503).
4. Browser e2e test: skip gracefully with no Chrome, don't hard-fail.

**Why first:** these are small, already-scoped, already partially verified.
Finishing them costs almost nothing and removes noise before your coder
starts the much bigger Section 1-6 work — a clean baseline matters more
here than it sounds like it should, because every subsequent audit is
easier to trust when the test suite isn't already carrying known noise.

### Phase 1 — Section 1: job durability audit + gaps (per your roadmap)
Audit first (see above), then implement whatever's missing: leases,
heartbeats, deadlines, stage timestamps, retry limits, cancellation,
terminal failure states. This underpins literally everything downstream —
plan analysis, rendering, cutlist generation all run as jobs. Get this
right once, at the bottom of the stack, rather than half-right and
patched per-feature later.

### Phase 2 — Guided Plan Tracer + Space Setup (Section 2, first half)
This is where `wall_tracer.py` + `reconcile_plan.ts` (both already built
and verified against real data) plug in directly. Space Setup's
"changing room geometry creates a new version and marks layouts/scenes/
renders stale" rule is the same cascade-invalidation pattern already
specified in the Spaces/Design/Scene/Visualize docs from the prior
session — implement it once, consistently, not per-stage.

### Phase 3 — Layout Studio → Module Planner → Materials (Section 2, rest)
This is where `design-core` (already real, already matches your intended
shape) and `compilePrompt()` (already built, type-checked) become load-
bearing. Your roadmap's three layout options (Maximum Storage / Balanced
/ Maximum Circulation) map directly onto the "AI auto-layout" mode already
specified — implement the scoring logic as deterministic code operating
on real room geometry + brief data, not a fresh LLM call per option.

### Phase 4 — Rendering + laminate revision (Section 3)
Only after Scene compiles reliably from Phase 3's output. Deterministic
Three.js preview first (per your own roadmap's correct ordering), then
Cloudflare enhancement with depth/edge/mask conditioning generated from
the real scene (see `FREE_STACK_AND_TOOLS.md` — free, more accurate than
AI-estimated depth since you already have real geometry).

### Phase 5 — Cutlist/CNC production authority (Section 4)
Explicitly gated behind Phase 3 producing real `scene.v1` module parts —
your roadmap is correct that the old generic part expansion must not be
treated as authoritative once exact scene parts exist. Don't let this
phase start early "in parallel" just because it's a separate team
concern — it has a real, hard dependency on Phase 3's output shape.

### Phase 6 — AURA, SketchUp export, dashboard, reference vault (Section 5)
Correctly last — these are all consumers of state that Phases 1-5
produce (job state, scene state, production state). Building AURA's
"explain blockers" tool before there are real blockers to explain against
means building against imagined state again — the exact failure pattern
this whole engagement has been correcting.

## The one addition to your roadmap I'd make

Your roadmap's acceptance tests (Section 7) are thorough but described as
a single end-of-phase pass. Given this project's specific history — real,
verified regressions have repeatedly hidden behind confident-sounding
status reports — **run the authenticated acceptance suite after every
phase above, not just once at the end**, and keep the habit already
established in this conversation: a status report that says "done" should
come with the exact command that verifies it, so anyone (including a
different AI session) can re-check it in thirty seconds instead of trusting
prose.

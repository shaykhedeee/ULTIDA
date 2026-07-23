# How to make the floor plan analyzer work — for real, step by step

This is written so you (or your coding agent) can follow it mechanically and
know at each step whether it actually worked, not just whether it ran.

## Why the analyzer probably isn't fully working yet

Your own docs already diagnose this correctly: a vision-LLM alone (OpenAI/
Cloudflare vision) is good at "this is a kitchen," bad at "this wall is
exactly 3,420mm." It will approximate geometry, not measure it. That's not
a bug to patch — it's the wrong tool for that half of the job. The fix is
running a **second, deterministic pass** alongside it and merging the two.
That's what `wall_tracer.py` + `reconcile_plan.ts` in this kit do — and
`wall_tracer.py` is not a sketch, I ran it against a synthetic floor plan and
it correctly traced all 4 outer walls, the interior wall, and correctly
identified a door gap as a real break in the wall (see the test output in
this conversation).

## Step 1 — Get the CV pass running as its own service

Cloudflare Workers **cannot** run Python/OpenCV — it's V8 isolates only.
You need `wall_tracer.py` running somewhere that can execute real Python
with native dependencies. Options, cheapest/simplest first:

- **A small dedicated endpoint** (Railway, Render, Fly.io, or a single
  low-cost VM) running a tiny FastAPI/Flask wrapper around `wall_tracer.py`.
  This is genuinely a ~30 line wrapper:
  ```python
  # cv_service/main.py
  from fastapi import FastAPI, UploadFile
  from wall_tracer import trace_walls
  import tempfile, shutil

  app = FastAPI()

  @app.post("/trace")
  async def trace(file: UploadFile):
      with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
          shutil.copyfileobj(file.file, tmp)
          path = tmp.name
      return trace_walls(path)
  ```
  ```bash
  pip install fastapi uvicorn opencv-python-headless numpy python-multipart
  uvicorn cv_service.main:app --host 0.0.0.0 --port 8000
  ```
- Call this from `apps/api` (your existing Node/Express or Vercel function)
  as a plain HTTP POST with the uploaded plan image, right alongside your
  existing vision-LLM call — run both in parallel with `Promise.all`, not
  sequentially, so you don't double your latency.

**Verify this step actually works before moving on:**
```bash
curl -X POST -F "file=@test_floorplan.png" http://localhost:8000/trace
```
You should get back real JSON with a non-zero `wallCount`. If `wallCount`
is 0 on a real scanned plan, the issue is almost always image quality
(low-contrast scan, colored background) — try the preprocessing tuning
notes in Step 3 before assuming the algorithm is broken.

## Step 2 — Reconcile both passes

Drop `reconcile_plan.ts` into `apps/api/src/plan/`. Wire it in wherever your
floor-plan analysis job currently writes to `floor_plan_versions` — call
`reconcilePlan(cvResult, visionResult)` and store its output as the
candidate `interpretation` JSON, not either raw result alone.

**Verify:** After running one real upload through both passes, open the
`floor_plan_versions` row and check `reviewFlags` — if it's a real
scanned plan, you should usually see at least one flag (a real plan
always has some ambiguity). An empty `reviewFlags` array on messy scan
input is suspicious — check you're actually calling both passes, not
silently falling back to one.

## Step 3 — Tuning for real scanned plans (not just clean synthetic ones)

Real client-uploaded floor plans are messier than my clean test image:
scan noise, colored backgrounds, printed dimension text overlapping walls,
inconsistent line weights. Before you conclude the tracer "doesn't work":

1. **Check DPI/resolution first.** `wall_tracer.py`'s `minLineLength=40`
   and gap tolerances are tuned for a roughly 900-1200px wide image. A
   4000px scan needs those scaled up proportionally; a 400px thumbnail
   needs them scaled down. Add a resize-to-consistent-width step before
   calling `trace_walls()` (1200px wide is a reasonable target) rather
   than tuning per-image.
2. **If walls are missed**: the adaptive threshold block size (currently
   15) and constant (8) in `preprocess()` are the first things to adjust
   for a specific scan style — increase the constant if background noise
   is being picked up as lines, decrease if faint walls are being lost.
3. **If walls are duplicated/fragmented**: increase `gap_tol` in
   `merge_collinear()` (currently 12px) — dashed or discontinuous scan
   lines need a larger bridging gap.
4. Build a small fixture set: 5-10 real (anonymized) client plans you
   already have, run the tracer against all of them, and treat any
   parameter change as something that must not regress the ones that
   already work — this is exactly the "golden fixture" pattern your own
   `ULTIDA_CONTINUATION_PLAYBOOK.md` already calls for.

## Step 4 — Wire the brief → prompt pipeline

Drop `brief_schema.ts` into `packages/contracts/src/` and `prompt_compiler.ts`
into `packages/aura-tools/src/` (both already type-check cleanly, verified).

Replace your current Brief form fields with `BriefCoreV1` — this is the
"make the brief lesser" part. Move the detailed per-room questions
(cooking style, wardrobe type, storage volume, etc.) into a `RoomRequirementsV1`
form that appears **on the Spaces screen, per approved room**, not on the
initial brief.

Wire `compilePrompt(brief, room, requirements)` at the point where you
currently build a render/design prompt. Log the full `CompiledPromptV1`
(including `segments` and `sourceBriefFieldsUsed`) alongside the `ai_runs`
row for that job — this is what makes the brief→AI flow inspectable, the
"like n8n" property you asked for: you can look at one row and see the
brief data, every transform stage, and the final prompt that reached the
provider.

**Verify:** Run `compilePrompt()` against one real brief + one real
approved room and read the `finalPrompt` output. Confirm every field you
expect to matter (style, priorities, constraints, room requirements) is
visibly present in the text — if a field silently doesn't show up, trace
which stage dropped it using the intermediate `segments` output.

## Step 5 — The Spaces screen enhancement

Per your own `SMART_PROJECT_EXECUTION_PLAN.md` Phase 3 spec (which is
already well-designed, just not built): Spaces should show one card per
**approved** room (never a fabricated default room), each showing real
derived geometry (area, dimensions, ceiling height, opening count) pulled
from the reconciled plan, with a "Requirements" button that opens the
`RoomRequirementsV1` form for that specific room. A room is "ready" only
when geometry is verified AND requirements are saved — exactly the gate
your own doc specifies. Don't let Spaces show anything for an unapproved
plan; that was the bug your own doc flagged ("Remove DEFAULT_SPACES and
all fabricated rooms").

## What "for sure for sure" actually requires

I want to be honest about the one thing I can't guarantee from here:
**I haven't run this against your real production Supabase data or your
actual uploaded floor plans** — only against a synthetic test image I
built myself. The pipeline is real and verified on that test case; whether
it holds up on your actual clients' messy scans depends on Step 3's
tuning, which needs your real plan images to do properly. Once you've
wired Steps 1-2 in, send me 2-3 real (anonymized, if needed) floor plans
and I'll run the actual tracer against them and tune the parameters for
real, rather than promising it'll "just work" on data I haven't seen.

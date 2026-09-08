# 00 — Workflow Decision & Overview

## The decision (and why)

Two competing specs were produced for this workflow. They disagree on one
structural question: **does Spaces absorb Layout/Modules/Materials, or does
Design?**

**Decision: Design absorbs Layout + Modules + Materials. Spaces stays
narrowly scoped to room identification and verification.**

Reason, concretely: ULTIDA's actual repo already has these as separate
packages — `packages/spaces-core`, `packages/layout-core`,
`packages/module-framework`, `packages/material-core`,
`packages/scene-core`, `packages/scene-compiler`, `packages/render-pipeline`.
This split lets `layout-core` + `module-framework` + `material-core` merge
into one `Design` package/workspace without touching `spaces-core`'s
boundary at all. The other spec's structure would require re-carving
`spaces-core` itself to absorb three other packages' responsibilities —
more rework, no functional gain, and it fights the grain of what's already
built. When two plans are otherwise similar in quality, prefer the one
that costs less to build against your real codebase.

## The four workspaces, final scope

```
Brief → Floor Plan (Upload → AI Analysis → Review → Approval)
  → Spaces        (identify + verify rooms — geometry only, no furniture)
  → Design        (layout + modules + materials, combined, one room at a time)
  → Scene         (compile approved Design into deterministic 3D — technical, not another design pass)
  → Visualize     (render approved Scene — never generates from a prompt alone)
  → Production    (Elevations, DXF, Cutlist)
  → Commercial
  → Delivery
```

### Spaces — package: `spaces-core`
**Owns:** room polygons, dimensions, area, walls, openings, columns, beams,
services, ceiling height, room readiness state.
**Does not own:** furniture, layout, materials — those are Design's job.
**Input:** the reconciled candidate from `reconcile_plan.ts` (already built —
see `server/reconcile_plan.ts` in this kit), which merges `wall_tracer.py`'s
deterministic geometry with the vision-LLM's semantic room labels.
**Output:** `SpaceV1` per room (schema below), each requiring designer
approval before Design can touch that room.

### Design — package: new `design-core`, absorbing `layout-core` + `module-framework` + `material-core`
**Owns:** furniture layout, modular unit configuration, material assignment
— for one approved Space at a time.
**Three modes**, exactly as both source docs agreed on (this part they
didn't conflict on): Builder-plan interpretation, AI auto-layout, Manual.
**This is where `RoomRequirementsV1` and `compilePrompt()`** (already built
in `server/brief_schema.ts` and `server/prompt_compiler.ts`) plug in
directly — AI auto-layout mode calls `compilePrompt(brief, room,
requirements)` to get a geometry-grounded, brief-grounded generation
request instead of asking the designer the same questions the brief and
plan already answered. This is the concrete mechanism behind "no need for
multiple inputs for each room, make the AI understand each room properly."
**Output:** `DesignVersionV1` — layout shape, placements, module instances,
material assignments, validation result. Immutable once approved.

### Scene — package: `scene-core` + `scene-compiler`
**Owns:** compiling approved Design + approved Space geometry into one
deterministic 3D scene graph. Technical inspection workspace, not a design
surface — no freehand structural edits here; corrections go back to Spaces
or Design and re-compile.
**Output:** `scene.v1`, matching `ARCHITECTURE.md` invariant #2.

### Visualize — package: `render-pipeline`
**Owns:** rendering an approved scene version. Never generates a room from
a prompt alone — every render must trace back to a locked scene version,
per `ARCHITECTURE.md` invariants #3-5.
**Output:** render artifacts with full provenance (`ProvenanceBadge`,
already built in `components/ProvenanceBadge.tsx`, attaches here directly).

## Canonical data flow (the one both docs actually agreed on — keep this)

```
approved floor-plan version
  → approved Space configuration
  → approved Design version
  → approved Scene version
  → render jobs
```

Upstream change invalidates downstream state — a room geometry edit marks
Design/Scene/renders for that room stale; a material change marks only
Scene/renders stale; a camera change marks only that render stale. This is
already your `ARCHITECTURE.md` invariant #3 in explicit, stage-by-stage form.

## Core schemas

```typescript
// packages/spaces-core/src/types.ts
interface SpaceV1 {
  spaceId: string;
  floorPlanVersionId: string;
  name: string;
  type: string; // 'living' | 'kitchen' | 'bedroom' | ...
  polygonMm: Array<{ x: number; y: number }>;
  areaSqMm: number;
  ceilingHeightMm: number;
  wallIds: string[];
  openingIds: string[];
  usableWalls: string[];
  verificationStatus: 'detected' | 'needs_review' | 'approved';
  readyForDesign: boolean;
}

// packages/design-core/src/types.ts
interface DesignVersionV1 {
  designVersionId: string;
  spaceId: string;
  layoutShape: string;
  mode: 'builder_plan_interpretation' | 'ai_auto_layout' | 'manual';
  placements: ModulePlacement[];
  moduleInstances: ModuleInstance[];
  materialAssignments: MaterialAssignment[];
  compiledPromptTrace?: CompiledPromptV1; // from prompt_compiler.ts, kept for audit
  validation: { valid: boolean; violations: string[] };
  status: 'draft' | 'approved';
}
```

## What this means for "make the AI understand each room properly" (your note)

Concretely, not aspirationally: AI auto-layout mode in Design should never
ask a question the pipeline can already answer. Before asking the designer
anything, it should check, in order:
1. Does `BriefCoreV1` answer this (style, priorities, constraints)?
2. Does the approved `SpaceV1` answer this (dimensions, wall lengths,
   opening positions — from the reconciled plan, not a guess)?
3. Does `RoomRequirementsV1` for this specific room answer this (if filled
   in already)?
4. Only if all three are silent on a specific point, ask the designer —
   and ask a specific, scoped question (per both source docs' example: "TV
   wall recommendation: Wall L-03. Available width: 3850mm. Would you
   like: Full-wall / Floating / TV+crockery / Choose another wall" — not
   an open-ended "describe your kitchen").

This is a direct, mechanical rule an implementer can follow, not a vague
design principle.

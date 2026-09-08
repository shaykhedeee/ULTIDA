# 01 — Spaces & Design: Screen Structure, Tools, Acceptance Criteria

## Spaces screen

```
┌──────────────────────────────────────────────────────────────────┐
│ Room selector │ Analysis status │ Add room │ Re-analyse │ Approve│
├────────────────┬───────────────────────────┬─────────────────────┤
│ Spaces list    │ Floor-plan / room canvas  │ Room properties     │
├────────────────┴───────────────────────────┴─────────────────────┤
│ Room readiness │ Issues │ Measurements │ Suggested usable walls  │
└──────────────────────────────────────────────────────────────────┘
```

**Room card** (left panel), populated from `SpaceV1` — never manually
re-entered:
```
Living Room
4200 × 4600 mm    19.32 m²
4 walls  ·  2 openings
[Ready for design]
```
Statuses: Detected → Needs review → Missing measurements → Ready for
design → Design in progress → Designed → Excluded.

**Canvas tools:** select room/wall, pan, zoom, measure, draw room, redraw
boundary, split/merge room, add/edit wall, add/edit door/window, add
column/beam/service point, annotate, undo/redo, reset detection.

**Right panel (room properties):** Geometry (name, type, L/W/area,
perimeter, ceiling height, orientation) · Openings (doors/windows,
direction, sill/head height) · Structure (columns, beams, offsets) ·
Services (electrical, plumbing, AC, drainage) · Design inclusion (include
in project, priority, budget allocation).

**Draw-room flow:** select "Draw Room" → click corner points → close
polygon → confirm room type → associate existing walls → confirm/enter
missing dimensions → save as part of the active floor-plan version.
Validation warnings: overlapping room, unclosed polygon, disconnected
wall, boundary conflicts with approved walls, unverified scale.

**AI responsibilities (Spaces):**
- May: identify room type, read labels, associate dimensions with the
  correct room, suggest missing boundaries, detect usable walls, flag
  ambiguous spaces, explain why a room needs review.
- May not: invent dimensions, overwrite verified geometry, silently
  change approved scale, delete walls without confirmation, decide final
  furniture placement (that's Design's job, not Spaces').

**Space readiness gate** — all must be true:
valid polygon · verified scale · dimensions available · wall references
resolved · openings verified · ceiling height known · no blocking issues.

## Design screen

```
┌──────────────────────────────────────────────────────────────────┐
│ Room selector │ Design mode │ Generate │ Validate │ Approve       │
├────────────────┬───────────────────────────┬─────────────────────┤
│ Furniture      │ 2D room design canvas     │ Configuration       │
│ & templates    │                           │ inspector           │
├────────────────┼───────────────────────────┼─────────────────────┤
│ AI suggestions │ Option comparison         │ Violations          │
└────────────────┴───────────────────────────┴─────────────────────┘
```

Operates **one room at a time**, on an approved `SpaceV1`.

**Three modes** (user picks per room):
- **A — Builder-plan interpretation:** detect furniture symbols already in
  the source plan → associate with room/wall → convert to editable
  placements → confirm → replace generic symbols with modular templates.
- **B — AI auto-layout:** call `compilePrompt(brief, room, requirements)`
  (already built, see `server/prompt_compiler.ts`) → generate 2-4 scored
  layout options (circulation, storage, fit, cost) → designer picks/edits one.
- **C — Manual:** designer selects wall → furniture category → template →
  dimensions → places and configures directly.

**Only ask unresolved questions** — see the escalation order in
`00-workflow-decision-and-overview.md`'s closing section. Example of the
right question shape once brief/plan/requirements are exhausted:
```
Living room detected. TV wall recommendation: Wall L-03.
Available width: 3850mm. Window conflict: none.
Would you like: Full-wall TV unit / Floating / TV+crockery / Choose another wall
```

**Wall assignment:** clicking a wall shows ID, length, usable width,
height, openings, electrical points, existing assigned units, remaining
width. Actions: add unit, auto-fit, centre, align, fill wall, add filler,
duplicate, mirror, replace, remove.

**Layout families required before module generation:**
- Kitchen: single wall / parallel / L / U / peninsula / island / G
- TV unit: floating / full wall / asymmetrical / L / TV+study / TV+crockery / partition
- Wardrobe: linear / L / walk-in / +dresser / +study / +TV

**Module inspector:** Position (wall, offset, elevation, rotation) ·
Overall size (W/H/D) · Composition (shutters, drawers, shelves, loft,
skirting, countertop) · Internal configuration · Material zones (carcass,
shutters, back panel, glass, profile, handles) · Lighting (profile strip,
shelf strip, under-cabinet, mirror light).

**Material tools:** select · apply to part/module/room · replace
everywhere · compare · save palette · company default. Each material
carries brand, code, finish, texture (with real texture size + grain
direction), roughness, price, availability — this is what makes the render
use the exact approved laminate rather than an approximate color.

**AI responsibilities (Design):**
- May: suggest furniture categories, recommend usable walls, propose
  layouts, select compatible templates, suggest dimensions within
  available space, suggest material combinations, explain violations,
  generate alternates.
- May not: ignore door/window clearances, produce image-only output
  without dimensional data, generate modules without real dimensions,
  place furniture without a wall/room anchor, bypass deterministic
  validation.

**Validation (deterministic code, not AI):** furniture collision, door
swing, window obstruction, curtain/AC clearance, circulation, drawer/
shutter opening clearance, appliance/electrical/plumbing access, wall fit,
ceiling height, structural obstructions.

**Approval creates an immutable `DesignVersionV1`** containing layout,
placements, module instances, materials, lighting, validation result —
per the schema in `00-workflow-decision-and-overview.md`.

## Acceptance criteria (both screens)

- [ ] Spaces never shows a fabricated/default room — only rooms derived
      from an approved floor-plan version (same rule your own
      `SMART_PROJECT_EXECUTION_PLAN.md` already states for the old Spaces
      page; it applies identically here).
- [ ] A room's dimensions are never re-typed by the designer if the
      reconciled plan already has them at acceptable confidence — only
      corrected, with the correction tracked.
- [ ] Design cannot open on a room whose `SpaceV1.readyForDesign` is false.
- [ ] Every Design approval marks the room's Scene stale if one already existed.
- [ ] AI auto-layout mode's first call is always `compilePrompt()` — never
      a hand-written ad hoc prompt string — so brief/plan data is
      guaranteed to reach generation the same way every time.

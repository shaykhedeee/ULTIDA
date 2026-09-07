# Production drawing and sign-off template contract

ULTIDA produces two linked, but different, deliverables.

## 2D production package

The 2D package is the construction source. Every wall sheet must be generated
from the approved scene revision and show its wall ID, revision, units in
millimetres, provenance, and a **do not scale drawing** notice. It contains:

- external elevation with overall, datum, bay, opening, sill, plinth and
  ceiling/filler dimension chains;
- internal System 32 section with carcass, shelf, drawer, shutter, loft,
  hardware and lighting component records;
- plan/top view with depths, wall thickness, opening keep-outs and service
  zones;
- material, hardware and finish schedules with explicit unassigned states;
- cutlist, nesting and floor/skirting quantities generated from the same
  approved scene; and
- a revision/sign-off page that makes pending verification visible.

Dimensions are either measured, derived from approved measured geometry,
reference-only, or unverified. Only measured or approved derived geometry can
be marked approved for production. Unverified sheets must say **not for
construction** and cannot be silently upgraded by a render or an image.

## 3D presentation package

The 3D package communicates finishes, lighting, proportions and client intent.
It may include room perspectives, material boards and before/after revisions.
It must identify the scene revision and camera, preserve door/window openings,
sill heights, skirting and fixed geometry, and remain visually reviewable. It
is never the fabrication source and must not replace the 2D production package.

## Template quality bar

Each generated sheet carries a persistent title block: project/client,
drawing/wall identifier, revision, scene version, sheet index, scale or
`NTS`, units, author/checker, status, and provenance. A sheet must use neutral
`TO BE CONFIRMED` labels for missing material, client, reviewer or measurement
information. Sample project names, material codes, addresses and approval
labels must never appear in a real project document by default.

Before client issue, ULTIDA renders a PDF sample and performs visual review for
title-block overflow, dimension legibility, clipped callouts, page counts and
status labels. Before factory issue, the compiler also reconciles bay totals,
openings/keep-outs and component records against the exact approved scene.

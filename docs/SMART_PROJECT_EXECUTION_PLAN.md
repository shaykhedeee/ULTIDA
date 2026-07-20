# ULTIDA Smart Project Execution Plan

## Product contract

ULTIDA is a white-label, multi-tenant operating system for modular interior studios. It converts a client brief and floor plan into a reviewed spatial model, modular design, visual proposals, drawings, commercial package, and production handoff.

The authoritative chain is:

`intake -> floor_plan_version -> spatial_model_version -> scene_version -> render/drawing/BOM/quote/delivery artifacts`

AI may propose or enhance. It may never silently become measured geometry or production truth.

## Golden release scope

Prove one modular kitchen and one living room through:

`brief -> source upload -> calibration -> reviewed plan -> approved scene -> modules -> AI visual proposal -> elevations/DXF -> cutlist -> quote -> delivery`

## Build gates

### Gate 0: Hosted foundation

- Supabase Auth, organizations, membership RLS and private Storage are live.
- Every project belongs to exactly one organization.
- Every original upload is immutable and registered as a project asset.
- No service role key is present in the browser.

### Gate 1: Plan intelligence review

- Upload PNG, JPEG, PDF, DXF and DWG.
- Preserve the original file and create a draft plan version.
- Offer image preprocessing, OCR, wall/opening/room proposals and confidence.
- Provide a full-canvas manual editor for calibration, walls, openings, rooms, dimensions and intent markers.
- Require critical review resolution before approval.
- Store reviewed and approved plan versions separately.

### Gate 2: Scene materialization

- Generate `scene.v1` only from an approved plan version.
- Keep typed rooms, walls, openings, furniture modules, materials, appliances, services, lights and clearances.
- Validate Indian modular kitchen, wardrobe, TV unit, sofa and circulation rules.
- Make every scene mutation create a new draft version and stale downstream artifacts.

### Gate 3: Modular design and visual proposals

- Place parameterized catalog modules against room boundaries.
- Link material, hardware, SKU and production metadata to each module.
- Generate visual proposals through the provider gateway with source scene, camera, masks, prompt, provider, seed, cost and approval state recorded.
- Label all AI visuals as proposals until approved; do not claim dimensional fidelity from a prompt-only image.

### Gate 4: Drawings and production

- Use one server-side drawing projection and DXF writer.
- Generate floor plans, elevations, reflected ceiling plans, vector PDFs, schedules, BOM and cutlists from the approved scene.
- Block production exports from draft or stale scenes.

### Gate 5: Commercial and delivery

- Produce scene-linked estimates, GST quotations, variation orders, vendor comparisons and purchase orders.
- Assemble client packs with explicit render, drawing and quote versions.
- Capture approval, production release, installation, warranty and service history.

## Architecture rules

- React remains light: canvas interaction, project state and API calls only.
- DXF generation, OCR/CV, nesting, rendering and document work run as Node/Python jobs.
- All jobs have stable IDs, idempotency keys, progress, cancellation, retries and provenance.
- SQLite is only a transitional developer adapter; production writes go through a database interface to Supabase Postgres.
- API origin is configured once through `VITE_API_BASE`; Supabase browser configuration uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- AI providers are server-side adapters with truthful unavailable states and no silent stock-image fallback.

## First engineering sequence

1. Apply and verify the hosted Supabase migrations.
2. Finish authenticated organization onboarding and project persistence.
3. Extract the Plan Review canvas into an isolated component with tests.
4. Add manual calibration, walls, openings, rooms, dimensions and intent markers.
5. Add deterministic plan-analysis jobs, then AI/CV proposals with confidence.
6. Persist reviewed/approved spatial model versions.
7. Materialize `scene.v1` and begin kitchen/living-room fixtures.

## Release acceptance tests

- A user in organization A cannot read organization B data or files.
- A source plan upload is immutable and traceable to its project and author.
- A low-confidence wall or room blocks plan approval.
- A scene cannot be created from an unapproved plan.
- A scene edit marks linked render, drawing, cutlist and quote artifacts stale.
- Kitchen and living-room fixture dimensions agree across scene, elevation, DXF and cutlist.

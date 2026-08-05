# Ultida Implementation Status

Updated: 2026-07-28

This is a factual implementation inventory for the active Ultida repository.
It separates code that has been verified locally from work that remains blocked
by hosted configuration or unfinished lineage.

Day 1 repository gates: all 23 Ultida workspace TypeScript checks passed,
the root build passed, and the root test matrix passed. The API DXF fixtures
were updated to provide complete authoritative `scene.v1.moduleParts`; no
production fallback or migration was added.

## Verified Locally

### Floor-plan analysis

- The durable `plan-analysis` job path downloads the private source asset,
  rasterizes a PDF where required, calls a configured vision provider, runs the
  local OpenCV wall tracer, and persists provider provenance to `ai_runs`.
- Vision proposals use a source-relative `0..1000` grid. The job now converts
  those coordinates into the actual raster pixel space before reconciliation
  with OpenCV output.
- A CV wall is marked `confirmedByBothPasses` only when a vision wall aligns in
  position, angle, and segment overlap. High confidence alone is not evidence
  of agreement.
- The provider prompt requests only visible evidence. It no longer mandates a
  generic number of walls, rooms, openings, or dimensions.
- The focused analyzer suite has passed with 23 tests, including the local
  Python/OpenCV extraction fixture and reconciliation mismatch cases.
- Completed durable analysis output now persists both `plan_analyses` provider
  evidence and an editable `plan_analysis_drafts` record containing the
  proposals and review issues, so Plan Review can restore the same analysis on
  refresh.
- The Brief now captures lifestyle, storage, kitchen, material, appliance/
  service, Vastu, and approval constraints. These fields are passed into the
  analyzer as contextual requirements without overriding source geometry.

### Scene and render foundation

- `@ultida/scene-compiler` rejects a scene that lacks an approved plan rather
  than inventing rooms or walls.
- The deterministic render pipeline and its tests are present. Technical
  preview and photoreal output remain separate states.
- The browser scene preview can only become authoritative after approved plan
  geometry, persisted module anchors, and persisted material assignments are
  present in the same version lineage.
- Module placement now resolves its position and rotation from an approved
  canonical wall on the server. It persists `space_id`, rejects invalid
  dimensions, stale room lineage, and modules that would extend past a wall.

### Libraries

- `@ultida/catalog-core` contains seeded Indian modular templates for kitchen,
  wardrobe, TV, crockery, study, pooja, utility, bed, dining, and sofa use
  cases.
- `@ultida/module-framework` contains deterministic compilers for TV, wardrobe,
  kitchen, crockery, study, pooja, bed, and utility module parts.
- The Design Library screen now reads the catalog API, saved studio references,
  and the project material library. It no longer displays fabricated inventory
  counts or example cards as live data.

## Not Yet Verified or Complete

### Hosted environment

- No additive migration has been applied to a staging or production Supabase
  project in this implementation pass.
- Vercel Preview has been verified to boot the API health route, but its vision
  and image provider secrets are not configured. A real hosted analysis cannot
  succeed until an authorized provider key is safely configured server-side.
- The Cloudflare AI worker has not been deployed because its configured API
  base URL needs a verified hosted API endpoint and shared dispatch secret.
- Browser end-to-end testing is pending an available Chromium runtime and an
  authenticated non-production project.

### Authoritative scene lineage

- Existing module compilers produce exact parts. The module-instance API now
  persists real wall/room anchors, and the scene compile path now places those
  exact cabinet parts into `scene.v1` and the deterministic perspective base
  renderer. Spaces Studio still needs to expose offset, collision,
  opening-clearance, and module-edit controls before every template can be
  composed professionally.
- Material assignments are persisted through the API, but older Design Studio
  controls still contain visual-only arrays that must be retired from project
  behavior.
- Render QA remains intentionally `completed_with_warnings` until it compares
  the produced image with the deterministic base render using actual evidence.

## Immediate Next Milestones

1. Apply and test the additive library/module-anchor migration in a dedicated
   staging Supabase project.
2. Configure one server-only vision provider in Vercel Preview, then run a
   real PNG and PDF analysis smoke test that records `ai_runs` provenance.
3. Persist module anchors from Spaces Studio, compile the resulting parts into
   `scene.v1`, and validate the Three.js preview against canonical millimetre
   geometry. The server-side anchor and scene-part compilation path is now
   covered locally; interactive browser validation remains pending Chromium.
4. Replace remaining static Design Studio finish arrays with the project
   material library and material assignments.
5. Add image-based render QA before any photoreal render can be auto-approved.

## Tooling Notes

- The installed NaCl diagnostic skill was invoked in read-only mode, but its
  packaged bootstrap cannot run because `vendor/smol-toml-1.7.0.cjs` is missing
  from the plugin bundle. Repository tests and source contracts remain the
  current evidence source until that plugin packaging issue is repaired.
- FastAPI Cloud was evaluated and intentionally not introduced: Ultida already
  has an Express API, Supabase authorization model, and Cloudflare worker path.
  A second backend would duplicate ownership rather than make the renderer or
  analyzer more reliable.
- On 2026-07-28 the local Vite application responded successfully at
  `http://127.0.0.1:5177/projects`, but Playwright could not launch because the
  expected `chromium_headless_shell-1228` executable was still absent after a
  browser-install attempt. Rendered browser QA remains blocked until that
  executable is available.

## Safety Rules

- A generated image never changes canonical geometry.
- No provider failure may return a synthetic success or a previous render.
- Stable Storage paths and version IDs are persisted; signed URLs are temporary
  access mechanisms only.
- Production deployment requires staging migration, API/worker smoke tests,
  and an authenticated browser journey on a dedicated test project.

# Ultida enhancement and verification plan

Updated 12 November 2026. This plan supplements the supplied market launch report with inspected code and runtime evidence.

## Product outcome

Ultida should open to the designer's active work, show the next action for every project and room, store or link each issued file, preserve explicit approvals, and make furniture easy to find and place. A successful release includes a real authenticated project journey that survives reload and a second session.

## Findings checked

| Priority | Finding | Evidence | User impact |
|---|---|---|---|
| Critical | Scene preparation contains automatic layout approval and default furniture creation | apps/web/src/App.tsx, saveScene block around lines 1388–1411 before changes | Building a preview can record decisions the designer did not approve |
| Critical | Local ComfyUI lacks required models | localhost:8188 system_stats and object_info, 12 November; CPU device, zero checkpoint and ControlNet models | Installed application cannot run Ultida's current SDXL workflow |
| Watch | ComfyUI status reports configuration as Online | apps/web/src/features/tools/RenderLauncher.tsx | Users receive an inaccurate readiness signal |
| Watch | Provider environment names differ | apps/api/src/env-config.ts uses COMFYUI_URL, gateway uses COMFYUI_BASE_URL | Diagnostics disagree with actual configuration |
| Watch | Furniture filters map Washrooms to utility and highlight All Categories incorrectly | apps/web/src/components/library/ReferenceLibraryWorkspace.tsx | Wrong furniture appears and active selection is unclear |
| Watch | Project workflow tracker is hosted separately | apps/web/src/Shell.tsx Studio Workspace link and separate Sites database | Existing Ultida project records and tracker records require manual linking |
| Watch | Drive integration is absent from the inspected application routes | Search of apps/api/src and apps/web/src | Uploading to Drive from Ultida requires an integration; a saved URL provides access only |
| Watch | Factory helper claims exceed release evidence | ProductionWorkspace helper functions and production-release-authority.ts | Machine import compatibility needs validation against the target machine |
| Info | Production database is reachable and healthy | Supabase project ichnyfuetcucxhxilnre, schema inspection | Native workflow can use existing project IDs and organization access |
| Info | Reliability contract and preflight pass | npm run validate:reliability and npm run preflight, 12 November | Hosting and tracked-secret checks pass; authenticated journeys still require separate verification |

## Delivery sequence

### 1. Native project pipeline and files

Add a Pipeline & Files entry for the studio and within each existing project. Reuse existing project and room identifiers. Include task title, stage, status, owner, next action, dependencies, assumptions, missing information, priority, estimated minutes and due date. Use Pending, In progress, Waiting for client, Revision needed, Approved and Complete. New work begins Pending.

Provide project and room filters and direct links back to Brief, Rooms, 3D, Drawings and Estimate. Keep progress derived from saved records. Report save failures and protect concurrent edits.

File records should support both private uploads and HTTPS links to Drive or other document services. Record title, category, room, revision, owner and notes. Show whether the item is an uploaded file or an external link. Download uploaded files through authorized signed URLs. Store new revisions separately so the prior approved design remains available.

Acceptance:
- Create a task in an existing project and room, update it, reload and verify persistence.
- Open the same task in another session and verify conflicts do not silently overwrite changes.
- Upload a PDF or DXF, reload and download the same bytes.
- Save a Drive URL and open the linked document under the user's Drive permissions.
- Confirm another organization cannot read or modify the records.
- Confirm a file or task save never silently approves geometry or production.

### 2. Furniture library and placement

Use independent room and furniture-category filters, catalog-derived counts, search and a clear reset action. Include kitchens, wardrobes, TV units, pooja units, crockery, shoe storage, vanities, beds, bedside units, seating, tables, desks, shelving, utility and room-specific fixtures where supported by actual catalog records.

Each item should expose dimensions, compatible room types, variant, source and actual production support. Placement should retain editable width, depth, height and offset and validate wall openings and clearances. An empty category should explain why there are no matching items.

Acceptance:
- Every catalog item can be found through its actual family.
- Search and room/category filters combine consistently.
- Reset clears every active filter.
- A selected item places into the intended room, saves and reopens with the same dimensions.
- Retail reference assets show their actual licensing and fabrication limitations.

### 3. Explicit approvals and revision history

Remove silent layout approval from scene preparation. Make saving, compiling, approving and releasing distinct user actions. Record approver, date, exact version and decision notes. Show current approved files alongside newer draft revisions.

A change to approved geometry must produce a new draft or invalidate downstream release eligibility. Preserve the original approved version and explain which downstream work requires review.

Acceptance:
- Building a 3D scene cannot create an approval record by itself.
- A newer draft does not replace the current approved render source.
- Production export is checked against the reviewed exact panel snapshot and fabrication rules.
- A failed save produces a visible retry action and leaves the prior approved work usable.

### 4. ComfyUI setup and rendering

Current observation: server responds on localhost:8188; ComfyUI reports version 0.43.0 and a CPU device; required model lists are empty.

First inventory available graphics hardware and supported execution backend. Select a workflow that fits that hardware, then install compatible checkpoint and conditioning models and verify their licenses and storage requirements. Inspect workflow node names against object_info. Run one small test, then a measured room render with depth or edge conditioning and compare the result against the source scene.

Ultida should distinguish configuration, reachability, missing models, queued, running, failed and complete. Display job errors and retain a retryable job record. Completion means the rendered image was stored and opens after reload.

The hosted Vercel app needs a reachable authenticated rendering service or a local worker that retrieves authorized jobs. A loopback URL on the hosted server cannot reach the desktop installation. Keep credentials server-side and preserve project authorization.

Acceptance:
- Reachability and required models are verified before accepting a render job.
- One real render completes, stores an image and links it to the exact scene version.
- Cancel, failure, retry and duplicate submission preserve consistent job state.
- The production rendering path is verified independently of the local desktop path.

### 5. Drive connection

The first usable file workflow is private Ultida uploads plus saved Drive file/folder links. Add direct Drive uploading and browsing through the user's authorized Google account as a subsequent integration.

Direct integration needs server-side OAuth, encrypted refresh-token storage, least-privilege scopes, explicit folder selection, per-user connections, expired-connection recovery and upload retries. Retain Drive file IDs and web links. Preserve existing sharing settings. Provide Open in Drive and Reconnect actions.

Acceptance:
- Upload to the selected folder and verify the resulting Drive file and link.
- Reconnect an expired session without duplicating files.
- Show revoked or inaccessible links clearly.
- Verify organization and user access independently from possession of a URL.

### 6. Daily planning and studio overview

Build a studio overview across native project tasks. A default 120-minute session selects ready tasks ordered by priority and due date, excludes waiting-client and unresolved dependencies, and explains missing estimates. Permit the designer to choose available time and owner. Record actual completion explicitly.

Show overdue work, client confirmations, missing site measurements, draft revisions and upcoming handovers. Keep owner and next action visible without opening several screens.

### 7. End-to-end release verification

Use a representative project with confirmed room dimensions and actual source documents. Exercise intake, rooms, library placement, explicit layout approval, scene compilation, rendering, drawings, revision, client confirmation and handover. Reload between stages and repeat on a smaller screen.

Verify uploads and downloads, access controls, concurrent editing, empty states, unavailable services and retry behavior. Run affected tests plus check/build. Manufacturing compatibility requires a target-machine import and reviewed dimensions before describing an export as factory-ready.

## Boundaries of the earlier launch report

Passing build and unit tests is evidence for the tested code paths. Preflight verifies folder existence, tracked secret patterns and the hosting contract. The existing online smoke script checks API health, deployment identity and the HTML entry point. These checks do not establish every authenticated project journey, image generation, Drive upload or machine-specific CNC import.

The report's claims of 100% reliable compilation and complete launch readiness should be replaced with measured results for the acceptance criteria above.

## Implementation record

Updated 12 November 2026:

1. **Explicit Approvals & Removal of Silent Layout/Module Creation (`Section 3`)**:
   - **`apps/web/src/App.tsx` (`saveScene`)**: Removed the fallback block that automatically created spaces, design inputs, layout candidates, approved layouts (`POST /layouts/:id/approve`), and inserted default furniture modules (`wardrobe-1800-three-shutter`, `kit-base-600`, `tv-unit-1800-floating`) when `savedModules.length === 0`. Compiling a 3D scene now strictly requires saved room furniture and an explicitly approved layout.
   - **`apps/web/src/features/spaces/SpacesWorkspace.tsx` (`Review in 3D`)**: Removed the silent `quickFurnishRoomSuite` and direct `onReviewSavedRoom` bypass inside the 3D review handler so `prepareRoomReview` governs saving, layout approval, and scene compilation explicitly.

2. **Furniture Library & Washroom/Bathroom Filtering Fixes (`Section 2`)**:
   - **`apps/web/src/components/design/catalog-room-filter.ts`**: Added `bathroom: new Set(['utility', 'storage', 'lighting'])` to `roomFamilyAllowlist`.
   - **`apps/web/src/components/library/ReferenceLibraryWorkspace.tsx`**: Updated `moduleSupportsRoom` to normalize `'washroom'` / `'toilet'` to `'bathroom'` and match vanity/washroom modules without conflating laundry utility units. Added `'bathroom'` to `washroom-shutter-vanity-900` in `DEFAULT_MODULAR_CATALOG`. Enhanced module cards to display SKU, catalog source (`ULTIDA Modular Catalog` vs `IKEA India Retail Reference (BOQ only)`), compatible rooms, and explicit `cutlistSupported` fabrication badges.

3. **ComfyUI Environment Alignment & Live Readiness Diagnostics (`Section 4`)**:
   - **`apps/api/src/env-config.ts`** and **`packages/provider-gateway/src/index.ts`**: Unified environment variable handling so both `COMFYUI_BASE_URL` and `COMFYUI_URL` are recognized across server validation, `getProviders()`, `executeComfy()`, and `pollTaskStatus()`.
   - **`apps/web/src/features/tools/RenderLauncher.tsx`**: Updated the ComfyUI & Render Provider Diagnostics card to distinguish environment configuration (`Env configured (verify live reachability)`), live browser probe status (`Probe Live ComfyUI & Models` against `127.0.0.1:8188/object_info/CheckpointLoaderSimple`), missing checkpoint models (`Missing checkpoint models`), and configured cloud fallback providers.

4. **Native Project Pipeline, Revision History, Drive Links & 120-Minute Daily Session Planner (`Sections 1, 5, 6`)**:
   - **`apps/api/src/pipeline-routes.ts`** and **`apps/api/src/index.ts`**: Added authenticated studio and project pipeline endpoints (`GET /api/studio/pipeline`, `GET /api/projects/:projectId/pipeline`, `PUT /api/projects/:projectId/pipeline`) backed by `projects.delivery_records` and reusing `projects` and `spaces` identifiers. Enforces optimistic concurrency (`expectedVersion` -> `409 PIPELINE_VERSION_CONFLICT` on concurrent edits), validates `https://` URLs on external Google Drive/document links, signs private uploaded assets from `project-assets`, and guarantees that saving tasks or files never mutates or approves geometry or production records.
   - **`apps/web/src/features/pipeline/PipelineWorkspace.tsx`**, **`apps/web/src/Shell.tsx`**, and **`apps/web/src/App.tsx`**: Added the native **Pipeline & Files** workspace at `/pipeline` and `/projects/:projectId/pipeline`. Includes:
     - Studio overview counters derived from saved records (Overdue Work, Waiting for Client, Missing Site Info, Draft Revisions, Upcoming Handovers).
     - Configurable **Daily Session Planner** (default `120` minutes, owner filter, priority and due-date sorting, automatic exclusion of `Waiting for client` and unresolved dependencies, missing-estimate warnings, and 1-click `Mark Complete`).
     - Stage deliverables & tasks (new tasks default to `Pending`, with stage, room, owner, next action, dependencies, assumptions, missing site information, priority, estimated minutes, and due date).
     - Revision-preserved files & Google Drive links (`External Drive / HTTPS Link` vs `Uploaded Studio Asset`, revision tags `REV-1`/`REV-2`, and explicit `Draft` / `Pending Review` / `Approved` / `Superseded` status tracking).

5. **Verification Executed**:
   - `npm run build:packages` & `npm run check`: Passed across all 18 packages and 5 apps (`@ultida/api`, `@ultida/web`, `@ultida/worker`, `@ultida/cloudflare-ai-worker`, `@ultida/aura-tools`).
   - `npm run test:core`: Passed (`@ultida/catalog-core`, `@ultida/design-core`, `@ultida/geometry-core`, `@ultida/layout-core`, `@ultida/material-core`, `@ultida/module-framework`, `@ultida/plan-core`, `@ultida/provider-gateway`, `@ultida/render-pipeline`, `@ultida/rule-core`, `@ultida/scene-compiler`, `@ultida/scene-core`, `@ultida/spaces-core`, `@ultida/commercial-core`, `@ultida/drawing-core`).
   - `npm run test:api`: Passed (including new `apps/api/test/pipeline-routes.test.ts` covering default `Pending` task generation, revision preservation, and `COMFYUI_BASE_URL` / `COMFYUI_URL` alignment).
   - `npm run test:rooms`, `npm run validate:reliability`, `npm run preflight`, and `npm run build`: All passed.

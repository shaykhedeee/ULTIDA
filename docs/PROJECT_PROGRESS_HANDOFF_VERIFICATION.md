# Project Progress handoff verification

The implementation starts from main at 7cba9e11c86e03c56d7d83c7b7e9d6e4cec75964. The Vercel API reports its last ready production deployment as dpl_6zrE16xZMdWcyXoXfWQfGKBoTocf. PR #4 at 7f8e73b0d4f10f83c15ff929b7bca2abd917b997 adds a separate window bridge. It remains open. Its Reliability check failed and its Vercel status reports Account is blocked.

| Check | Evidence |
| --- | --- |
| Revision round | The API test uses two editors and two rooms. It verifies that a cross-room parent is rejected, one concurrent save wins, and the approved file is retained. |
| Designer journey | The Chromium test uses mobile dimensions and fixture authentication and storage. It attaches a revised PDF, saves the change and next action, and reloads the previous approved link and new version. |
| Existing assets and AURA | Project Progress can link an existing project asset without uploading it again. AURA reads recent changes and next actions through the same authenticated pipeline endpoint. |
| Offline rendering | The measured kitchen fixture includes an opening and a saved camera. The job executes the deterministic pass and QA, writes to fixture storage, registers the asset and artifact, then reloads the image link through the gallery. A missing camera returns RENDER_CAMERA_NOT_IN_SCENE before the provider call. An offline finish edit changes pixels only in the selected unit mask, passes QA, and reloads alongside the original from the same scene revision. |
| First hosted failure | GET https://ultida.vercel.app/api/health returned HTTP 402, DEPLOYMENT_DISABLED, request cle1::5fgvg-1795806022956-92b37256651f. The request stopped before authentication, scene lookup or job creation, so there is no hosted job ID or scene revision to report. |
| Release gate regression | Local reliability on 41bbe43 failed in catalog-construction.test.ts because the retail IKEA 880 mm unit received a 900 mm fabricated carcass. The retail catalog envelope fix passed the targeted construction suite. |

The production rollback reference is the last ready deployment above. This candidate uses the existing project pipeline and asset schemas. Hosted acceptance still needs a working Vercel account, an isolated writable environment, authenticated designer walkthroughs, and the agreed render budget before a paid run.

Remaining handoff scope includes explicit round records and dated activity, draft recovery across refresh, automatic generated-artifact registration with full job lineage, real-time catch-up, shared AURA write commands, legacy D1 import mapping, and the observed pilot metrics.

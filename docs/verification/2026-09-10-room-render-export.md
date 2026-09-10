# Room, rendering and production verification — 2026-09-10

Baseline main verified directly on GitHub: `6af865427241520ff919840b52d4b17443d1b9c5`.

## Repairs

- Island envelopes include both 40 mm waterfall legs. Invalid dimensions, drawer counts and excessive overhangs are rejected before placement. This is dimension certification, not full manufacturing certification of every island component.
- Prepared custom dimensions survive navigation and are scoped to the chosen project. Saved placement requires a calibrated plan, a real room wall and clearance validation. Accepted changes invalidate previous scenes, artifacts and quotes.
- Room suggestions are distinct from persisted module instances. The module picker can select a request from the preceding room layout and retain its exact dimensions. Generic room names are not classified by area alone.
- Browser elevation previews use a browser-safe drawing entry point rather than importing Node streams and Excel compression. Production route tabs retain their intended destinations.
- Compiler cameras use the renderer's Y-up camera convention, originate at the room center and target the first room module. A depth buffer prevents wall/floor painter-order errors hiding furniture.
- Opening QA counts only projected camera-visible opening masks. This verifies a view, not every opening behind the camera. Actual RGB furniture visibility is checked before provider submission; provider images still undergo image QA and remain subject to review.
- Opening gap limits scale with the detector working resolution; collinear intervening walls no longer create false gaps. Unknown thickness remains unknown during coordinate restoration.

## Reproducible verification

The API test `golden-room-outputs.test.ts` builds a measured 4000 × 3000 mm room with a 900 mm door and a 1200 mm window with a 900 mm sill. It serializes/reloads placement and scene, reconciles bays, checks actual cabinet pixels and generates a 7-panel workbook, SVG/DXF drawings, labels and a four-page PDF. Outputs are written to `.tmp-golden-room/` when the test runs. These are fixture artifacts, not an approved client project or AI-generated photographs.

Commands used:

```text
npm run check
npm run build
npm run build:apps
npm run test:api
npm run test:rooms
npm run test:render
npm run test:drawing
npm run test:providers
npm test --workspace=@ultida/scene-compiler
npm test --workspace=@ultida/module-framework
python apps/api/cv/test_wall_tracer.py
```

Recorded focused results: module-framework 23 passed; scene-compiler 15 passed; render suite 22 passed; drawing suite 25 passed; room tests 14 passed plus 4 browser tests passed; OpenCV 3 passed. Resolution comparison in a common coordinate space: 14 walls / 6072.8 px versus 13 walls / 5997.8 px (about 1.2% total-length difference). The PDF was opened and rasterized successfully for inspection.

## Live verification still required

The inspected Singhania Royal Villa project has unconfirmed scale and no persisted scene version. A known dimension and its two endpoints must be confirmed before production approval. No client geometry or scene approval was fabricated. No live paid provider call was made. Cloudflare reported configured and eligible; a successful hosted AI image and authenticated production export still need verification after a valid scene exists.

Other remaining work: reference-image provenance through the provider request, full editable island interior certification, concave-room camera selection, occlusion-aware semantic QA, and the remaining screen simplification. This patch is not a claim that the entire application or all supplied reference drawings are certified.

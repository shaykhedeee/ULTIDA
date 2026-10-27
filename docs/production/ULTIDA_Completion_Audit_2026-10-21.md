# ULTIDA: verified changes and remaining product work

This is a continuation of `docs/ULTIDA_Strategy_and_Gap_Audit_2026-10-17.md`, not a claim that every furniture system, supplier or machine is supported. User authorized implementation of the existing F01–F06 roadmap and deployment. Changes retain the canonical saved scene and existing review fingerprint.

## Gemini conversation reconciliation

Read the public conversation at https://share.gemini.google/W7IcHCxu0n4t (resolved conversation 581de2b9e7ad), titled “Ultida Modular Design Optimization”. It describes an additional `ULTIDA_Enhanced_v2_Complete_Package.zip`, Excel workbook and Canvas prototype. Public extraction exposed descriptions and filenames, not the ZIP contents, workbook or Canvas source. The earlier conversation link https://share.gemini.google/0knBabNrcuOl could not be fetched. No access to other private chats was obtained.

Claims in that conversation are requirements or examples until matched against executable code. In particular, its 116 panels, 28 sheets, 75.2% yield, prices and CNC compatibility are not validated outputs for a real ULTIDA project. It also overgeneralizes competitors: Coohom and Infurnia have manufacturing offerings. Do not market ULTIDA as superior without a controlled same-project comparison.

## Implemented change design

- Optional, validated `surfaceRecipe` on saved scene module parts: process (`prelaminated` or `laminate_after_cut`), ordered nullable A/B faces, supplier finish code, thickness, grain direction, allowance and laminate stock dimensions. Null means explicitly bare; absent recipe means unresolved.
- Snapshot copies those exact facts. Existing canonical review fingerprint includes them, so changed finishes invalidate a prior manufacturing review.
- Prelaminated core nests isolate ordered recipes. Loose laminate blanks are independently expanded from physical panel IDs, enlarged by twice the per-edge allowance, grouped by finish/thickness/stock/grain, and nested independently. Core and laminate quantities remain separate. Width-grain faces rotate relative to stock X; conflicting prelaminated face grain is rejected. No “zero waste” or optimality guarantee.
- QR labels encode version/project/saved-scene/physical-panel identity. They contain no credential and grant no access. Decoder test rasterizes an SVG and uses an independent QR decoder, including a Unicode ID. Spreadsheet payload matches SVG payload.
- Finish editor writes a new draft scene through a project/role-authorized API. It does not mutate an approved scene. Review the new design then approve its production panels. Recompiling changed geometry requires reassignment/review of finishes; this release does not infer finishes from visual textures.
- Excel includes face recipes, laminate sheet requirements and per-face placements. Board nesting includes ordered recipe metadata. Missing assignments remain explicit. SVG laminate export blocks until every panel has an assigned recipe or explicit bare faces.
- Project dossier checks the active approved floor plan and the expected canonical rooms, selects each room's latest saved approved scene, rejects overlapping scene sets or newer drafts, and checks production authority per scene. It attaches a JSON source manifest and combines the scene documents. Available approved, nonstale renders are loaded from caller-authorized project storage and linked to their exact saved scenes. Missing render sections are labeled incomplete. No room is silently omitted to make the export succeed.
- Nesting rejects nonfinite/invalid stock, negative or fractional quantities, invalid panel dimensions and duplicate physical IDs.
- Live floor-plan diagnostic no longer crashes merely because `.env` is absent and no longer silently targets a hard-coded sample project. It accepts an explicit project and API base.

## User flow

1. Brief and site measurements → upload floor plan.
2. Local detector/OCR or AI-assisted interpretation → verify scale, room polygons, openings and wall dimensions.
3. Approve the measured plan → configure room scope, place modules and save layouts.
4. Compile a room scene → review exact geometry → approve scene.
5. Cutlist & Drawings → Assign laminate faces → select physical panels and process → save new draft → approve revised scene.
6. Review all physical panels, stock rules and hardware. Download draft artifacts until the manufacturing review is valid.
7. Export Excel, QR stickers, core nests, laminate cutouts and scene PDF. Export whole-project dossier only when every room has a current approved scene. Approved renders are included when available.
8. Execute workshop trial, record dimensions, scans, material recipes and dry assembly. Signed workshop acceptance remains separate from software/scene review.

## Local versus hosted runtime

Browser is the interface in both cases; Vercel is the hosting choice. A separate installed offline desktop product was not found in this checkout.

| Capability | Local development browser | Vercel browser |
|---|---|---|
| Start/sign-in/demo shell | Tested HTTP 200, no page exceptions | Tested HTTP 200, no page exceptions |
| Deterministic floor-plan detection | 59 pipeline tests passed; packaged OCR/Sharp | Same code path is deployed; authenticated upload still requires a real session/test project |
| Saved projects and release documents | API and Supabase required; no local credentials configured here | Existing configured API/Supabase deployment |
| Internet-disconnected browser reload | Failed; no service worker | Failed; no service worker |
| AI-assisted analysis and renders | External provider access required | External provider access required |
| Heavy/long image work | Suitable for development/worker execution | Current serverless function limit is 60 seconds; long work belongs in durable jobs/workers |

A single cold-ish navigation measured 2368 ms locally and 1657 ms hosted in this execution environment. Different builds, network and caches make this unsuitable as a performance ranking. Recommend Vercel for normal multi-user studio work, local development for debugging/tests and a separate worker for long jobs. True offline project editing needs a local data store, authenticated sync/conflict handling and a packaged analysis runtime; changing a button label does not deliver it.

## Verification scope

- Floor-plan unit/integration pipeline: 59 passed, including real raster fixture, wall/opening candidates, OCR, image preprocessing and coordinate reconciliation. These fixtures do not establish accuracy across arbitrary scans.
- Focused production/export suite: 80 passed at the first complete checkpoint, including existing DXF/PDF/Excel/review gates and new nesting/QR/manifest tests.
- New authenticated API integration test: finish recipe saved into a new draft; foreign panel rejected; two-room project PDF generated; newer draft blocks project export. Supabase is mocked in this test.
- Synthetic measurement-validator tests exercise empty data, matching measurements and invalid/nonfinite measurements. They are not a workshop trial.
- Final full build/test/deployment results are recorded in the release receipt, not inferred from these checkpoints.
- NaCl graph-backed verification unavailable: no project-local `nacl_neo4j` MCP was configured (`BLOCKED/PROJECT_MCP_NOT_CONFIGURED`). No graph proof or NaCl certification is claimed. Conventional code/test evidence was used.

## Remaining gates and high-value enhancements

1. **Physical workshop acceptance:** pending operator measurements and signed cut/assembly trial. See `workshop/README.md` and `workshop/measurements.csv`.
2. **Authenticated hosted journey:** verify a real account's plan upload → approval → finish assignment → reapproval → multiroom export on the deployed version. Mock API tests do not replace this.
3. **All-room scope:** a room without a compiled approved scene blocks a whole-project dossier. Add an explicit signed “out of design scope” record for spaces that should be excluded, rather than silently skipping bathrooms/corridors.
4. **Library quality:** certify furniture families against recipes and supplier hardware data; cover drawers, corners, lofts, sliding systems, service voids, fillers and installation tolerances with assembly-level fixtures. Catalog labels alone are not certification.
5. **Manufacturing dimensions:** document raw/cut/finished dimensions per recipe. Current exact geometry must be reviewed as cut geometry; no universal edge subtraction is safe. Add per-panel edge deductions, machining operations and laminate thickness build-up with recipe-specific tests before claiming finished-size accuracy.
6. **Stock and nesting:** core stock dimensions still come from fabrication rules; laminate stock is per face. Add offcut inventory, defect zones, matching/sequencing, machine-specific cut order and objective benchmarks before CAM release.
7. **Printable media:** current SVG uses 100 mm × approximately 52.38 mm labels, two columns. Add printer presets/pagination and verify actual thermal media. SVG labels are separate from Excel's identity table.
8. **QR shop workflow:** encoded identity works; a phone scanning JSON does not yet open a dedicated authenticated installation/dispatch tracker. Build scan lookup and status events as a separate workflow.
9. **Dossier scaling:** large multiroom documents can exceed serverless execution/memory limits; move heavy project assemblies into durable export jobs with persisted immutable manifests. Current render images must be PNG/JPEG and no larger than 20 MB each. SVG/WebP need normalization before inclusion.
10. **Floorplan benchmark:** use permissioned scanned, low-contrast, rotated, dimension-dense and multipage plans; measure room/wall/opening recall, scale error, human correction time and false approvals. Preserve mandatory human scale/geometry approval.
11. **Competitor benchmark:** same residence, same cabinet recipes, same finishes and hardware, same output checklist. Compare correction minutes, document completeness, workshop exceptions, render fidelity and total cost against Coohom/Infurnia and a production CAD tool. Avoid unsupported “best app” claims.

## Final local verification (2026-10-21)

`npm run check`, `npm run build`, and `npm test` exited 0. Full JavaScript run: 600 passed, 1 optional skip, 0 failures. Two additional QR/grain regressions added afterward passed in a focused seven-test run. `PYTHONPATH=workers/elevation python -m pytest workers/elevation/tests -q`: 6 passed. `git diff --check`, secret scan and diagnostic-script syntax check passed. Browser runtime comparison is recorded in `ULTIDA_Runtime_Comparison_2026-10-21.json` in the delivery artifacts. GitHub push still returns HTTP 403; local commit/bundle preserves the change independently of direct Vercel deployment.

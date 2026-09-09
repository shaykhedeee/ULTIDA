# Remaining prompts 11–23: implementation ledger

Updated 2026-09-09. This is a delivery ledger, not a completion claim.

Local baseline: `287d75714d6b50a072becfc704a24af732037539 fix: derive boq from approved production parts`.
Remote verification on this date: main `852abd8f13119a68e1fd8f7698f2370b4b1bbc82`; recovery `127593e2725a634faf98f1b9d22fd0e6a571afd8`.
These are different histories; reconcile before publishing. Preserve concurrent UI and laminate edits.

## Implemented repairs in this working tree

- Provider requests distinguish `conditioningIntent: reference` from strict control requirements. Missing intent never silently converts controls into references.
- The live render job explicitly sends reference guidance for ordinary renders, with the existing scene version, technical artifacts, and image QA retained. Existing records need no migration.
- Mask editing and typed conditioning are rejected before network calls until an adapter is verified. This deliberately prevents material swaps from pretending an ordinary image prompt enforces the selected region. That feature remains unavailable through this gate.
- Remote RGB sources receive the same protection as data URLs: text-only adapters cannot silently discard them. Cloudflare reference models are allowlisted.
- Dossier nesting receives numeric stock dimensions, kerf and trim from the production snapshot. One calculation supplies sheet counts and yield. A typed snapshot prevents the previous object-as-number mistake from compiling.
- Dossier regression fixture now uses a back panel that fits stock; oversized physical panels must continue to fail rather than being silently resized.

## Work remaining from the attachment

| Prompt | Status and next acceptance evidence |
| --- | --- |
| 11 Kitchen | Shared side panels exist. Full appliance envelopes, service voids, hardware and min/nominal/max manufacturing certification still need implementation and checks. |
| 12 TV | Separate compiler exists. Certify actual floating heights, slat solids, cable voids and profile/glass geometry through cutlist and elevations. |
| 13 Other families | Shared carcass tests exist. They do not certify complete joinery, hardware or vector-cuttable jaali. Add per-family rules and measured fixtures. |
| 14 GLB ingestion | Implement authenticated upload, bounded parsing, quarantine, approval and pinned asset version; retain image moodboards separately. Not delivered by the laminate expansion. |
| 15 Analyzer modes | Separate extraction, cleanup and proposed layout contracts; preserve the original and require separate approval for changed geometry. |
| 16 OCR attachment | Attach dimensions to candidate endpoints using orientation and proximity; conflicts remain review-required. No inferred scale may become measured truth. |
| 17 Golden dataset | Require five held-out examples with independently reviewed measurements and persisted benchmark output. Existing tests alone do not demonstrate real scan accuracy. |
| 18 Rasterization | Implement and test near-plane clipping and per-pixel depth. No z-buffer completion claim from this repair. |
| 19 Provider profiles | Safety gate implemented; full versioned per-provider capability profiles, resolution/seed contracts and certified strict-control adapters remain. |
| 20 Certification gate | Connect production eligibility to persisted catalog version and live bay reconciliation. Visual-only objects must be explicitly excluded with a disclosed report. |
| 21 Client delivery | Implement scene-bound share/comment/approve/revoke; prove revocation against actual storage access, not just hidden buttons. |
| 22 Tenant isolation | Run authenticated two-tenant database/storage journeys. Local mocked API tests cannot prove deployed RLS. |
| 23 Live wiring inventory | Generate export/caller and API-route inventory; independently inspect dynamic dispatch before declaring code dead or removing it. |

## Connected sequence

1. Finish family certification and persist exact template/material versions.
2. Validate measured plan, room openings and bay schedules; accepted edits invalidate dependent approval and artifacts.
3. Compile the immutable scene and generate deterministic views from it.
4. Run image rendering with truthful provider capabilities and review status. Never use AI pixels as fabrication geometry.
5. Revalidate live scene/certification before dossier, workbook, labels and nesting exports.
6. Bind client approval and share access to that exact revision; prove revocation and tenant isolation.

## Verification

Verified this working tree: `npm run build:packages` exit 0; API TypeScript check exit 0; `npm run test:providers` 3 passed, 0 failed; affected API tests 14 passed, 0 failed; full `npm run test:api` exit 0 with 29 passing test files and 3 skipped tests. Skipped checks remain unverified. `git diff --check` exit 0 (line-ending warnings only).

Run provider tests with `node --test packages/provider-gateway/test/conditioning-safety.test.mjs` after building contracts/provider-gateway.
Run API type checking and affected architecture/dossier tests, then the full API suite.
The sandbox's Windows account lookup causes tsx `uv_os_get_passwd ENOMEM`; the same runner works outside the sandbox. Do not record that sandbox startup failure as a product assertion failure.
No hosted generation, database migration, production deployment or new pushed commit has been demonstrated by these local repairs.

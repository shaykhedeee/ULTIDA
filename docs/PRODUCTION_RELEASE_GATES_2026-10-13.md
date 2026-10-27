# Current status — October 14

See KITCHEN_APPROVAL_TRANSACTIONS_2026-10-14.md for the current implementation and evidence. AI/quotation persistence, transactional saves and visibility/mask checks have since been implemented and tested locally. The following October 13 record is historical; hosted release and physical acceptance remain outstanding.

# ULTIDA production release gates

## Verified implementation versus required live proof

| Gate | Current evidence | Required before release |
|---|---|---|
| Source recovery | Catalog duplication reconciled; initial integration and this enhancement are packaged together | Apply only on stated base or review conflicts on current main |
| Build/type contracts | Node 24, package builds from initial integration, final application builds and API/web checks pass | Required CI on exact candidate commit |
| Non-browser web behavior | Final suite: 131 passing tests, no failures/skips | Real interaction and responsive visual review |
| Moodboard editor | 25 layout/source/export-guard tests pass | Real drag/touch, signed-image PNG and print/PDF checks |
| Board storage and swatches | 14 persistence/isolation/concurrency tests pass | Apply migration to verified staging; test RLS with two real organizations |
| API | Full suite passes; one existing optional Chromium smoke test skips | Mandatory Chromium and authenticated end-to-end tests |
| Rendering substrate | 25 rendering and five provider-conditioning tests pass | Actual configured provider output, camera/mask fidelity and approved QA evidence |
| Floors/cameras/resources | Saved floor, camera and GPU ownership tests pass | Visual comparison with a measured room and repeated GPU-memory monitoring |
| Production/quoting | Existing authoritative drawing/cutlist tests retained; exact-part quote preview and kitchen evidence gates included | Reviewed physical kitchen, matching downloads and persisted commercial approvals |
| Publication/deployment | Local commits and recovery artifact only; prior GitHub writes returned 403 | Repository write permission, tested CI and exact-commit deployment |

Chromium downloads failed earlier with invalid archives. Browser catalog tests remain unexecuted successfully. Do not skip or relabel those tests to obtain a release verdict.

## Golden measured-kitchen acceptance journey

1. Upload a real plan, enter a known measured scale, independently cross-check it and review walls/openings. Preserve the original evidence and uncertainty statuses.
2. Save a kitchen space, room requirements, wall bays and flooring. Refresh and verify exact persisted measurements.
3. Generate proposals from real module-template IDs, compare clearance/collision results and explicitly select one. Persist AI-selection lineage rather than inferring it from a chat or image.
4. Edit cabinetry and regenerate exact components. Verify width/offset/mounting height, shutter divisions, interior dimensions, fillers, lofts and appliance voids.
5. Assign actual Merino product/finish identities, appropriate board thickness and verified fitting articles. Validate Hettich/Ebco envelopes with manufacturer data; do not manufacture generic drilling coordinates.
6. Attach permitted sample images, make the moodboard, save revision 1, reload, edit and save revision 2. Two simultaneous saves must surface a conflict. Another organization's request must be denied.
7. Compile/approve the exact scene, restore its saved camera, generate a real render and a component-targeted material revision. Inspect geometry/camera mismatches. Board, visual and production approvals remain distinct.
8. Export plan, elevations/sections, component schedule, cutlist, substrate/laminate/edge quantities and nesting. Compare part identities, net dimensions, grain, kerf, trims and quantities across formats.
9. Persist a properly priced scene-linked quotation with rate units/effective dates, labour, markup and tax. Unpriced entries must block commercial approval. The current draft calculator is not quote persistence.
10. Sign out/in, refresh and reopen every stage; confirm exact selected room, revisions and sources. Test expired sessions, failed writes, interrupted render jobs, cancellation, stale assets and retry handling.
11. Obtain factory review of production-enabled modules and exact parts. Unsupported curved/pocket/jaali/machining operations require explicit review, not automatic certification.
12. Run health/environment/commit checks and deploy only the exact tested candidate. Verify isolation before any Preview write; keep production rollback available.

## Remaining features that cannot be honestly marked complete

- Persisted plan-grounded AI-selection approval and versioned customer quotation workflows: the kitchen evidence endpoint intentionally keeps those absent gates blocked.
- Calibrated image QA and mask visibility for every supported material slot; guaranteed geometry-preserving AI output is not established. Current Cloudflare inputs are image references.
- Transactional job/artifact render review and transactional source-lock validation for multi-user board saves.
- Large-project pagination, durable render-resume/cancellation canaries and measured mobile/GPU performance budgets.
- Full supplier-rights/asset manifests, physical color/texture calibration, exact hardware installation profiles and workshop certification.
- Authenticated hosted browser journeys and staged migration/RLS verification.

These are release tasks, not claims hidden behind successful unit tests. An attractive board or a green build does not certify production outputs.

## Rollout and rollback

Keep the candidate on its integration branch. First review migration compatibility on the actual staging schema and retain database backups. The migration is additive; board rows are immutable. Disable the moodboard route/UI or revert the enhancement commit if live checks fail; retain existing board history. Revert the original integration commit only if its independent regression gates fail. Do not delete client data or replay legacy migrations as a shortcut.

No paid infrastructure, Supabase paid branches, hosted migrations or remote deployment were performed in this session.

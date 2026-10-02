# Visual workflow audit — 2026-10-03

## Evidence and scope

Inspected the authenticated candidate at `ultida-e532wc7fy-shays-projects-4d072282.vercel.app`: Rooms & Spaces, open furniture catalog, empty 3D scene, Documents & Cutlist, and Design Library. This deployment predates the latest opening fixes. Screenshots show the observed deployment, not the new local changes. Client screenshots remain local and are not included in the Git commit.

This is a partial screen audit. No claim is made that every screen, every image, mobile interaction, placement/save action, render or export has been validated.

## Findings and implemented fixes

1. **Spaces starts with two introductions and two page headings.** On a 1440x900 viewport the canvas begins below most of the first screen. Removed the wrapper hero and draft notice; the actual workspace retains its heading and instructions. This gives the plan more immediate vertical space without changing placement logic.
2. **Layout ideas imply verified geometry.** Static 93%, 91% and 96% “Valid” scores and “Applied & Verified” buttons have no supporting per-layout measurement evidence. Replaced them with “Design idea” / “Selected idea” / “Use this idea”. Clearance figures are now labelled targets rather than measured results.
3. **Empty 3D claims readiness.** The project has no compiled scene, but its empty state says configured units are ready. Replaced that promise with a saved-room preparation instruction and a plain “Prepare 3D room” action. The server compilation gate remains authoritative.
4. **Production failure states read as success.** Red checklist rows say “Scene approved” and “All parts reviewed (0/0)” with check icons. Rows now state approval/review needed and no panels loaded, using warning icons when unmet. Styled the recovery button consistently.

## Next fixes, in priority order

- Verify room-only Fit Room framing: the inspected canvas still shows adjacent rooms cropped at its right edge. Test actual zoom, pointer conversion and save coordinates before changing framing math.
- Keep a single preparation action in the empty 3D state, with advanced camera/storey/lighting controls revealed only after scene creation. Remove duplicate actions only after equivalence is proven.
- Correct stage progress to saved completion rather than navigation: merely opening 3D changed the displayed completion count while no scene existed.
- Reduce the library's upload-first emphasis: browsing by room and furniture family should come first; optional reference upload should be secondary. Verify project context remains present when returning to Spaces.
- Audit Plan Review, render/finish tabs, commercial delivery, AURA, and each standalone tool separately. Check empty/loading/error/permission states and keyboard operation.
- Recheck screenshots on the deployed updated candidate at desktop/mobile sizes. No visual compliance or accessibility certification is inferred from a build.

## Verification

- `npm run build --workspace=@ultida/web`: exit 0; TypeScript and Vite passed. Existing large Three.js chunk warning remains.
- Spaces open catalog: 35 loaded image elements, no completed image with zero natural width. This covers only that observed state.
- No project geometry or approvals were changed during this audit.

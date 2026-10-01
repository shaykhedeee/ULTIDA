# Focused room workflow implementation

## Implemented in this working tree

- Save room bay schedules and floor surfaces in `spaces.settings_json.designInputs` through an authenticated project endpoint. No new database migration is needed.
- Validate measurements, duplicate identities, floor room ownership and measured wall ownership before saving.
- Invalidate existing scene approvals, artifacts and quotes before accepting a saved design edit. Reject a concurrent room write instead of overwriting it.
- Compile using persisted room design inputs. A browser draft or caller-supplied schedule cannot replace the saved design.
- Scope the compiled room shell, walls and openings to the selected room. Reject furniture belonging to another room and missing wall identity.
- Reload server inputs in Spaces. Keep browser drafts separate from saved design authority.
- Save room requirements and design inputs through the existing Save room action; a failed second save is reported as incomplete.

## Verification

- API TypeScript check: exit 0.
- Web TypeScript check: exit 0.
- Scene compiler build: exit 0.
- Scene compiler tests: 21 passed, 0 failed.
- Room design input tests: 3 passed, 0 failed.
- Focused API scene/preflight/revision tests: 9 passed, 0 failed.
- API test runner: exit 0.

## Acceptance still required

These code checks do not prove a hosted signed-in journey. Run against the deployed candidate using one dedicated project:

1. Upload and calibrate a plan; edit a door/window and save/reload it.
2. Select one required room; save bays, flooring, module sizes and materials. Reload in a second session.
3. Review that room in 3D, including openings and floor finishes, and approve it.
4. Generate and reload an actual provider image, recording its input scene revision and QA status.
5. Download drawings, workbook, labels, nesting and dossier; compare panel IDs and revision markers.
6. Change one measurement and verify earlier approval and downloads are stale.

Further UI simplification, held-out analyzer benchmarks and hosted production-package verification remain open. Do not mark launch complete from this local test pass.

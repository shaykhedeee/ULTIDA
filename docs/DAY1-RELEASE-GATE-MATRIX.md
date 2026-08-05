# Day 1 Release Gate Matrix

Updated: 2026-07-28

| Gate | Result | Evidence |
| --- | --- | --- |
| Individual workspace type checks | PASS | 23 `@ultida/*` workspaces completed with `tsc --noEmit` exit 0 |
| Root build | PASS | `npm.cmd run build` completed; API, worker, web, and package builds succeeded |
| Root test matrix | PASS | `npm.cmd test`; every TAP suite reports `# fail 0` |
| API DXF/elevation/cutlist contract | PASS | `apps/api/test/dxf.test.ts` uses complete authoritative `scene.v1.moduleParts` |
| Cutlist authority | PASS | `apps/api/test/cutlist-authority.test.ts`; missing parts fail visibly |
| Render provider provenance | PASS locally | Render-pipeline tests require actual provider/model provenance and terminal failure states |
| Fake analyzer/render fallback | PASS locally | Provider-not-configured and invalid-output tests reject synthetic success |
| Local Brief and plan-review draft refresh | PASS locally | Versioned `ultida-brief-*` and `ultida-plan-draft-*` browser storage restores editable review state; it does not create an approved plan |
| Local authoritative plan approval | BLOCKED BY DESIGN | Approval requires authenticated Supabase persistence and an immutable source asset |
| Supabase migration application | UNVERIFIED | No staging or production migration was applied in Day 1 |
| Real provider smoke test | UNVERIFIED | Requires authorized staging provider credentials and an external fixture upload |
| Cloudflare queue consumer | UNVERIFIED | Worker deployment and hosted API dispatch endpoint are not verified |
| Browser E2E | BLOCKED | Chromium executable and authenticated staging project are unavailable |

## Scope Classification

The dirty tree is grouped by domain: contracts and schemas; API/analyzer and
jobs; Spaces/layout/module anchors; catalog/materials; scene compiler and
render pipeline; production drawings/cutlists; web workspaces; Cloudflare and
Vercel configuration; migrations; tests; and documentation. Existing user
changes were preserved. The only files changed for the Day 1 contract repair
are `apps/api/test/dxf.test.ts`, this matrix, and the implementation-status
notes.

## Generated Output Review

`.day1-api-test.log` and `.day1-root-test.log` were audit-only logs and are
excluded from the worktree. `tmp_test_out.json`, `tmp_test_source.png`,
`eng.traineddata`, and the untracked `api/` directory were not removed because
their ownership or runtime role was not proven from this pass. They remain
explicitly unclassified follow-up items rather than being silently deleted.

## Release Decision

Local repository gates are green, including refresh-safe local Brief and
plan-review drafts. This is not a production-release approval:
hosted Supabase, provider, Cloudflare, and authenticated browser gates remain
open. No migration or deployment should be promoted until those gates pass.

# Release candidate checklist

Status: canonical release gate for the Codex stabilization branch.

ULTIDA is not release-ready merely because local implementation exists. A candidate may merge to `main` only after every repository gate passes on the exact commit and the hosted evidence below is recorded.

## Automated pull-request gates

- Clean install from `package-lock.json`
- Python CV dependency installation
- Reliability contract validation
- Secret and canonical-hosting preflight
- TypeScript checks for every workspace
- Production builds for packages and applications
- API and AURA test suites
- Required Chromium API smoke test; CI must fail rather than skip when Chromium is unavailable
- Node 24 build parity between CI and Vercel
- Preview writes remain blocked until `ULTIDA_DATABASE_ENVIRONMENT=preview` and branch-specific Supabase variables are configured
- In the no-cost workflow, Preview remains deliberately read-only and must report `previewDatabaseIsolated: false`

The authoritative local equivalent is:

```text
npm ci --include=optional --no-audit --no-fund
npx playwright install chromium
ULTIDA_REQUIRE_BROWSER_E2E=true PUPPETEER_EXECUTABLE_PATH=<chromium-path> npm run reliability
```

## Hosted release gates

- Record the exact commit SHA and Vercel Preview deployment URL.
- Confirm `/api/health` reports the expected commit, branch, deployment environment, database environment, and database project reference.
- Complete authenticated desktop, tablet, and mobile journeys against that Preview.
- Complete three representative Guided + Auto plans.
- Complete one plan manually with all AI providers unavailable.
- Refresh and resume persisted Spaces, layout, modules, materials, and scene state.
- Compile and approve one scene linked to the approved plan and module/material lineage.
- Generate one Cloudflare render and one component-specific laminate revision; exercise approve and reject.
- Download and reopen PDF, SVG, DXF, SketchUp Ruby, BOM, cutlist, nesting, and labels; verify MIME type, filename, and source scene version.
- Prove cross-organization API and private-storage access are denied.
- Confirm durable jobs reach a terminal state or remain covered by a valid lease and heartbeat.
- Promote the tested Preview artifact without rebuilding from another commit.

## Merge and release decision

- Require the `Reliability / verify` check on the Codex-to-main pull request.
- Do not bypass a failed or skipped gate.
- Record hosted evidence in the pull request or linked release record.
- Merge only the reviewed candidate commit.
- Tag the accepted merge as a release candidate before production promotion.

Open hosted gates remain tracked in `docs/STANDALONE_FIRST_COMPLETION_MATRIX.md`. Historical status reports do not override this checklist.

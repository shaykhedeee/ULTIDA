# Online-only development

ULTIDA uses the existing free hosted services and does not require a locally deployed application or a paid Supabase branch.

## Environments

### Vercel Preview

- Builds every Codex-branch commit remotely.
- Runs UI, public API, bundle and health verification.
- Uses the canonical Supabase project only for read operations.
- Mutating API requests fail with `PREVIEW_DATABASE_NOT_ISOLATED`.
- Must report `previewDatabaseIsolated: false` from `/api/health` in free mode.

### GitHub Actions

- Installs dependencies on an ephemeral runner.
- Runs checks, builds and tests without requiring a local runtime.
- Runs the mandatory Chromium API smoke test.
- Can verify an exact Vercel URL through the manually dispatched `Online Smoke` workflow.
- Uses the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET` to access protected Preview deployments; the value is never committed.

### Production

- Is the only hosted environment allowed to mutate the canonical Supabase project.
- Receives only a reviewed Vercel Preview artifact promoted without rebuilding.
- Uses a dedicated test organization for minimal post-promotion smoke data.

## Change sequence

1. Edit code without starting a local application server.
2. Commit and push the Codex branch.
3. Wait for GitHub Reliability and Vercel Preview builds.
4. Inspect the exact Preview build logs and `/api/health` identity.
5. Run the Online Smoke workflow for that deployment URL and commit SHA.
6. Review UI routes and read-only API behavior on Preview.
7. Promote only after repository checks and human review pass.
8. Run tightly scoped authenticated production smoke tests and remove their test records through application-supported cleanup.

## Database changes

- Never edit the production schema from the Supabase Dashboard.
- Every database change begins as a reviewed migration file.
- Reconcile existing migration history before adding another migration.
- Validate migration SQL structurally in CI. Until a free disposable database is available, database-changing releases require explicit review and a rollback migration before promotion.
- Do not use the unrelated `campin` project for ULTIDA testing.

## Cost boundary

- Do not create a paid Supabase branch.
- Do not add paid monitoring, databases or provider services without explicit approval.
- Prefer the existing Vercel Hobby project, public-repository CI, Supabase project and platform logs.

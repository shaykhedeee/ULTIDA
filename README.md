# ULTIDA

ULTIDA is a measured interior-design operating system. Approved plan and scene versions own dimensions; AI providers create replaceable visual proposals.

## Canonical runtime

- `apps/web`: React/TypeScript/Vite designer workspace
- `apps/api`: Node/TypeScript API facade
- `apps/worker`: durable job worker boundary
- `packages/*`: shared contracts and domain engines
- `supabase`: database migrations and access policies

## Start

1. Copy `.env.example` to `.env` and add local Supabase publishable values.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://127.0.0.1:5173`.

If port `5173` is already occupied, Vite may start the web workspace on the next available port. Use the URL printed by Vite in the terminal.

Provider keys are optional. Missing providers are shown as unavailable and never replaced with an unrelated stock image.

## Reliability and release status

Run `npm run reliability` before proposing a merge. Pull requests and pushes to the active stabilization branches run the same checks in GitHub Actions, with the browser smoke test made mandatory.

Local implementation is not production proof. Use `docs/RELEASE_CANDIDATE_CHECKLIST.md` for the automated and hosted gates that must pass on the exact commit before merging to `main` or promoting a deployment.

The default development workflow is online-only and uses read-only Vercel Previews without a paid Supabase branch. See `docs/ONLINE_ONLY_DEVELOPMENT.md`.

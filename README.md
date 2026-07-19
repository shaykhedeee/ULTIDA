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

Provider keys are optional. Missing providers are shown as unavailable and never replaced with an unrelated stock image.

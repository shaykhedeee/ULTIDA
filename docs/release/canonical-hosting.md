# ULTIDA canonical hosting

This repository is permanently attached to the following hosted resources:

- Supabase project: `ichnyfuetcucxhxilnre`
- Supabase URL: `https://ichnyfuetcucxhxilnre.supabase.co`
- Supabase organization: `dccrbflpctxqkjtjkyvl`
- Vercel project: `ultida` (`prj_qxLAZcq3pwrnokL8K10tr8EretRt`)
- GitHub owner/repository: `shaykhedeee/ULTIDA`

## Required Vercel variables

Set these for Production and Preview. Keep publishable variables safe for the browser; never use service-role or secret credentials with a `VITE_` prefix.

```text
VITE_SUPABASE_URL=https://ichnyfuetcucxhxilnre.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_URL=https://ichnyfuetcucxhxilnre.supabase.co
SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
VITE_API_BASE=/api
```

If Vercel shows only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, the browser may initialize Supabase but the API will still report Supabase as not ready. The API requires the server-side `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` variables in the same Production and Preview scopes.

`CLOUDFLARE_AI_TOKEN`, `OPENROUTER_API_KEY`, Supabase secret keys, and any `stk_...` credential are server-only values. Do not put them in `VITE_*` variables and do not commit them.

## Integration rule

Do not provision or switch to another Supabase project. If Vercel reports `Resource provisioning failed`, repair the existing Supabase integration attachment or set the variables above manually in the ULTIDA Vercel project. The Vercel MCP available to this workspace can inspect deployments but cannot mutate integration connections or reveal secret environment values.

## Release verification

1. Confirm the Vercel deployment target is Production and the build completes past integration provisioning.
2. Open `/api/health` on the deployment and confirm `status: ok` and `readiness.supabase: true`.
3. Sign in and create a test project; confirm it persists after refresh.
4. Run the Brief → Plan → Design → Production flow and verify the project remains on this Supabase project.

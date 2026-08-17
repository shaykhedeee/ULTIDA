# Free & Low-Cost Tools to Get ULTIDA Past the Initial Demo

Scoped deliberately to fit your own committed architecture decisions from
the Production Completion Roadmap — Cloudflare as the single automatic
hosted AI platform, no OpenAI auto-fallback, Gemini opt-in only after a
funded health check. I'm not suggesting you contradict that; I'm filling in
the free/cheap tooling *within* it, plus the non-AI tooling that plan
already implies but doesn't name.

**One honest caveat up front:** exact free-tier limits (request counts,
daily quotas, storage caps) change often enough that I don't want to hand
you specific numbers I can't verify right now and have you build around a
number that's already stale. Where a limit matters, I say "check the
current number on [provider]'s pricing page" instead of guessing.

## Already in your stack, already free — the important reminder

Before adding anything: **you already have Three.js, OpenCV, and your own
DXF/PDF writers, all free and already working.** The deterministic base
render (Three.js scene → screenshot) that your roadmap correctly says
should happen *before* any paid/rate-limited AI call is the highest-value
free thing you have — it costs zero API calls and lets a user validate
geometry before anything expensive runs. Don't let "get free AI tools" 
distract from finishing that path first; it's the cheapest possible demo.

## AI / rendering (fits your Cloudflare-first rule)

- **Cloudflare Workers AI** — already your committed provider. Check
  `developers.cloudflare.com/workers-ai/platform/pricing` directly for the
  current free daily allowance rather than trusting a remembered number —
  this changes. `@cf/black-forest-labs/flux-2-klein-*` (already referenced
  in your own docs) supports image-input conditioning, which is exactly
  what you need for scene-locked material/laminate revision, not just
  text-to-image.
- **Depth/edge/mask generation for ControlNet-style conditioning** — you
  don't need a paid service for this. Depth maps and edge maps can be
  generated directly from your Three.js scene (depth buffer read, or a
  simple Sobel/Canny pass in OpenCV on the rendered frame) — free, local,
  deterministic, and more accurate than an AI-estimated depth map since
  you already have the real geometry.

## OCR (for dimension text extraction in the plan analyzer)

- **Tesseract** (via `pytesseract` in Python, or `tesseract.js` in
  Node/browser) — fully free, open source, runs locally, no API calls,
  no rate limits. This is what should read dimension text like "3820" or
  "12'-6\"" off an uploaded plan — genuinely a better fit than sending
  every plan to a paid vision API just for text extraction, since OCR is
  a narrower, cheaper, more accurate tool for that specific job. Reserve
  the vision-LLM call for semantics (room labels, door/window
  identification), not digit-reading — this is the same "right tool for
  the right half of the job" split your wall_tracer.py already embodies.

## Design system / UI (all free, open source)

- **shadcn/ui + Radix UI + Tailwind** — free, and per the Agent B teardown
  earlier in this conversation, this is very likely their actual stack
  too (their asset CDN path reveals a Lovable build, which defaults to
  this exact combination). Matching their tooling here isn't copying
  their product, it's using the same free, well-built primitives everyone
  in this space uses instead of hand-rolling worse ones.
- **Lucide icons** — free, consistent icon set, already common in
  shadcn-based apps.
- **React Three Fiber** (`@react-three/fiber` + `@react-three/drei`) —
  free, and gives you a much less imperative, more maintainable Three.js
  scene layer than raw Three.js if `apps/web` isn't already using it.
  Worth checking before adding — if the current viewport is raw Three.js
  and working, don't rewrite it just for this; only adopt R3F for new
  viewport work going forward.
- **Recharts** — free, for the dashboard's financial/status charts your
  roadmap section 5 describes.

## Free tiers already underpinning your stack

- **Supabase** — free tier exists for Postgres + Auth + Storage; you're
  already on it. Check current row/storage/MAU limits on Supabase's
  pricing page before you scale past demo, since those numbers do change.
- **Vercel** — free Hobby tier for the frontend; you're already on it.
  Same caveat — check current bandwidth/build-minute limits before
  assuming headroom.
- **Cloudflare Workers/Queues** — free tier exists for the request
  volume a demo needs; same caveat on exact current limits.

## What NOT to add for the demo phase

- Don't add a paid render-farm service (Replicate, fal.ai, RunPod, etc.)
  before your Cloudflare + deterministic-base-render path is actually
  working end to end — your own roadmap is right that reliability of one
  path beats optionality across three half-working ones.
- Don't add OpenAI as a "just for now" fallback because it's easy to
  wire — your roadmap explicitly rejected this, and reversing it quietly
  because a demo felt slow undermines the actual architectural decision.
  If Cloudflare's free tier genuinely isn't enough for a real demo, that's
  a paid-Cloudflare-tier conversation, not an add-a-second-provider one.

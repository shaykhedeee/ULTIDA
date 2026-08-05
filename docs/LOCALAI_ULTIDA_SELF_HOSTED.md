# LocalAI self-hosted rendering for ULTIDA

ULTIDA can use a private LocalAI server for **new concept renders**. It is an optional server-side provider, never a browser integration. Cloudflare remains the hosted route; ComfyUI remains the local choice for geometry-locked material changes, relighting and inpainting.

## What this provider does

- Sends a new-render prompt to LocalAI's OpenAI-compatible `POST /v1/images/generations` endpoint.
- Accepts either `b64_json` or a result URL and persists the render through ULTIDA's normal job/artifact lineage.
- Does not accept source images and is deliberately unavailable for restage, material-swap, remove-object, relight or enhance operations.

## Private setup

Run LocalAI on a studio-controlled workstation or server. The official LocalAI quickstart publishes port `8080`; do not expose it publicly. Reach it from the ULTIDA API via a VPN or authenticated private tunnel.

Set only server-side environment variables in local API hosting and Vercel (when Vercel can reach your private endpoint):

```text
LOCALAI_BASE_URL=https://localai.your-private-network.example
LOCALAI_API_KEY=<optional LocalAI API key>
LOCALAI_IMAGE_MODEL=<the exact installed LocalAI image model name>
LOCALAI_IMAGE_SIZE=1024x1024
LOCALAI_TIMEOUT_MS=120000
```

Never set these variables with a `VITE_` prefix. Do not point production Vercel at `http://127.0.0.1:8080`; that address resolves to Vercel itself, not your workstation.

## Verify

1. Confirm the LocalAI model is installed and can generate one image through its own endpoint.
2. Add the variables above to the API environment.
3. Redeploy Preview and open **Settings → Providers**. “LocalAI self-hosted image generation” must show Ready.
4. Create a disposable **new render**. The rendered job must report `provider: localai` and the exact model name.
5. Test a laminate swap. ULTIDA must skip LocalAI and use ComfyUI or Cloudflare instead; that is intentional geometry protection.

# ComfyUI local rendering for ULTIDA

## Purpose

ComfyUI is an optional studio-local render engine for image-conditioned work where the approved room shell, openings, cabinetry and camera must stay locked. It is not required for ULTIDA to run: Cloudflare FLUX.2 remains the hosted fallback.

Use ComfyUI only on a GPU workstation controlled by the studio. Do not expose its normal web port directly to the public internet.

## What ULTIDA sends

For a render job, ULTIDA creates a deterministic scene image plus depth, edge and material-region maps. A ComfyUI workflow can opt into them with these string placeholders in its API-format JSON:

| Placeholder | Use |
| --- | --- |
| `{{sourceImage}}` | Required for an image-conditioned, geometry-locked workflow. Connect to the main Load Image node. |
| `{{depthMapImage}}` | Optional depth/control input. |
| `{{cannyEdgeMapImage}}` | Optional line/edge-control input. |
| `{{materialKeyMapImage}}` | Optional material-region mask/control input. |
| `{{prompt}}`, `{{negativePrompt}}`, `{{style}}` | ULTIDA’s reviewed render brief. |

ULTIDA uploads each requested image to ComfyUI before posting the workflow. If `{{sourceImage}}` is absent, the workflow is never selected for a locked material change, restage, relight, enhancement or removal request.

## Safe studio setup

1. Install ComfyUI on the dedicated GPU workstation, open a known-good inpainting/ControlNet workflow, and verify it locally first.
2. Use **Save (API Format)** to export the workflow JSON.
3. Replace the relevant Load Image names with the placeholders above. At minimum, the source image loader must use `{{sourceImage}}`.
4. Reach the workstation from the ULTIDA API through a private VPN or an authenticated tunnel; never by opening an unauthenticated public ComfyUI port.
5. Set these **server-only** variables in the environment that runs the ULTIDA API. Never use `VITE_*`:

```text
COMFYUI_BASE_URL=https://your-private-comfy-endpoint
COMFYUI_API_KEY=only-if-your-authenticated-proxy-requires-it
COMFYUI_WORKFLOW_JSON=<the complete single-line API-format workflow JSON>
```

6. Submit one `material-swap` from a disposable project and confirm the job moves from `queued` to `completed`, with the same wall, opening and cabinet divisions as the source scene.

## Provider policy

1. ComfyUI first for locked visual revisions only when the three variables above are complete and its workflow includes `{{sourceImage}}`.
2. Cloudflare FLUX.2 second as the hosted fallback.
3. Do not use text-only/free public endpoints for a geometry-locked revision; they cannot prove that the source layout was retained.

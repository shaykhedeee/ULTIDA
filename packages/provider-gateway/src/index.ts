import type { ProviderCapabilityStatus, VisualProposalRequest } from '@ultida/contracts';
import sharp from 'sharp';

type Environment = Record<string, string | undefined>;
type ComfyWorkflow = Record<string, unknown>;

export type ImageProviderConfig =
  | { provider: 'openai'; model: 'dall-e-3' | 'gpt-image-1' }
  | { provider: 'gemini'; model: string }
  | { provider: 'localai'; model: string }
  | { provider: 'comfyui'; workflowId: string };

export type ProviderResult =
  | { status: 'succeeded'; synthetic: false; provider: string; model?: string; image?: { encoding: 'base64'; data: string; mimeType: string }; resultUrl?: string; sourceSceneVersionId: string; operation: VisualProposalRequest['operation']; attemptedProviders: string[] }
  | { status: 'queued'; synthetic: false; provider: string; promptId: string; sourceSceneVersionId: string; operation: VisualProposalRequest['operation']; attemptedProviders: string[] }
  | { status: 'provider_not_configured'; code: 'IMAGE_PROVIDER_NOT_CONFIGURED'; message: string; retryable: false; sourceSceneVersionId: string; attemptedProviders: string[] }
  | { status: 'failed'; code: string; message: string; retryable: boolean; sourceSceneVersionId: string; attemptedProviders: string[] };

function readComfyWorkflow(environment: Environment): ComfyWorkflow | null {
  if (!environment.COMFYUI_WORKFLOW_JSON) return null;
  try {
    const parsed = JSON.parse(environment.COMFYUI_WORKFLOW_JSON);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function applyPrompt(workflow: ComfyWorkflow, request: VisualProposalRequest) {
  return applyComfyTemplate(workflow, request);
}

type ComfyUploads = Partial<Record<'sourceImage' | 'depthMapImage' | 'cannyEdgeMapImage' | 'materialKeyMapImage' | 'objectMaskImage' | 'normalMapImage', string>>;

function applyComfyTemplate(workflow: ComfyWorkflow, request: VisualProposalRequest, uploads: ComfyUploads = {}) {
  return JSON.parse(JSON.stringify(workflow)
    .replaceAll('{{prompt}}', request.structuredPrompt)
    .replaceAll('{{negativePrompt}}', request.negativePrompt ?? '')
    .replaceAll('{{style}}', request.style)
    .replaceAll('{{sceneVersionId}}', request.sceneVersionId)
    .replaceAll('{{sourceImage}}', uploads.sourceImage ?? '')
    .replaceAll('{{depthMapImage}}', uploads.depthMapImage ?? '')
    .replaceAll('{{cannyEdgeMapImage}}', uploads.cannyEdgeMapImage ?? '')
    .replaceAll('{{materialKeyMapImage}}', uploads.materialKeyMapImage ?? '')
    .replaceAll('{{objectMaskImage}}', uploads.objectMaskImage ?? '')
    .replaceAll('{{normalMapImage}}', uploads.normalMapImage ?? '')
    .replaceAll('{{depthMapUrl}}', request.conditioningMaps?.depthMapUrl ?? '')
    .replaceAll('{{cannyEdgeMapUrl}}', request.conditioningMaps?.cannyEdgeMapUrl ?? '')
    .replaceAll('{{materialKeyMapUrl}}', request.conditioningMaps?.materialKeyMapUrl ?? '')
    .replaceAll('{{objectMaskUrl}}', request.conditioningMaps?.objectMaskUrl ?? '')
    .replaceAll('{{normalMapUrl}}', request.conditioningMaps?.normalMapUrl ?? ''));
}

function comfyTemplateNeeds(workflow: ComfyWorkflow, token: keyof ComfyUploads) {
  return JSON.stringify(workflow).includes(`{{${token}}}`);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function geminiImageKey(environment: Environment) {
  return environment.GEMINI_IMAGE_API_KEY || environment.GEMINI_API_KEY || environment.GOOGLE_AI_STUDIO_KEY_1 || environment.GOOGLE_AI_STUDIO_KEY_2;
}

function localAiBaseUrl(environment: Environment) {
  return environment.LOCALAI_BASE_URL?.replace(/\/$/, '');
}

function localAiHeaders(environment: Environment) {
  return {
    'content-type': 'application/json',
    ...(environment.LOCALAI_API_KEY ? { authorization: `Bearer ${environment.LOCALAI_API_KEY}` } : {})
  };
}

function geminiAspectRatio(request: VisualProposalRequest) {
  if (request.camera?.view === 'elevation') return '4:3';
  if (request.camera?.view === 'detail') return '4:5';
  return '16:9';
}

async function readImageAsset(asset: string): Promise<Buffer> {
  const dataUrl = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(asset);
  if (dataUrl) return Buffer.from(dataUrl[2], 'base64');

  const response = await fetch(asset);
  if (!response.ok) throw new Error(`Image asset returned HTTP ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

function assetMimeType(asset: string) {
  return /^data:([^;]+);base64,/.exec(asset)?.[1] ?? 'image/png';
}

async function uploadComfyImage(baseUrl: string, asset: string, logicalName: string, environment: Environment): Promise<string> {
  const bytes = await readImageAsset(asset);
  const form = new FormData();
  form.append('image', new Blob([Uint8Array.from(bytes)], { type: assetMimeType(asset) }), `${logicalName}.png`);
  form.append('overwrite', 'true');
  const response = await fetch(`${baseUrl}/upload/image`, {
    method: 'POST',
    headers: environment.COMFYUI_API_KEY ? { authorization: `Bearer ${environment.COMFYUI_API_KEY}` } : {},
    body: form,
  });
  if (!response.ok) throw new Error(`ComfyUI image upload failed (${response.status}).`);
  const payload = await response.json() as { name?: string; subfolder?: string };
  if (!payload.name) throw new Error('ComfyUI image upload returned no filename.');
  return payload.subfolder ? `${payload.subfolder}/${payload.name}` : payload.name;
}

export function createProviderGateway(environment: Environment) {
  const getProviders = (): ProviderCapabilityStatus[] => {
    const env = environment;
    const cloudflareModel = env.CLOUDFLARE_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-2-klein-4b';
    const cloudflareFinalModel = env.CLOUDFLARE_FINAL_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-2-klein-9b';
    const cloudflareOperations: VisualProposalRequest['operation'][] = cloudflareModel.includes('flux-2')
      ? ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance']
      : ['generate'];
    return [
      { id: 'free-image-worker', name: 'Cloudflare free image worker', configured: Boolean(env.FREE_IMAGE_WORKER_URL && env.FREE_IMAGE_WORKER_API_KEY), operations: ['generate'], details: `${env.FREE_IMAGE_WORKER_MODEL ?? '@cf/black-forest-labs/flux-1-schnell'} text-to-image only; not geometry-preserving.` },
      { id: 'gemini-nano-banana-2', name: 'Gemini image generation', configured: Boolean(geminiImageKey(env)), operations: ['generate'], details: 'The current adapter is text-to-image only.' },
      { id: 'cloudflare', name: 'Cloudflare Workers AI', configured: Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN), operations: cloudflareOperations, details: `Draft/review: ${cloudflareModel}; final: ${cloudflareFinalModel} (generation and image editing)` },
      { id: 'openai-dall-e-3', name: 'OpenAI DALL-E 3', configured: Boolean(env.OPENAI_API_KEY), operations: ['generate'], details: 'DALL-E 3 does not support image editing.' },
      { id: 'openai-gpt-image-1', name: 'OpenAI GPT Image 1', configured: Boolean(env.OPENAI_API_KEY && env.OPENAI_IMAGE_MODEL === 'gpt-image-1'), operations: ['generate'], details: 'Image editing remains unavailable until the edits endpoint is connected.' },
      { id: 'localai', name: 'LocalAI self-hosted image generation', configured: Boolean(localAiBaseUrl(env) && env.LOCALAI_IMAGE_MODEL), operations: ['generate'], details: 'Optional private, OpenAI-compatible endpoint. It is used only for new renders; geometry-locked revisions stay on ComfyUI or Cloudflare.' },
      { id: 'comfyui', name: 'ComfyUI', configured: Boolean(env.COMFYUI_BASE_URL && readComfyWorkflow(env)), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'], details: 'Optional studio-local workflow. Image-conditioned operations require a {{sourceImage}} loader in the approved workflow.' }
    ];
  };

  async function executeOpenRouter(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const token = environment.OPENROUTER_API_KEY;
    const model = environment.OPENROUTER_IMAGE_MODEL ?? 'black-forest-labs/flux-1-schnell';

    if (!token) {
      return { status: 'failed', code: 'OPENROUTER_NOT_CONFIGURED', message: 'OPENROUTER_API_KEY is not configured.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'HTTP-Referer': 'https://ultida.app', 'X-Title': 'Ultida 3D Studio' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: `${request.structuredPrompt}, photorealistic interior architectural render, 8k` }],
          modalities: ['image']
        })
      });

      if (!response.ok) {
        return { status: 'failed', code: `OPENROUTER_HTTP_${response.status}`, message: `OpenRouter returned HTTP ${response.status}`, retryable: isRetryableStatus(response.status), sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string; image_url?: { url?: string } } }> };
      const choice = payload.choices?.[0]?.message;
      const imageUrl = choice?.image_url?.url;

      if (imageUrl) {
        return { status: 'succeeded', synthetic: false, provider: 'openrouter', model, resultUrl: imageUrl, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
      }

      return { status: 'failed', code: 'OPENROUTER_NO_IMAGE_OUTPUT', message: 'OpenRouter returned no image payload.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    } catch (error) {
      return { status: 'failed', code: 'OPENROUTER_FETCH_ERROR', message: error instanceof Error ? error.message : 'OpenRouter API call failed.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
  }

  async function executeCloudflare(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const accountId = environment.CLOUDFLARE_ACCOUNT_ID;
    const token = environment.CLOUDFLARE_AI_TOKEN;
    const model = request.quality === 'final'
      ? environment.CLOUDFLARE_FINAL_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-2-klein-9b'
      : environment.CLOUDFLARE_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-2-klein-4b';

    if (!accountId || !token) {
      return { status: 'failed', code: 'CLOUDFLARE_NOT_CONFIGURED', message: 'Cloudflare Workers AI is not configured.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }

    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const prompt = `${request.structuredPrompt}. Preserve the supplied room geometry, camera, openings, cabinet divisions and material regions exactly. Improve only realism, physical materials, shadows, reflections and exposure. ${request.negativePrompt ?? ''}`;
      let body: BodyInit;
      let headers: Record<string, string> = { authorization: `Bearer ${token}` };
      if (model.includes('flux-2')) {
        // FLUX.2 requires multipart input even for prompt-only generation.
        // Reference images are optional and must use the documented input_image_N names.
        const form = new FormData();
        form.append('prompt', prompt);
        form.append('width', '1024');
        form.append('height', '1024');
        form.append('seed', String(Math.floor(Math.random() * 2147483647)));
        if (request.sourceAssets[0]) {
          let sourceBytes: Buffer;
          try {
            sourceBytes = await readImageAsset(request.sourceAssets[0]);
          } catch (error) {
            return { status: 'failed', code: 'CLOUDFLARE_SOURCE_FETCH_FAILED', message: error instanceof Error ? error.message : 'The deterministic base image could not be read.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
          }
          const preparedSource = await sharp(sourceBytes)
            .rotate()
            .resize({ width: 511, height: 511, fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          form.append('input_image_0', new Blob([Uint8Array.from(preparedSource)], { type: 'image/png' }), 'ultida-base-render.png');
        }
        body = form;
      } else {
        headers = { ...headers, 'content-type': 'application/json' };
        body = JSON.stringify({ prompt, steps: model.includes('schnell') ? 8 : 4, seed: Math.floor(Math.random() * 2147483647) });
      }
      const response = await fetch(endpoint, { method: 'POST', headers, body });
      const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';

      // Workers AI normally returns the model result in its JSON envelope, but
      // some gateway/compatibility paths return the encoded image as the HTTP
      // response itself. Accept both shapes so a valid image can never be
      // mistaken for a JSON parse error and leave the UI polling forever.
      if (response.ok && contentType.startsWith('image/')) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.byteLength >= 1024) {
          return {
            status: 'succeeded',
            synthetic: false,
            provider: 'cloudflare',
            model,
            image: { encoding: 'base64', data: bytes.toString('base64'), mimeType: contentType },
            sourceSceneVersionId: request.sceneVersionId,
            operation: request.operation,
            attemptedProviders
          };
        }
      }

      const payload = await response.json().catch(() => null) as { success?: boolean; result?: { image?: string }; errors?: Array<{ message?: string }> } | null;
      if (!response.ok || !payload?.success || !payload.result?.image) {
        const errorMsg = payload?.errors?.map((e) => e.message).join(', ') || `Cloudflare returned HTTP ${response.status}${contentType ? ` (${contentType})` : ''}`;
        return { status: 'failed', code: 'CLOUDFLARE_EXECUTION_FAILED', message: errorMsg, retryable: isRetryableStatus(response.status), sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
      }

      return {
        status: 'succeeded',
        synthetic: false,
        provider: 'cloudflare',
        model,
        image: { encoding: 'base64', data: payload.result.image, mimeType: 'image/jpeg' },
        sourceSceneVersionId: request.sceneVersionId,
        operation: request.operation,
        attemptedProviders
      };
    } catch (error) {
      return { status: 'failed', code: 'CLOUDFLARE_FETCH_ERROR', message: error instanceof Error ? error.message : 'Cloudflare API call failed.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
  }

  async function executeFreeImageWorker(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const baseUrl = environment.FREE_IMAGE_WORKER_URL?.replace(/\/$/, '');
    const token = environment.FREE_IMAGE_WORKER_API_KEY;
    const model = environment.FREE_IMAGE_WORKER_MODEL ?? '@cf/black-forest-labs/flux-1-schnell';
    if (!baseUrl || !token) {
      return { status: 'failed', code: 'FREE_IMAGE_WORKER_NOT_CONFIGURED', message: 'FREE_IMAGE_WORKER_URL and FREE_IMAGE_WORKER_API_KEY are not configured.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    if (request.operation !== 'generate') {
      return { status: 'failed', code: 'FREE_IMAGE_WORKER_EDIT_UNSUPPORTED', message: 'The free image worker supports text-to-image generation only.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: request.structuredPrompt, model, steps: 8 })
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const mimeType = response.headers.get('content-type')?.split(';')[0] ?? '';
      if (!response.ok || !mimeType.startsWith('image/') || bytes.length < 1000) {
        return { status: 'failed', code: `FREE_IMAGE_WORKER_HTTP_${response.status}`, message: `The free image worker returned an invalid image response (${response.status}).`, retryable: isRetryableStatus(response.status), sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
      }
      return { status: 'succeeded', synthetic: false, provider: 'free-image-worker', model, image: { encoding: 'base64', data: bytes.toString('base64'), mimeType }, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
    } catch (error) {
      return { status: 'failed', code: 'FREE_IMAGE_WORKER_FETCH_FAILED', message: error instanceof Error ? error.message : 'Free image worker request failed.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
  }

  async function executeGeminiNanoBanana2(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const apiKey = geminiImageKey(environment);
    const model = environment.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';
    if (!apiKey) {
      return { status: 'failed', code: 'GEMINI_IMAGE_NOT_CONFIGURED', message: 'A Gemini image API key is not configured.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          model,
          input: [{
            type: 'text',
            text: `${request.structuredPrompt}\n\nNegative constraints: ${request.negativePrompt ?? 'Do not move walls, openings, or approved modules. Do not add unsupported furniture or alter measured geometry.'}`
          }],
          response_format: {
            type: 'image',
            aspect_ratio: geminiAspectRatio(request),
            image_size: request.quality === 'final' ? '2K' : '1K'
          }
        })
      });
      const payload = await response.json() as {
        output_image?: { data?: string; mime_type?: string; mimeType?: string };
        error?: { message?: string };
      };
      const image = payload.output_image;
      if (!response.ok || !image?.data) {
        return {
          status: 'failed',
          code: `GEMINI_IMAGE_HTTP_${response.status}`,
          message: payload.error?.message ?? `Gemini image generation returned HTTP ${response.status}.`,
          retryable: isRetryableStatus(response.status),
          sourceSceneVersionId: request.sceneVersionId,
          attemptedProviders
        };
      }
      return {
        status: 'succeeded',
        synthetic: false,
        provider: 'gemini-nano-banana-2',
        model,
        image: { encoding: 'base64', data: image.data, mimeType: image.mime_type ?? image.mimeType ?? 'image/png' },
        sourceSceneVersionId: request.sceneVersionId,
        operation: request.operation,
        attemptedProviders
      };
    } catch (error) {
      return { status: 'failed', code: 'GEMINI_IMAGE_FETCH_ERROR', message: error instanceof Error ? error.message : 'Gemini image API call failed.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
  }

  async function executeHuggingFace(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const token = environment.HF_TOKEN || environment.HUGGINGFACE_API_KEY;
    const model = environment.HF_IMAGE_MODEL ?? 'black-forest-labs/FLUX.1-Kontext-dev';

    if (!token) {
      return { status: 'failed', code: 'HF_NOT_CONFIGURED', message: 'HF_TOKEN or HUGGINGFACE_API_KEY is not configured.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }

    try {
      const endpoint = `https://api-inference.huggingface.co/models/${model}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          inputs: request.structuredPrompt,
          parameters: {
            negative_prompt: request.negativePrompt ?? 'changed architecture, moved walls, extra cabinets, missing shutters, distorted furniture, changed camera'
          }
        })
      });

      if (!response.ok) {
        return { status: 'failed', code: `HF_HTTP_${response.status}`, message: `Hugging Face returned HTTP ${response.status}`, retryable: isRetryableStatus(response.status), sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
      }

      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');

      return {
        status: 'succeeded',
        synthetic: false,
        provider: 'huggingface',
        model,
        image: { encoding: 'base64', data: base64Data, mimeType: 'image/jpeg' },
        sourceSceneVersionId: request.sceneVersionId,
        operation: request.operation,
        attemptedProviders
      };
    } catch (error) {
      return { status: 'failed', code: 'HF_FETCH_ERROR', message: error instanceof Error ? error.message : 'Hugging Face API call failed.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
  }

  async function executePollinations(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const model = 'flux';
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(`${request.structuredPrompt}, photorealistic interior design render, 8k, architectural lighting`);
    const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=${model}&nologo=true`;
    
    return {
      status: 'succeeded',
      synthetic: false,
      provider: 'pollinations',
      model,
      resultUrl: imageUrl,
      sourceSceneVersionId: request.sceneVersionId,
      operation: request.operation,
      attemptedProviders
    };
  }

  async function executeDallE3(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const model = 'dall-e-3';
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${environment.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        prompt: `${request.structuredPrompt}\nNegative constraints: ${request.negativePrompt ?? 'none'}`,
        n: 1,
        size: environment.OPENAI_IMAGE_SIZE || '1024x1024',
        quality: environment.OPENAI_IMAGE_QUALITY || 'standard',
        response_format: 'b64_json'
      })
    });
    if (!response.ok) {
      return {
        status: 'failed',
        code: `OPENAI_DALLE3_HTTP_${response.status}`,
        message: `DALL-E 3 generation failed (${response.status}).`,
        retryable: isRetryableStatus(response.status),
        sourceSceneVersionId: request.sceneVersionId,
        attemptedProviders
      };
    }
    const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    const output = payload.data?.[0];
    if (output?.b64_json) {
      return { status: 'succeeded', synthetic: false, provider: 'openai-dall-e-3', model, image: { encoding: 'base64', data: output.b64_json, mimeType: 'image/png' }, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
    }
    if (output?.url) {
      return { status: 'succeeded', synthetic: false, provider: 'openai-dall-e-3', model, resultUrl: output.url, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
    }
    return { status: 'failed', code: 'OPENAI_NO_IMAGE_OUTPUT', message: 'DALL-E 3 returned no image payload.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
  }

  async function executeGptImage1(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const model = 'gpt-image-1';
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${environment.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        prompt: `${request.structuredPrompt}\nNegative constraints: ${request.negativePrompt ?? 'none'}`,
        n: 1,
        size: environment.OPENAI_IMAGE_SIZE || '1536x1024',
        quality: environment.OPENAI_IMAGE_QUALITY || 'high'
      })
    });
    if (!response.ok) {
      return {
        status: 'failed',
        code: `OPENAI_GPT_IMAGE1_HTTP_${response.status}`,
        message: `gpt-image-1 generation failed (${response.status}).`,
        retryable: isRetryableStatus(response.status),
        sourceSceneVersionId: request.sceneVersionId,
        attemptedProviders
      };
    }
    const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    const output = payload.data?.[0];
    if (output?.b64_json) {
      return { status: 'succeeded', synthetic: false, provider: 'openai-gpt-image-1', model, image: { encoding: 'base64', data: output.b64_json, mimeType: 'image/png' }, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
    }
    if (output?.url) {
      return { status: 'succeeded', synthetic: false, provider: 'openai-gpt-image-1', model, resultUrl: output.url, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
    }
    return { status: 'failed', code: 'OPENAI_NO_IMAGE_OUTPUT', message: 'gpt-image-1 returned no image payload.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
  }

  async function executeLocalAi(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const baseUrl = localAiBaseUrl(environment);
    const model = environment.LOCALAI_IMAGE_MODEL;
    if (!baseUrl || !model) {
      return { status: 'failed', code: 'LOCALAI_NOT_CONFIGURED', message: 'LOCALAI_BASE_URL and LOCALAI_IMAGE_MODEL are required for the self-hosted provider.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    if (request.operation !== 'generate') {
      return { status: 'failed', code: 'LOCALAI_EDIT_UNSUPPORTED', message: 'The configured LocalAI adapter supports new renders only. Use ComfyUI or Cloudflare for geometry-locked revisions.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    try {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: localAiHeaders(environment),
        signal: AbortSignal.timeout(Math.max(5_000, Math.min(Number(environment.LOCALAI_TIMEOUT_MS ?? 120_000) || 120_000, 240_000))),
        body: JSON.stringify({
          model,
          prompt: `${request.structuredPrompt}\nNegative constraints: ${request.negativePrompt ?? 'Do not invent dimensions, walls, openings, or production furniture.'}`,
          n: 1,
          size: environment.LOCALAI_IMAGE_SIZE ?? '1024x1024',
          response_format: 'b64_json'
        })
      });
      const payload = await response.json().catch(() => null) as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } } | null;
      const output = payload?.data?.[0];
      if (!response.ok || !output) {
        return { status: 'failed', code: `LOCALAI_HTTP_${response.status}`, message: payload?.error?.message ?? `LocalAI image generation returned HTTP ${response.status}.`, retryable: isRetryableStatus(response.status), sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
      }
      if (output.b64_json) {
        return { status: 'succeeded', synthetic: false, provider: 'localai', model, image: { encoding: 'base64', data: output.b64_json, mimeType: 'image/png' }, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
      }
      if (output.url) {
        return { status: 'succeeded', synthetic: false, provider: 'localai', model, resultUrl: output.url, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
      }
      return { status: 'failed', code: 'LOCALAI_NO_IMAGE_OUTPUT', message: 'LocalAI returned no image payload.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    } catch (error) {
      return { status: 'failed', code: 'LOCALAI_FETCH_ERROR', message: error instanceof Error ? error.message : 'LocalAI image generation could not be reached.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
  }

  async function executeComfy(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const workflow = readComfyWorkflow(environment);
    if (!workflow) {
      return { status: 'failed', code: 'COMFYUI_WORKFLOW_INVALID', message: 'COMFYUI_WORKFLOW_JSON is invalid or missing.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    const baseUrl = environment.COMFYUI_BASE_URL!.replace(/\/$/, '');
    try {
      const uploads: ComfyUploads = {};
      if (comfyTemplateNeeds(workflow, 'sourceImage')) {
        if (!request.sourceAssets[0]) {
          return { status: 'failed', code: 'COMFYUI_SOURCE_IMAGE_REQUIRED', message: 'The selected ComfyUI workflow requires the locked scene image.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
        }
        uploads.sourceImage = await uploadComfyImage(baseUrl, request.sourceAssets[0], `ultida-scene-${request.sceneVersionId}`, environment);
      }
      const uploadOptional = async (token: keyof ComfyUploads, asset: string | undefined, filename: string) => {
        if (!comfyTemplateNeeds(workflow, token)) return;
        if (!asset) throw new Error(`The ComfyUI workflow requires ${token}, but ULTIDA did not create it.`);
        uploads[token] = await uploadComfyImage(baseUrl, asset, filename, environment);
      };
      await uploadOptional('depthMapImage', request.conditioningMaps?.depthMapUrl, `ultida-depth-${request.sceneVersionId}`);
      await uploadOptional('cannyEdgeMapImage', request.conditioningMaps?.cannyEdgeMapUrl, `ultida-canny-${request.sceneVersionId}`);
      await uploadOptional('materialKeyMapImage', request.conditioningMaps?.materialKeyMapUrl, `ultida-materials-${request.sceneVersionId}`);
      await uploadOptional('objectMaskImage', request.conditioningMaps?.objectMaskUrl, `ultida-object-mask-${request.sceneVersionId}`);
      await uploadOptional('normalMapImage', request.conditioningMaps?.normalMapUrl, `ultida-normal-${request.sceneVersionId}`);

      const response = await fetch(`${baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(environment.COMFYUI_API_KEY ? { authorization: `Bearer ${environment.COMFYUI_API_KEY}` } : {}) },
        body: JSON.stringify({ prompt: applyComfyTemplate(workflow, request, uploads), client_id: `ultida-${request.sceneVersionId}` })
      });
      if (!response.ok) {
        return { status: 'failed', code: `COMFYUI_HTTP_${response.status}`, message: `ComfyUI rejected the workflow (${response.status}).`, retryable: isRetryableStatus(response.status), sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
      }
      const payload = await response.json() as { prompt_id?: string; error?: string };
      if (!payload.prompt_id) {
        return { status: 'failed', code: 'COMFYUI_NO_PROMPT_ID', message: payload.error ?? 'ComfyUI did not return a prompt id.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
      }
      return { status: 'queued', synthetic: false, provider: 'comfyui', promptId: payload.prompt_id, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
    } catch (error) {
      return { status: 'failed', code: 'COMFYUI_REQUEST_FAILED', message: error instanceof Error ? error.message : 'ComfyUI could not accept the render workflow.', retryable: true, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
  }

  return {
    status: () => getProviders(),

    async pollTaskStatus(provider: string, taskId: string) {
      if (provider !== 'comfyui') return { status: 'failed' as const, reason: `Polling is not supported for ${provider}.` };
      const baseUrl = environment.COMFYUI_BASE_URL?.replace(/\/$/, '');
      if (!baseUrl) return { status: 'failed' as const, reason: 'ComfyUI is not configured.' };
      try {
        const response = await fetch(`${baseUrl}/history/${encodeURIComponent(taskId)}`, { headers: environment.COMFYUI_API_KEY ? { authorization: `Bearer ${environment.COMFYUI_API_KEY}` } : {} });
        if (!response.ok) return response.status === 404 ? { status: 'running' as const } : { status: 'failed' as const, reason: `ComfyUI history failed (${response.status}).` };
        const payload = await response.json() as Record<string, { status?: { status_str?: string; completed?: boolean }; outputs?: Record<string, { images?: Array<{ filename?: string; subfolder?: string; type?: string }> }> }>;
        const history = payload[taskId];
        if (!history) return { status: 'running' as const };
        if (history.status?.status_str === 'error') return { status: 'failed' as const, reason: 'ComfyUI reported a workflow execution error.' };
        for (const output of Object.values(history.outputs ?? {})) {
          const image = output.images?.find((candidate) => candidate.filename);
          if (image?.filename) {
            const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' });
            return { status: 'succeeded' as const, resultUrl: `${baseUrl}/view?${query.toString()}` };
          }
        }
        return { status: 'running' as const };
      } catch (error) {
        return { status: 'failed' as const, reason: error instanceof Error ? error.message : 'ComfyUI polling failed.' };
      }
    },

    async createVisualProposal(request: VisualProposalRequest): Promise<ProviderResult> {
      const requested = (request.providerPreference.length ? request.providerPreference : ['cloudflare', 'localai', 'free-image-worker', 'gemini-nano-banana-2', 'openai-gpt-image-1', 'openai-dall-e-3', 'comfyui'])
        .map((id) => id === 'openai' ? (environment.OPENAI_IMAGE_MODEL === 'gpt-image-1' ? 'openai-gpt-image-1' : 'openai-dall-e-3') : id);
      const activeProviders = getProviders();
      const hasDeterministicImageInput = request.sourceAssets.some((asset) => asset.startsWith('data:image/'));
      const configuredProviders = activeProviders
        .filter((provider) => provider.configured && provider.operations.includes(request.operation))
        .filter((provider) => !hasDeterministicImageInput || provider.id === 'cloudflare' || (provider.id === 'comfyui' && Boolean(readComfyWorkflow(environment) && comfyTemplateNeeds(readComfyWorkflow(environment)!, 'sourceImage'))))
        .map((provider) => provider.id);
      
      if (!configuredProviders.length) {
        return {
          status: 'provider_not_configured',
          code: 'IMAGE_PROVIDER_NOT_CONFIGURED',
          message: hasDeterministicImageInput
            ? 'No configured image-edit provider can accept the deterministic scene render.'
            : 'No image-generation provider is configured.',
          retryable: false,
          sourceSceneVersionId: request.sceneVersionId,
          attemptedProviders: []
        };
      }

      const attemptedProviders: string[] = [];
      let lastFailure: Extract<ProviderResult, { status: 'failed' }> | null = null;
      for (const id of requested) {
        if (!configuredProviders.includes(id)) continue;
        attemptedProviders.push(id);
        
        if (id === 'gemini-nano-banana-2') {
          const result = await executeGeminiNanoBanana2(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
          if (result.status === 'failed') lastFailure = result;
        }
        if (id === 'free-image-worker') {
          const result = await executeFreeImageWorker(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
          if (result.status === 'failed') lastFailure = result;
        }
        if (id === 'cloudflare') {
          const result = await executeCloudflare(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
          if (result.status === 'failed') lastFailure = result;
        }
        if (id === 'openai-dall-e-3') {
          const result = await executeDallE3(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
          if (result.status === 'failed') lastFailure = result;
        }
        if (id === 'openai-gpt-image-1') {
          const result = await executeGptImage1(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
          if (result.status === 'failed') lastFailure = result;
        }
        if (id === 'localai') {
          const result = await executeLocalAi(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
          if (result.status === 'failed') lastFailure = result;
        }
        if (id === 'comfyui') {
          const result = await executeComfy(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
          if (result.status === 'failed') lastFailure = result;
        }
      }

      return {
        status: 'failed',
        code: lastFailure?.code ?? 'IMAGE_GENERATION_FAILED',
        message: lastFailure?.message ?? 'Photorealistic image generation failed across all configured providers.',
        retryable: lastFailure?.retryable ?? true,
        sourceSceneVersionId: request.sceneVersionId,
        attemptedProviders
      };
    }
  };
}

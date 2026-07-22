import type { ProviderStatus, VisualProposalRequest } from '@ultida/contracts';

type Environment = Record<string, string | undefined>;
type ComfyWorkflow = Record<string, unknown>;

export type ImageProviderConfig =
  | { provider: 'openai'; model: 'dall-e-3' | 'gpt-image-1' }
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
  return JSON.parse(JSON.stringify(workflow)
    .replaceAll('{{prompt}}', request.structuredPrompt)
    .replaceAll('{{negativePrompt}}', request.negativePrompt ?? '')
    .replaceAll('{{style}}', request.style)
    .replaceAll('{{sceneVersionId}}', request.sceneVersionId)
    .replaceAll('{{depthMapUrl}}', request.conditioningMaps?.depthMapUrl ?? '')
    .replaceAll('{{cannyEdgeMapUrl}}', request.conditioningMaps?.cannyEdgeMapUrl ?? '')
    .replaceAll('{{materialKeyMapUrl}}', request.conditioningMaps?.materialKeyMapUrl ?? ''));
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function createProviderGateway(environment: Environment) {
  const getProviders = (): ProviderStatus[] => {
    const env = environment;
    return [
      { id: 'openrouter', configured: Boolean(env.OPENROUTER_API_KEY), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
      { id: 'cloudflare', configured: Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
      { id: 'huggingface', configured: Boolean(env.HF_TOKEN || env.HUGGINGFACE_API_KEY), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
      { id: 'pollinations', configured: env.ENABLE_FREE_POLLINATIONS === 'true', operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
      { id: 'openai-dall-e-3', configured: Boolean(env.OPENAI_API_KEY), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
      { id: 'openai-gpt-image-1', configured: Boolean(env.OPENAI_API_KEY && env.OPENAI_IMAGE_MODEL === 'gpt-image-1'), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
      { id: 'comfyui', configured: Boolean(env.COMFYUI_BASE_URL && readComfyWorkflow(env)), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
      { id: 'pedra', configured: Boolean(env.PEDRA_API_KEY), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] }
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
    const model = environment.CLOUDFLARE_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-1-schnell';

    if (!accountId || !token) {
      return { status: 'failed', code: 'CLOUDFLARE_NOT_CONFIGURED', message: 'Cloudflare Workers AI is not configured.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }

    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: `${request.structuredPrompt}, photorealistic interior design render, 8k, architectural lighting`,
          steps: 8,
          seed: Math.floor(Math.random() * 2147483647)
        })
      });

      const payload = (await response.json()) as { success?: boolean; result?: { image?: string }; errors?: Array<{ message?: string }> };

      if (!response.ok || !payload.success || !payload.result?.image) {
        const errorMsg = payload.errors?.map((e) => e.message).join(', ') || `Cloudflare returned HTTP ${response.status}`;
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

  async function executeComfy(request: VisualProposalRequest, attemptedProviders: string[]): Promise<ProviderResult> {
    const workflow = readComfyWorkflow(environment);
    if (!workflow) {
      return { status: 'failed', code: 'COMFYUI_WORKFLOW_INVALID', message: 'COMFYUI_WORKFLOW_JSON is invalid or missing.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    const baseUrl = environment.COMFYUI_BASE_URL!.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(environment.COMFYUI_API_KEY ? { authorization: `Bearer ${environment.COMFYUI_API_KEY}` } : {}) },
      body: JSON.stringify({ prompt: applyPrompt(workflow, request), client_id: `ultida-${request.sceneVersionId}` })
    });
    if (!response.ok) {
      return { status: 'failed', code: `COMFYUI_HTTP_${response.status}`, message: `ComfyUI rejected the workflow (${response.status}).`, retryable: isRetryableStatus(response.status), sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    const payload = await response.json() as { prompt_id?: string; error?: string };
    if (!payload.prompt_id) {
      return { status: 'failed', code: 'COMFYUI_NO_PROMPT_ID', message: payload.error ?? 'ComfyUI did not return a prompt id.', retryable: false, sourceSceneVersionId: request.sceneVersionId, attemptedProviders };
    }
    return { status: 'queued', synthetic: false, provider: 'comfyui', promptId: payload.prompt_id, sourceSceneVersionId: request.sceneVersionId, operation: request.operation, attemptedProviders };
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
      const requested = request.providerPreference.length ? request.providerPreference : ['openrouter', 'cloudflare', 'huggingface', 'openai-dall-e-3', 'openai-gpt-image-1', 'openai', 'comfyui', 'pollinations'];
      const activeProviders = getProviders();
      const configuredProviders = activeProviders.filter((p) => p.configured && p.operations.includes(request.operation)).map((p) => p.id);
      
      if (!configuredProviders.length) {
        return {
          status: 'provider_not_configured',
          code: 'IMAGE_PROVIDER_NOT_CONFIGURED',
          message: 'No image-generation provider is configured.',
          retryable: false,
          sourceSceneVersionId: request.sceneVersionId,
          attemptedProviders: []
        };
      }

      const attemptedProviders: string[] = [];
      for (const id of requested) {
        if (!configuredProviders.includes(id) && id !== 'openai') continue;
        attemptedProviders.push(id);
        
        if (id === 'openrouter') {
          const result = await executeOpenRouter(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
        }
        if (id === 'cloudflare') {
          const result = await executeCloudflare(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
        }
        if (id === 'huggingface') {
          const result = await executeHuggingFace(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
        }
        if (id === 'pollinations') {
          const result = await executePollinations(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
        }
        if (id === 'openai-dall-e-3' || (id === 'openai' && environment.OPENAI_IMAGE_MODEL !== 'gpt-image-1')) {
          const result = await executeDallE3(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
        }
        if (id === 'openai-gpt-image-1' || (id === 'openai' && environment.OPENAI_IMAGE_MODEL === 'gpt-image-1')) {
          const result = await executeGptImage1(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
        }
        if (id === 'comfyui') {
          const result = await executeComfy(request, attemptedProviders);
          if (result.status === 'succeeded' || result.status === 'queued') return result;
        }
      }

      return {
        status: 'failed',
        code: 'IMAGE_GENERATION_FAILED',
        message: 'Photorealistic image generation failed across all configured providers.',
        retryable: true,
        sourceSceneVersionId: request.sceneVersionId,
        attemptedProviders
      };
    }
  };
}

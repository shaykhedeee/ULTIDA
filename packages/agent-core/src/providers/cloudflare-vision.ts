import type { VisionProvider } from '../plan-vision-provider.js';
import type { PlanVisionOutput } from '../plan-vision-schema.js';
import { PlanVisionOutputSchema, normalizeVisionOutput } from '../plan-vision-schema.js';

type Env = Record<string, string | undefined>;

export class CloudflareVisionProvider implements VisionProvider {
  readonly name = 'cloudflare';

  private env: Env;
  constructor(env: Env) {
    this.env = env;
  }

  async analyze(
    imageBase64: string,
    mimeType: string,
    prompt: string,
    requestId: string
  ): Promise<{ output: PlanVisionOutput; metadata: { provider: string; model: string; latencyMs: number; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } } }> {
    const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;
    const token = this.env.CLOUDFLARE_AI_TOKEN;
    if (!accountId || !token) throw new Error('Cloudflare Workers AI credentials are not configured.');

    const candidateModels = Array.from(
      new Set([
        this.env.CLOUDFLARE_VISION_MODEL,
        this.env.CLOUDFLARE_PLAN_MODEL,
        '@cf/meta/llama-3.2-11b-vision-instruct',
        '@cf/llava-hl/llava-1.5-7b-hf',
      ].filter(Boolean) as string[])
    );

    const start = Date.now();
    let lastError: Error | null = null;
    for (const model of candidateModels) {
      if (model.includes('8b-instruct') && !model.includes('vision')) continue;
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: `Extract the visible floor-plan evidence. Request ID: ${requestId}. Return JSON only.` },
              ],
              image: imageBase64,
            }),
          }
        );
        const payload = (await response.json()) as {
          success?: boolean;
          result?: { response?: string; text?: string };
          errors?: Array<{ message?: string }>;
        };
        if (response.ok && payload.success && (payload.result?.response || payload.result?.text)) {
          const raw = payload.result.response || payload.result.text!;
          const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
          const result = PlanVisionOutputSchema.safeParse(parsed);
          if (!result.success) {
            lastError = new Error(`Cloudflare ${model} output failed validation: ${result.error.message}`);
            continue;
          }
          return {
            output: normalizeVisionOutput(result.data),
            metadata: { provider: 'cloudflare', model, latencyMs: Date.now() - start },
          };
        }
        lastError = new Error(payload.errors?.map((e) => e.message).join(', ') || `Cloudflare ${model} returned HTTP ${response.status}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(`Cloudflare ${model} request failed.`);
      }
    }
    throw lastError || new Error('All Cloudflare vision models failed.');
  }
}

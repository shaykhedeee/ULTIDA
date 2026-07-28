import type { VisionProvider } from '../plan-vision-provider.js';
import type { PlanVisionOutput } from '../plan-vision-schema.js';
import { PlanVisionOutputSchema, normalizeVisionOutput } from '../plan-vision-schema.js';

type Env = Record<string, string | undefined>;

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = 'openai';

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
    const apiKey = this.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured for plan vision.');

    const model = this.env.OPENAI_VISION_MODEL || 'gpt-4o';
    const start = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analyze this floor-plan image. Request ID: ${requestId}` },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 4000,
      }),
    });

    const latencyMs = Date.now() - start;
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenAI vision error ${response.status}: ${errText}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) throw new Error('OpenAI vision returned no content.');

    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
    const result = PlanVisionOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`OpenAI vision output failed validation: ${result.error.message}`);
    }

    return {
      output: normalizeVisionOutput(result.data),
      metadata: {
        provider: 'openai',
        model,
        latencyMs,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens,
            }
          : undefined,
      },
    };
  }
}

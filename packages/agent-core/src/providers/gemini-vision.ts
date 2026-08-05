import type { VisionProvider } from '../plan-vision-provider.js';
import type { PlanVisionOutput } from '../plan-vision-schema.js';
import { PlanVisionOutputSchema, normalizeVisionOutput } from '../plan-vision-schema.js';

type Env = Record<string, string | undefined>;

function geminiKey(env: Env) {
  return env.GEMINI_VISION_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_AI_STUDIO_KEY_1 || env.GOOGLE_AI_STUDIO_KEY_2;
}

export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'gemini';

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
    const apiKey = geminiKey(this.env);
    if (!apiKey) throw new Error('Gemini vision credentials not configured.');

    const model = this.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
    const start = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
          contents: [
            {
              parts: [
                { text: `${prompt}\nSource request ID: ${requestId}` },
                { inlineData: { mimeType, data: imageBase64 } },
              ],
            },
          ],
        }),
      }
    );

    const latencyMs = Date.now() - start;
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini vision error ${response.status}: ${errText}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!raw) throw new Error('Gemini vision returned no content.');

    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
    const result = PlanVisionOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Gemini vision output failed validation: ${result.error.message}`);
    }

    return {
      output: normalizeVisionOutput(result.data),
      metadata: { provider: 'gemini', model, latencyMs },
    };
  }
}

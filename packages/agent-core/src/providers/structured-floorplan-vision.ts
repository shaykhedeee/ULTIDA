import type { VisionProvider } from '../plan-vision-provider.js';
import type { PlanVisionOutput } from '../plan-vision-schema.js';
import { PlanVisionOutputSchema, normalizeVisionOutput } from '../plan-vision-schema.js';

type Env = Record<string, string | undefined>;

/**
 * Adapter for an optional self-hosted PolyRoom/DeepFloorplan service.
 * The model stays outside the web bundle and must return ULTIDA's validated
 * PlanVisionOutput contract; no raw research-model output is trusted directly.
 */
export class StructuredFloorplanVisionProvider implements VisionProvider {
  readonly name = 'structured-floorplan';
  constructor(private readonly env: Env) {}

  async analyze(imageBase64: string, mimeType: string, prompt: string, requestId: string): Promise<{ output: PlanVisionOutput; metadata: { provider: string; model: string; latencyMs: number } }> {
    const baseUrl = this.env.FLOORPLAN_VISION_URL?.replace(/\/$/, '');
    if (!baseUrl) throw new Error('FLOORPLAN_VISION_URL is not configured.');
    const model = this.env.FLOORPLAN_VISION_MODEL ?? 'deepfloorplan';
    const start = Date.now();
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.env.FLOORPLAN_VISION_TOKEN ? { authorization: `Bearer ${this.env.FLOORPLAN_VISION_TOKEN}` } : {})
      },
      body: JSON.stringify({ image: imageBase64, mimeType, prompt, requestId, model })
    });
    const payload = await response.json().catch(() => null) as { output?: unknown; result?: unknown; data?: unknown; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? `Structured floor-plan provider returned HTTP ${response.status}.`);
    const parsed = PlanVisionOutputSchema.safeParse(payload?.output ?? payload?.result ?? payload?.data ?? payload);
    if (!parsed.success) throw new Error(`Structured floor-plan provider returned invalid output: ${parsed.error.message}`);
    return { output: normalizeVisionOutput(parsed.data), metadata: { provider: 'structured-floorplan', model, latencyMs: Date.now() - start } };
  }
}

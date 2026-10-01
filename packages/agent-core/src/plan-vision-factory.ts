import type { VisionProvider } from './plan-vision-provider.js';
import { OpenAIVisionProvider } from './providers/openai-vision.js';
import { GeminiVisionProvider } from './providers/gemini-vision.js';
import { CloudflareVisionProvider } from './providers/cloudflare-vision.js';
import { StructuredFloorplanVisionProvider } from './providers/structured-floorplan-vision.js';
import { eligiblePlanVisionProviders } from './plan-provider-policy.js';

type Env = Record<string, string | undefined>;

export function getVisionProvider(env: Env, preferred?: 'openai' | 'gemini' | 'cloudflare' | 'structured-floorplan'): VisionProvider | null {
  const providers: Array<{ key: 'openai' | 'gemini' | 'cloudflare' | 'structured-floorplan'; make: () => VisionProvider }> = [];

  if (env.FLOORPLAN_VISION_URL) {
    providers.push({ key: 'structured-floorplan', make: () => new StructuredFloorplanVisionProvider(env) });
  }

  if (env.OPENAI_API_KEY) {
    providers.push({ key: 'openai', make: () => new OpenAIVisionProvider(env) });
  }
  if (env.GEMINI_VISION_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_AI_STUDIO_KEY_1 || env.GOOGLE_AI_STUDIO_KEY_2) {
    providers.push({ key: 'gemini', make: () => new GeminiVisionProvider(env) });
  }
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN) {
    providers.push({ key: 'cloudflare', make: () => new CloudflareVisionProvider(env) });
  }

  for (const key of eligiblePlanVisionProviders(env, preferred)) {
    const match = providers.find((p) => p.key === key);
    if (match) return match.make();
  }
  return null;
}

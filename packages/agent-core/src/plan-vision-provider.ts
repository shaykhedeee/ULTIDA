import type { PlanVisionOutput } from './plan-vision-schema.js';

export interface VisionProvider {
  /** Unique identifier for configuration/env selection */
  readonly name: 'openai' | 'gemini' | 'cloudflare' | string;

  /**
   * Analyze a raster image (base64 data URL) and return a validated
   * PlanVisionOutput. Throws if the provider is mis‑configured or the
   * request fails.
   */
  analyze(
    imageBase64: string,
    mimeType: string,
    prompt: string,
    requestId: string   // for tracing
  ): Promise<{
    output: PlanVisionOutput;
    metadata: {
      provider: string;
      model: string;
      latencyMs: number;
      usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    };
  }>;
}
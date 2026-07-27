import { RenderQAResultSchema } from './schema.js';
import type { RenderOptions, RenderQAResult } from './schema.js';
import { validateRenderOptions } from './record.js';

export interface RenderBaseArtifacts {
  rgb: { url: string; bytes?: number };
  depth?: { url: string; bytes?: number };
  edgeMap?: { url: string; bytes?: number };
  objectMasks?: Array<{ id: string; url: string }>;
  materialRegions?: Array<{ materialId: string; url: string }>;
}

export interface EnhancementInput {
  baseImage: { url: string };
  materialReferences: Array<{ id: string; code: string; name: string; category?: string }>;
  sceneFacts: string[];
  cameraFacts: string[];
  forbiddenChanges: string[];
  options: RenderOptions;
}

export const DEFAULT_FORBIDDEN = [
  'Do not move walls',
  'Do not move openings',
  'Do not change shutter count',
  'Do not resize modules',
  'Do not add new furniture',
  'Do not remove existing furniture',
  'Do not change ceiling geometry',
  'Do not move lights',
  'Do not change camera',
] as const;

export function buildEnhancementPrompt(options: RenderOptions, sceneFacts: string[], cameraFacts: string[]): EnhancementInput {
  const parsed = validateRenderOptions(options);
  return {
    baseImage: { url: `base-render://${parsed.sourceSceneId}` },
    materialReferences: parsed.selectedMaterials.map((m) => ({ id: m.id, code: m.code, name: m.name })),
    sceneFacts: Array.from(new Set<string>([...sceneFacts, 'Geometry is fixed', `Aspect ratio: ${parsed.aspectRatio}`])),
    cameraFacts,
    forbiddenChanges: [...DEFAULT_FORBIDDEN],
    options: parsed,
  };
}

export function validateRenderQA(qa: unknown): RenderQAResult {
  return RenderQAResultSchema.parse(qa);
}

export * from './schema.js';
export * from './ready.js';
export * from './base-render.js';
export * from './qa.js';
export * from './enhance.js';
export * from './record.js';
export * from './job.js';

/**
 * render-pipeline — geometry-preserving enhancement contract + provider invocation.
 *
 * The image model receives the deterministic base render plus a STRICT contract:
 * exact camera data, structured scene summary, room/module dimensions, material
 * references, and a list of forbidden changes derived from the geometry lock.
 * Ling never lets the model move geometry.
 */

import type { RenderOptions } from './schema.js';

export interface EnhancementPayload {
  baseRenderDataUri: string; // the deterministic RGB base render
  provider: string; // chosen provider id
  model: string; // chosen model id (filled after selection)
  prompt: string; // structured positive prompt
  negativePrompt: string;
  forbiddenChanges: string[]; // strict, geometry-lock derived
  // Exact structured facts the model MUST respect.
  camera: { positionMm: [number, number, number]; targetMm: [number, number, number]; fovDeg: number };
  sceneSummary: string[];
  roomDimensions: Array<{ id: string; name: string; widthMm: number; depthMm: number; heightMm: number }>;
  moduleDimensions: Array<{ id: string; name: string; widthMm: number; depthMm: number; heightMm: number; materialId?: string }>;
  materialReferences: Array<{ id: string; code: string; name: string; category?: string }>;
  aspectRatio: string;
  lighting: 'day' | 'evening';
  quality: 'draft' | 'review' | 'final';
  decorIntensity: number;
  promptVersion: string;
}

// Strict forbidden changes (geometry lock = strict). These are non-negotiable.
const STRICT_FORBIDDEN: string[] = [
  'Do not move, lengthen, shorten, or delete any wall.',
  'Do not resize or repartition any room.',
  'Do not move, resize, add, or remove any door or window.',
  'Do not move, resize, add, or remove any module or cabinet.',
  'Do not change shutter count, drawer count, or cabinet divisions.',
  'Do not change the camera position, target, or field of view.',
  'Do not change ceiling height or ceiling geometry.',
  'Do not move or add light fixtures.',
  'Do not introduce materials, finishes, or colours that were not selected.',
  'Do not add furniture, decor, plants, or objects not present in the scene graph.',
  'Do not add text, labels, watermarks, or branding to the image.',
];

// Moderate lock allows decor intensity and material tone, but never geometry.
const MODERATE_FORBIDDEN: string[] = [
  'Do not move, lengthen, shorten, or delete any wall.',
  'Do not resize or repartition any room.',
  'Do not move, resize, add, or remove any door or window.',
  'Do not move, resize, add, or remove any module or cabinet.',
  'Do not change the camera position, target, or field of view.',
  'Do not change ceiling height or ceiling geometry.',
  'Do not move or add light fixtures.',
];

export function buildForbiddenChanges(geometryLock: RenderOptions['geometryLock']): string[] {
  if (geometryLock === 'strict') return [...STRICT_FORBIDDEN];
  if (geometryLock === 'moderate') return [...MODERATE_FORBIDDEN];
  // creative: geometry still locked, but material/light mood is adjustable
  return [
    'Do not move, lengthen, shorten, or delete any wall.',
    'Do not resize or repartition any room.',
    'Do not move, resize, add, or remove any door or window.',
    'Do not move or resize modules.',
    'Do not change the camera position, target, or field of view.',
    'Do not change ceiling geometry.',
  ];
}

export interface BuildPayloadInput {
  baseRenderDataUri: string;
  options: RenderOptions;
  camera: { positionMm: [number, number, number]; targetMm: [number, number, number]; fovDeg: number };
  sceneSummary: string[];
  roomDimensions: EnhancementPayload['roomDimensions'];
  moduleDimensions: EnhancementPayload['moduleDimensions'];
  materialReferences: EnhancementPayload['materialReferences'];
  promptVersion: string;
  decorIntensity?: number;
}

export function buildEnhancementPayload(input: BuildPayloadInput): EnhancementPayload {
  const o = input.options;
  const forbidden = buildForbiddenChanges(o.geometryLock);
  const roomLines = input.roomDimensions.map((r) => `${r.name}: ${r.widthMm}mm x ${r.depthMm}mm, ceiling ${r.heightMm}mm`);
  const moduleLines = input.moduleDimensions.map((m) => `${m.name}: ${m.widthMm}mm x ${m.depthMm}mm x ${m.heightMm}mm${m.materialId ? ` (material ${m.materialId})` : ''}`);
  const materialLines = input.materialReferences.map((m) => `${m.name} [${m.code}]${m.category ? ` — ${m.category}` : ''}`);

  const positive = [
    `Photorealistic interior visualisation of ${o.room}.`,
    `Lighting: ${o.lighting}.`,
    `Rooms: ${roomLines.join('; ')}.`,
    `Modules: ${moduleLines.join('; ')}.`,
    `Materials: ${materialLines.join('; ')}.`,
    `Maintain every wall, opening, module, and camera exactly as provided.`,
    `Decor intensity ${((input.decorIntensity ?? o.styleIntensity) * 100).toFixed(0)}%.`,
  ].join(' ');

  const negative = [
    'moved or missing walls',
    'resized or missing rooms',
    'moved or missing doors/windows',
    'moved or resized modules',
    'changed shutter or drawer count',
    'changed camera',
    'changed ceiling height',
    'moved lights',
    'unapproved materials',
    'added text, watermark, or logo',
    'fisheye lens, impossible geometry, floating furniture',
  ].join(', ');

  return {
    baseRenderDataUri: input.baseRenderDataUri,
    provider: '',
    model: '',
    prompt: positive,
    negativePrompt: negative,
    forbiddenChanges: forbidden,
    camera: input.camera,
    sceneSummary: input.sceneSummary,
    roomDimensions: input.roomDimensions,
    moduleDimensions: input.moduleDimensions,
    materialReferences: input.materialReferences,
    aspectRatio: o.aspectRatio,
    lighting: o.lighting,
    quality: o.quality,
    decorIntensity: input.decorIntensity ?? o.styleIntensity,
    promptVersion: input.promptVersion,
  };
}

export type ProviderGatewayLike = {
  createVisualProposal(request: any): Promise<{ status: string; [k: string]: any }>;
};

/**
 * Invoke the real image model. We hand it the base render + exact contract.
 * Returns the raw provider result (the caller persists proof + runs QA).
 * Throws a typed error if no provider is configured.
 */
export async function invokeImageModel(
  gateway: ProviderGatewayLike,
  payload: EnhancementPayload,
  provider: string,
  model: string
): Promise<any> {
  const request = {
    operation: 'image_edit',
    providerPreference: [provider],
    sceneVersionId: payload.roomDimensions[0]?.id ?? 'scene',
    roomId: '',
    style: payload.lighting,
    quality: payload.quality,
    camera: payload.camera,
    image: { data: payload.baseRenderDataUri.split(',')[1], mimeType: 'image/png' },
    structuredPrompt: payload.prompt,
    negativePrompt: payload.negativePrompt,
    forbiddenChanges: payload.forbiddenChanges,
    promptVersion: payload.promptVersion,
  };
  return gateway.createVisualProposal(request);
}

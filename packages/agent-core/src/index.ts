import { z } from 'zod';
import type { SceneV1 } from '@ultida/scene-core';

export const AgentExecutionStatusSchema = z.enum([
  'queued', 'validating', 'running', 'awaiting_confirmation', 'succeeded', 'failed', 'cancelled'
]);

export const AgentToolSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['read', 'propose', 'confirm']),
  requiredState: z.array(z.string()),
  timeoutMs: z.number().int().positive(),
  maxAttempts: z.number().int().min(1).max(5),
  mutates: z.boolean()
});

export const SceneChangeRequestSchema = z.object({
  projectId: z.string().min(1),
  sceneVersionId: z.string().min(1),
  selectedEntityIds: z.array(z.string().min(1)).min(1),
  instruction: z.string().trim().min(3).max(1000),
  intent: z.enum(['remove', 'replace', 'restyle', 'repair', 'resize', 'move']).default('restyle')
});
export type SceneChangeRequest = z.infer<typeof SceneChangeRequestSchema>;

export type AgentTool = z.infer<typeof AgentToolSchema>;

export const PROMPT_VERSIONS = {
  floorPlanAnalyzer: 'floor-plan-analyzer.v2',
  spatialReviewer: 'spatial-reviewer.v1',
  layoutAssistant: 'layout-assistant.v1',
  materialsStylist: 'materials-stylist.v1',
  renderDirector: 'render-director.v2',
  budgetOptimizer: 'budget-optimizer.v1',
  documentationReviewer: 'documentation-reviewer.v1'
  ,sceneChangeQuickChanger: 'scene-change-quick-changer.v1'
} as const;

export const AURA_TOOL_REGISTRY: AgentTool[] = [
  { id: 'analyze_plan', mode: 'propose', requiredState: ['source_asset'], timeoutMs: 120_000, maxAttempts: 2, mutates: false },
  { id: 'generate_visual_proposal', mode: 'confirm', requiredState: ['approved_scene', 'room'], timeoutMs: 300_000, maxAttempts: 2, mutates: false },
  { id: 'generate_elevations', mode: 'confirm', requiredState: ['approved_scene'], timeoutMs: 60_000, maxAttempts: 1, mutates: false },
  { id: 'generate_tv_unit', mode: 'confirm', requiredState: ['approved_scene'], timeoutMs: 30_000, maxAttempts: 1, mutates: true },
  { id: 'change_laminate', mode: 'confirm', requiredState: ['approved_scene', 'selected_modules'], timeoutMs: 30_000, maxAttempts: 1, mutates: true }
  ,{ id: 'scene_change_quick_changer', mode: 'confirm', requiredState: ['approved_scene', 'selected_entity'], timeoutMs: 60_000, maxAttempts: 2, mutates: true }
];

export function compileSceneChangePrompt(input: SceneChangeRequest & { selectedEntityFacts: string[] }) {
  const request = SceneChangeRequestSchema.parse(input);
  return {
    version: PROMPT_VERSIONS.sceneChangeQuickChanger,
    system: 'You propose a minimal, reversible change to selected approved-scene entities. Return JSON only. Never alter unselected entities, measured walls, openings, dimensions, approvals or prices. If the instruction is ambiguous or unsafe, return needs_review with no mutation.',
    user: [
      `Intent: ${request.intent}`,
      `Instruction: ${request.instruction}`,
      `Selected entity IDs: ${request.selectedEntityIds.join(', ')}`,
      'Authoritative selected entity facts:',
      ...input.selectedEntityFacts,
      'Return: status, summary, changedFields, before, after, warnings, confidence. The after state is a proposal only.'
    ].join('\n')
  };
}

export type RenderCamera = {
  view: 'eye-level' | 'wide-corner' | 'elevation' | 'detail';
  lensMm: number;
  eyeHeightMm: number;
};

export type RenderBrief = {
  version: string;
  projectId: string;
  sceneVersionId: string;
  roomId: string;
  style: string;
  quality: 'draft' | 'review' | 'final';
  camera: RenderCamera;
  geometryFacts: string[];
  materialFacts: string[];
  positivePrompt: string;
  negativePrompt: string;
};

function formatModule(module: SceneV1['modules'][number]) {
  return `${module.family} ${module.id}: ${module.widthMm} x ${module.depthMm} x ${module.heightMm} mm at (${module.position.xMm}, ${module.position.yMm}) rotation ${module.rotationDeg} degrees`;
}

export function compileRenderBrief(input: {
  scene: SceneV1;
  sceneVersionId: string;
  roomId: string;
  style: string;
  quality?: RenderBrief['quality'];
  camera?: Partial<RenderCamera>;
}): RenderBrief {
  const room = input.scene.rooms.find((candidate) => candidate.id === input.roomId || candidate.type === input.roomId);
  if (!room) throw new Error(`Room ${input.roomId} is not present in the approved scene.`);
  const roomModules = input.scene.modules.filter((module) => module.roomId === room.id || module.roomId === input.roomId);
  const wallFacts = input.scene.walls.map((wall) => `wall ${wall.id}: (${wall.start.xMm}, ${wall.start.yMm}) to (${wall.end.xMm}, ${wall.end.yMm}), ${wall.heightMm} mm high`);
  const openingFacts = input.scene.openings.map((opening) => `${opening.kind} ${opening.id} on wall ${opening.wallId} at ${opening.offsetMm} mm, ${opening.widthMm} x ${opening.heightMm} mm`);
  const materialFacts = input.scene.materials.map((material) => `${material.name} (${material.code})`);
  const camera: RenderCamera = {
    view: input.camera?.view ?? 'wide-corner',
    lensMm: input.camera?.lensMm ?? 24,
    eyeHeightMm: input.camera?.eyeHeightMm ?? 1500
  };
  const geometryFacts = [
    `room ${room.name} (${room.type}) with ${room.boundary.length} reviewed boundary points`,
    ...wallFacts,
    ...openingFacts,
    ...roomModules.map(formatModule)
  ];
  const positivePrompt = [
    `Create a professional photorealistic interior proposal for ${room.name}.`,
    `Design direction: ${input.style}.`,
    `Camera: ${camera.view}, ${camera.lensMm} mm lens, eye height ${camera.eyeHeightMm} mm.`,
    'Treat every geometry fact below as immutable. Preserve exact room proportions, openings, circulation, module count, dimensions and placements.',
    ...geometryFacts,
    materialFacts.length ? `Approved materials: ${materialFacts.join('; ')}.` : 'Use a restrained, buildable material palette and clearly mark it as proposed.',
    'Use physically plausible daylight, artificial lighting, joinery thicknesses, shadows, reflections and camera perspective.'
  ].join('\n');
  const negativePrompt = [
    'Do not move, add or remove walls, doors or windows.',
    'Do not change cabinetry dimensions or invent unsupported modules.',
    'No distorted verticals, impossible reflections, floating furniture, blocked circulation, warped joinery, text, watermark or fisheye lens.'
  ].join(' ');
  return { version: PROMPT_VERSIONS.renderDirector, projectId: input.scene.projectId, sceneVersionId: input.sceneVersionId, roomId: room.id, style: input.style, quality: input.quality ?? 'review', camera, geometryFacts, materialFacts, positivePrompt, negativePrompt };
}

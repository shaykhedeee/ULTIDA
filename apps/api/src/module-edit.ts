import { z } from 'zod';
import type { CanonicalPlanModel } from '@ultida/plan-core';
import { resolveModuleWallAnchor } from './module-anchor.js';
import { compileStoredModuleForScene } from './scene-module-parts.js';

export const ModuleEditSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(1).max(500),
  config: z.object({
    widthMm: z.number().finite().positive().optional(),
    depthMm: z.number().finite().positive().optional(),
    heightMm: z.number().finite().positive().optional(),
    configuration: z.object({
      archetype: z.string().min(1).optional(),
      shutterStyle: z.enum(['swing', 'sliding', 'profile-glass', 'open']).optional(),
      drawerCount: z.number().int().min(0).max(24).optional(),
      shutterCount: z.number().int().min(0).max(32).optional(),
      includeLoft: z.boolean().optional(),
      glassProfile: z.boolean().optional(),
      sideFillerLeft: z.boolean().optional(),
      sideFillerRight: z.boolean().optional(),
      handleStyle: z.enum(['gola', 'long-profile', 'knob', 'none']).optional(),
      lighting: z.enum(['none', 'shelf-led', 'vertical-led']).optional(),
    }).strict().optional(),
  }).strict().optional(),
  position: z.object({
    wallId: z.string().min(1).optional(),
    offsetMm: z.number().finite().nonnegative().optional(),
  }).strict().optional(),
}).strict().refine((value) => Object.keys(value.config ?? {}).length + Object.keys(value.position ?? {}).length > 0,
  'Provide at least one dimension or wall position to edit.');

export type EditableModule = {
  id: string; space_id: string; category: string; template_id?: string;
  config_json: Record<string, any>; position_json: Record<string, any>;
};

/** Uses canonical opening fields, not the legacy UI's kind/offsetAlongWallMm. */
export function validateModuleClearance(
  module: EditableModule, plan: CanonicalPlanModel, neighbours: EditableModule[],
): { ok: true } | { ok: false; code: string; message: string } {
  const { widthMm, depthMm, heightMm } = module.config_json;
  const { wallId, offsetMm, zMm = 0 } = module.position_json;
  if (![widthMm, depthMm, heightMm].every((value) => Number.isFinite(value) && value > 0) || !Number.isFinite(zMm) || zMm < 0) {
    return { ok: false, code: 'MODULE_DIMENSIONS_INVALID', message: 'Module dimensions must be positive finite millimetres and elevation must be non-negative.' };
  }
  const wall = plan.walls.find((entry) => entry.id === wallId);
  if (!wall || zMm + heightMm > (wall.heightMm || plan.ceilingHeightMm)) {
    return { ok: false, code: 'MODULE_EXCEEDS_HEIGHT', message: 'The module must fit below the measured wall height.' };
  }
  for (const opening of plan.openings) {
    if (opening.wallId !== wallId) continue;
    const bottom = opening.sillMm ?? 0;
    const top = opening.headMm ?? ('heightMm' in opening ? bottom + opening.heightMm : plan.ceilingHeightMm);
    const margin = bottom === 0 ? 150 : 0;
    if (offsetMm < opening.offsetMm + opening.widthMm + margin && offsetMm + widthMm > opening.offsetMm - margin && zMm < top && zMm + heightMm > bottom) {
      return { ok: false, code: bottom === 0 ? 'MODULE_BLOCKS_DOOR' : 'MODULE_BLOCKS_WINDOW', message: 'The module conflicts with a measured opening. Move it clear before saving.' };
    }
  }
  for (const neighbour of neighbours) {
    if (neighbour.id === module.id || neighbour.position_json?.wallId !== wallId) continue;
    const anchor = neighbour.position_json ?? {};
    const dimensions = neighbour.config_json ?? {};
    const bottom = anchor.zMm ?? 0;
    if (![anchor.offsetMm, dimensions.widthMm, dimensions.heightMm, bottom].every(Number.isFinite)) {
      return { ok: false, code: 'MODULE_NEIGHBOUR_INVALID', message: 'A neighbouring module has incomplete geometry. Resolve it before editing this wall.' };
    }
    if (offsetMm < anchor.offsetMm + dimensions.widthMm + 20 && offsetMm + widthMm > anchor.offsetMm - 20 && zMm < bottom + dimensions.heightMm && zMm + heightMm > bottom) {
      return { ok: false, code: 'MODULE_OVERLAP', message: 'The module overlaps another module on this wall or its 20 mm clearance.' };
    }
  }
  return { ok: true };
}

export function prepareModuleEdit(module: EditableModule, edit: z.infer<typeof ModuleEditSchema>, plan: CanonicalPlanModel, neighbours: EditableModule[]) {
  const config = { ...module.config_json, ...edit.config, configuration: { ...(module.config_json.configuration ?? {}), ...(edit.config?.configuration ?? {}) } };
  const position: Record<string, any> = { ...module.position_json, ...edit.position };
  const anchor = resolveModuleWallAnchor(plan.walls, { wallId: position.wallId, offsetMm: position.offsetMm, zMm: position.zMm }, Number(config.widthMm));
  if (!anchor.ok) return anchor;
  const candidate = { ...module, config_json: config, position_json: anchor.anchor };
  const clearance = validateModuleClearance(candidate, plan, neighbours);
  if (!clearance.ok) return clearance;
  const compiled = compileStoredModuleForScene(candidate, plan.walls);
  if (!compiled.ok) return compiled;
  return { ok: true as const, candidate, partCount: compiled.parts.length };
}

export function prepareModulePlacement(module: EditableModule, plan: CanonicalPlanModel, roomId: string, neighbours: EditableModule[]) {
  if (!plan.scale?.verified) return { ok: false as const, code: 'PLAN_SCALE_NOT_CONFIRMED', message: 'Confirm the plan calibration before saving a module placement.' };
  const room = plan.spaces.find((entry) => entry.id === roomId);
  if (!room || !room.wallRefs.includes(module.position_json.wallId)) return { ok: false as const, code: 'MODULE_WALL_ROOM_MISMATCH', message: 'Select a measured wall belonging to this room.' };
  const anchor = resolveModuleWallAnchor(plan.walls, { wallId: module.position_json.wallId, offsetMm: module.position_json.offsetMm, zMm: module.position_json.zMm }, Number(module.config_json.widthMm));
  if (!anchor.ok) return anchor;
  const candidate = { ...module, position_json: anchor.anchor };
  const clearance = validateModuleClearance(candidate, plan, neighbours);
  if (!clearance.ok) return clearance;
  const compiled = compileStoredModuleForScene(candidate, plan.walls);
  if (!compiled.ok) return compiled;
  return { ok: true as const, candidate, partCount: compiled.parts.length };
}

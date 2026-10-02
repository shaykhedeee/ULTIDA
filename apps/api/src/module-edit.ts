import { z } from 'zod';
import type { CanonicalPlanModel } from '@ultida/plan-core';
import { resolveModuleWallAnchor } from './module-anchor.js';
import { compileStoredModuleForScene } from './scene-module-parts.js';
import { resolveRoomWalls } from '@ultida/scene-compiler';

type PlanPoint = { xMm: number; yMm: number };

function pointOnSegment(point: PlanPoint, start: PlanPoint, end: PlanPoint, epsilon = 0.5) {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const cross = (point.xMm - start.xMm) * dy - (point.yMm - start.yMm) * dx;
  if (Math.abs(cross) > epsilon * Math.max(1, Math.hypot(dx, dy))) return false;
  const dot = (point.xMm - start.xMm) * dx + (point.yMm - start.yMm) * dy;
  return dot >= -epsilon && dot <= dx * dx + dy * dy + epsilon;
}

function pointInOrOnPolygon(point: PlanPoint, polygon: PlanPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (pointOnSegment(point, a, b)) return true;
    if ((a.yMm > point.yMm) !== (b.yMm > point.yMm)
      && point.xMm < ((b.xMm - a.xMm) * (point.yMm - a.yMm)) / (b.yMm - a.yMm) + a.xMm) inside = !inside;
  }
  return inside;
}

function segmentsProperlyIntersect(a: PlanPoint, b: PlanPoint, c: PlanPoint, d: PlanPoint) {
  const orient = (p: PlanPoint, q: PlanPoint, r: PlanPoint) =>
    (q.xMm - p.xMm) * (r.yMm - p.yMm) - (q.yMm - p.yMm) * (r.xMm - p.xMm);
  const abC = orient(a, b, c);
  const abD = orient(a, b, d);
  const cdA = orient(c, d, a);
  const cdB = orient(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function orientedFootprint(module: EditableModule): PlanPoint[] | null {
  const position = module.position_json;
  const widthMm = Number(module.config_json.widthMm);
  const depthMm = Number(module.config_json.depthMm);
  const xMm = Number(position.xMm);
  const yMm = Number(position.yMm);
  const rotationDeg = Number(position.rotationDeg);
  if (![widthMm, depthMm, xMm, yMm, rotationDeg].every(Number.isFinite) || widthMm <= 0 || depthMm <= 0) return null;
  const angle = rotationDeg * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [[0, 0], [widthMm, 0], [widthMm, depthMm], [0, depthMm]].map(([x, y]) => ({
    xMm: xMm + x! * cos - y! * sin,
    yMm: yMm + x! * sin + y! * cos,
  }));
}

function footprintsOverlapWithClearance(a: PlanPoint[], b: PlanPoint[], clearanceMm = 20) {
  const axes: PlanPoint[] = [];
  for (const polygon of [a, b]) {
    for (let i = 0; i < 2; i += 1) {
      const edge = { xMm: polygon[i + 1].xMm - polygon[i].xMm, yMm: polygon[i + 1].yMm - polygon[i].yMm };
      const length = Math.hypot(edge.xMm, edge.yMm);
      if (length > 0) axes.push({ xMm: -edge.yMm / length, yMm: edge.xMm / length });
    }
  }
  return !axes.some((axis) => {
    const project = (point: PlanPoint) => point.xMm * axis.xMm + point.yMm * axis.yMm;
    const aValues = a.map(project);
    const bValues = b.map(project);
    const aMin = Math.min(...aValues); const aMax = Math.max(...aValues);
    const bMin = Math.min(...bValues); const bMax = Math.max(...bValues);
    return aMax + clearanceMm <= bMin || bMax + clearanceMm <= aMin;
  });
}

/**
 * Check the saved rectangular module envelope against an explicitly measured
 * room polygon. The polygon is optional in older canonical plans, so this
 * check only runs when the approved plan supplies world-space millimetres.
 */
function moduleFitsRoomPolygon(
  module: EditableModule,
  room: CanonicalPlanModel['spaces'][number] | undefined,
): boolean | null {
  const polygon = room?.worldPolygon;
  if (!polygon) return null;
  if (polygon.length < 4 || polygon[0].xMm !== polygon[polygon.length - 1].xMm
    || polygon[0].yMm !== polygon[polygon.length - 1].yMm) return false;
  const corners = orientedFootprint(module);
  if (!corners) return false;

  if (!corners.every((corner) => pointInOrOnPolygon(corner, polygon))) return false;
  for (let i = 0; i < corners.length; i += 1) {
    const cornerStart = corners[i];
    const cornerEnd = corners[(i + 1) % corners.length];
    for (let j = 0; j < polygon.length - 1; j += 1) {
      if (segmentsProperlyIntersect(cornerStart, cornerEnd, polygon[j], polygon[j + 1])) return false;
    }
  }
  return true;
}

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
  module: EditableModule, plan: CanonicalPlanModel, neighbours: EditableModule[], roomId?: string,
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
  const room = roomId ? plan.spaces.find((entry) => entry.id === roomId) : undefined;
  const footprintFit = moduleFitsRoomPolygon(module, room);
  if (footprintFit === false) {
    return { ok: false, code: 'MODULE_OUTSIDE_ROOM', message: 'The full module footprint does not fit inside the measured room boundary. Choose another wall or adjust the unit dimensions.' };
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
    if (neighbour.id === module.id) continue;
    const anchor = neighbour.position_json ?? {};
    const dimensions = neighbour.config_json ?? {};
    const bottom = anchor.zMm ?? 0;
    if (anchor.wallId !== wallId) {
      if (![anchor.xMm, anchor.yMm, anchor.rotationDeg, dimensions.widthMm, dimensions.depthMm, dimensions.heightMm, bottom].every(Number.isFinite)) {
        return { ok: false, code: 'MODULE_NEIGHBOUR_INVALID', message: 'A neighbouring module has incomplete world geometry. Resolve it before saving another module in this room.' };
      }
      if (zMm >= bottom + dimensions.heightMm || zMm + heightMm <= bottom) continue;
      const candidateFootprint = orientedFootprint(module);
      const neighbourFootprint = orientedFootprint(neighbour);
      if (!candidateFootprint || !neighbourFootprint) {
        return { ok: false, code: 'MODULE_NEIGHBOUR_INVALID', message: 'A neighbouring module has invalid dimensions or orientation. Resolve it before saving another module in this room.' };
      }
      if (footprintsOverlapWithClearance(candidateFootprint, neighbourFootprint)) {
        return { ok: false, code: 'MODULE_OVERLAP', message: 'The module footprint overlaps another unit on a different wall or enters its 20 mm clearance.' };
      }
      continue;
    }
    if (![anchor.offsetMm, dimensions.widthMm, dimensions.heightMm, bottom].every(Number.isFinite)) {
      return { ok: false, code: 'MODULE_NEIGHBOUR_INVALID', message: 'A neighbouring module has incomplete geometry. Resolve it before editing this wall.' };
    }
    if (offsetMm < anchor.offsetMm + dimensions.widthMm + 20 && offsetMm + widthMm > anchor.offsetMm - 20 && zMm < bottom + dimensions.heightMm && zMm + heightMm > bottom) {
      return { ok: false, code: 'MODULE_OVERLAP', message: 'The module overlaps another module on this wall or its 20 mm clearance.' };
    }
  }
  return { ok: true };
}

export function prepareModuleEdit(module: EditableModule, edit: z.infer<typeof ModuleEditSchema>, plan: CanonicalPlanModel, neighbours: EditableModule[], roomId?: string) {
  const config = { ...module.config_json, ...edit.config, configuration: { ...(module.config_json.configuration ?? {}), ...(edit.config?.configuration ?? {}) } };
  const position: Record<string, any> = { ...module.position_json, ...edit.position };
  const anchor = resolveModuleWallAnchor(plan.walls, { wallId: position.wallId, offsetMm: position.offsetMm, zMm: position.zMm }, Number(config.widthMm));
  if (!anchor.ok) return anchor;
  const candidate = { ...module, config_json: config, position_json: anchor.anchor };
  const clearance = validateModuleClearance(candidate, plan, neighbours, roomId);
  if (!clearance.ok) return clearance;
  const compiled = compileStoredModuleForScene(candidate, plan.walls);
  if (!compiled.ok) return compiled;
  return { ok: true as const, candidate, partCount: compiled.parts.length };
}

export function prepareModulePlacement(module: EditableModule, plan: CanonicalPlanModel, roomId: string, neighbours: EditableModule[]) {
  if (!plan.scale?.verified) return { ok: false as const, code: 'PLAN_SCALE_NOT_CONFIRMED', message: 'Confirm the plan calibration before saving a module placement.' };
  const room = plan.spaces.find((entry) => entry.id === roomId);
  if (!room || !resolveRoomWalls(plan, roomId).some(wall => wall.id === module.position_json.wallId)) return { ok: false as const, code: 'MODULE_WALL_ROOM_MISMATCH', message: 'Select a measured wall belonging to this room.' };
  const anchor = resolveModuleWallAnchor(plan.walls, { wallId: module.position_json.wallId, offsetMm: module.position_json.offsetMm, zMm: module.position_json.zMm }, Number(module.config_json.widthMm));
  if (!anchor.ok) return anchor;
  const candidate = { ...module, position_json: anchor.anchor };
  const clearance = validateModuleClearance(candidate, plan, neighbours, roomId);
  if (!clearance.ok) return clearance;
  const compiled = compileStoredModuleForScene(candidate, plan.walls);
  if (!compiled.ok) return compiled;
  return { ok: true as const, candidate, partCount: compiled.parts.length };
}

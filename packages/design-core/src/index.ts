/**
 * design-core — Unified Design Workspace shared logic.
 *
 * Three modes:
 *  - builder:  interpret furniture-symbol candidates from plan analysis → editable symbolic placements (needs confirmation)
 *  - ai_auto: send structured geometry/requirements/rules to the planning model → symbolic placements (never screenshots)
 *  - manual:  direct placement + configuration
 *
 * AI PROPOSES. DETERMINISTIC RULES DECIDE VALIDITY. Approval creates an
 * immutable DesignVersion referencing the input plan/layout versions.
 */
import { z } from 'zod';
import {
  validatePlacements as layoutValidate, type LayoutInput, type Placement, type ValidationResult, type ValidationIssue,
  approveLayout, type LayoutApproval, type LayoutVersion, type InvalidationEvent, invalidateDownstream as layoutInvalidate,
} from '@ultida/layout-core';
import { COMPILER_REGISTRY, type CategoryType, type TemplateCompileInput, type TemplateCompileResult } from '@ultida/module-framework';

export type DesignMode = 'builder' | 'ai_auto' | 'manual';

// ── Symbolic placement: every placement references space, wall/room anchor, offset, rotation,
//    width/height/depth, template family, clearance zone. ──
export const SymbolicPlacementSchema = z.object({
  id: z.string().min(1),
  spaceId: z.string().min(1),
  category: z.enum(['kitchen', 'tv_unit', 'wardrobe', 'living', 'bedroom', 'dining', 'study', 'pooja', 'utility', 'foyer', 'bathroom', 'other']),
  templateFamily: z.string().min(1),
  anchor: z.enum(['wall', 'room', 'corner']).default('wall'),
  wallId: z.string().optional(),
  offsetMm: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotationDeg: z.number().default(0),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
  clearanceZoneMm: z.number().nonnegative().default(0),
  requiredServicePoints: z.array(z.string()).default([]),
  // Construction/archetype controls are preserved with the placement so the
  // module editor, scene compiler, drawings and cutlist all compile the same
  // physical assembly instead of reconstructing a generic box downstream.
  parameters: z.record(z.unknown()).default({}),
  materialSlots: z.record(z.string()).default({}), // part-semantic -> material code
  source: z.enum(['builder_symbol', 'ai_proposal', 'manual']),
  confirmed: z.boolean().default(false),
});
export type SymbolicPlacement = z.infer<typeof SymbolicPlacementSchema>;

export const MODULE_TEMPLATES: Array<{ family: CategoryType; label: string; order: number; defaultShape: string }> = [
  { family: 'tv_unit', label: 'TV Unit', order: 1, defaultShape: 'linear' },
  { family: 'wardrobe', label: 'Wardrobe', order: 2, defaultShape: 'linear' },
  { family: 'crockery_unit', label: 'Crockery', order: 3, defaultShape: 'linear' },
  { family: 'study_unit', label: 'Study', order: 4, defaultShape: 'linear' },
  { family: 'pooja_unit', label: 'Pooja', order: 5, defaultShape: 'linear' },
  { family: 'kitchen', label: 'Kitchen', order: 6, defaultShape: 'l_shaped' },
  { family: 'bed', label: 'Bed', order: 7, defaultShape: 'bed_centred' },
  { family: 'utility', label: 'Utility', order: 8, defaultShape: 'linear' },
];

export interface CompileModuleParams {
  family: CategoryType;
  templateVersionId?: string;
  parameters: Record<string, unknown>;
  wall: { id?: string; widthMm: number; heightMm: number; depthMm: number };
  instanceId?: string;
}
export function compileModule(params: CompileModuleParams): TemplateCompileResult {
  const compiler = COMPILER_REGISTRY[params.family];
  if (!compiler) throw new Error(`No module compiler for family "${params.family}".`);
  const input: TemplateCompileInput = {
    templateVersionId: params.templateVersionId ?? `tv-${params.family}`,
    parameters: params.parameters,
    wall: params.wall,
    instanceId: params.instanceId,
  };
  return compiler(input);
}

// ── Builder-plan interpretation ──
export interface AnalysisSymbolCandidate {
  id: string; spaceId: string; wallId?: string; category: string; xMm: number; yMm: number; widthMm: number; depthMm: number; heightMm: number;
}
export function builderPlanToSymbols(candidates: AnalysisSymbolCandidate[], opts?: { requireConfirmation?: boolean }): SymbolicPlacement[] {
  const requireConfirmation = opts?.requireConfirmation ?? true;
  return candidates.map((c) => ({
    id: `sym-${c.id}`,
    spaceId: c.spaceId,
    category: (['kitchen', 'tv_unit', 'wardrobe', 'living', 'bedroom', 'other'].includes(c.category) ? c.category : 'other') as SymbolicPlacement['category'],
    templateFamily: c.category,
    anchor: c.wallId ? 'wall' : 'room',
    wallId: c.wallId,
    offsetMm: [c.xMm, c.yMm, 0],
    rotationDeg: 0,
    widthMm: c.widthMm,
    heightMm: c.heightMm,
    depthMm: c.depthMm,
    clearanceZoneMm: 0,
    requiredServicePoints: [],
    parameters: {},
    materialSlots: {},
    source: 'builder_symbol',
    confirmed: !requireConfirmation,
  }));
}

// ── AI auto-layout: structured prompt (NO screenshot) ──
export interface AutoLayoutContext {
  spaceId: string; roomCategory: SymbolicPlacement['category']; shape: string;
  roomBoundingBoxMm: { minX: number; minY: number; maxX: number; maxY: number };
  usableWalls: LayoutInput['usableWalls'];
  openings: LayoutInput['openings'];
  servicePoints: LayoutInput['servicePoints'];
  requirements: Record<string, unknown>;
  companyRules: Record<string, unknown>;
}
export function buildAutoLayoutPrompt(ctx: AutoLayoutContext): string {
  return [
    'You are a modular interior planning model. Produce SYMBOLIC placements only (no raster/photo input).',
    `Space: ${ctx.spaceId} | Room: ${ctx.roomCategory} | Layout shape: ${ctx.shape}.`,
    `Room bounds (mm): ${JSON.stringify(ctx.roomBoundingBoxMm)}.`,
    `Usable walls: ${JSON.stringify(ctx.usableWalls)}.`,
    `Openings: ${JSON.stringify(ctx.openings)}.`,
    `Service points: ${JSON.stringify(ctx.servicePoints)}.`,
    `Requirements: ${JSON.stringify(ctx.requirements)}.`,
    `Company rules: ${JSON.stringify(ctx.companyRules)}.`,
    'Return JSON: { "placements": [ { "id","spaceId","category","templateFamily","wallId","offsetMm":[x,y,z],"rotationDeg","widthMm","heightMm","depthMm","clearanceZoneMm","materialSlots" } ] }.',
  ].join('\n');
}
export function parseAutoLayoutResponse(json: unknown): SymbolicPlacement[] {
  const parsed = z.object({ placements: z.array(z.any()) }).parse(json);
  return parsed.placements.map((p: any, i: number): SymbolicPlacement => SymbolicPlacementSchema.parse({
    id: p.id ?? `ai-${i}`,
    spaceId: p.spaceId,
    category: p.category ?? 'other',
    templateFamily: p.templateFamily,
    anchor: p.wallId ? 'wall' : 'room',
    wallId: p.wallId,
    offsetMm: p.offsetMm ?? [0, 0, 0],
    rotationDeg: p.rotationDeg ?? 0,
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    depthMm: p.depthMm,
    clearanceZoneMm: p.clearanceZoneMm ?? 0,
    materialSlots: p.materialSlots ?? {},
    parameters: p.parameters ?? {},
    source: 'ai_proposal',
    confirmed: false,
  }));
}

// ── Deterministic validation (extends layout-core + curtain/AC/filler/company rules) ──
export interface DesignValidationContext extends Omit<LayoutInput, 'placements'> {
  curtainZones?: Array<{ id: string; xMm: number; yMm: number; widthMm: number; depthMm: number }>;
  acUnits?: Array<{ id: string; xMm: number; yMm: number; clearanceMm: number }>;
}
function boxOf(p: SymbolicPlacement) {
  const [x, y] = p.offsetMm;
  return { minX: x, minY: y, maxX: x + p.widthMm, maxY: y + p.depthMm };
}
function overlaps(a: any, b: any, c: number) {
  return a.minX - c < b.maxX && a.minY - c < b.maxY && a.maxX + c > b.minX && a.maxY + c > b.minY;
}
export function validateDesign(placements: SymbolicPlacement[], ctx: DesignValidationContext): ValidationResult {
  // map to layout-core Placement shape
  const lcPlacements: Placement[] = placements.map((p) => ({
    id: p.id, category: p.category, templateFamily: p.templateFamily, anchor: p.anchor,
    wallRef: p.wallId, positionMm: p.offsetMm, rotationYawDeg: p.rotationDeg,
    widthMm: p.widthMm, depthMm: p.depthMm, heightMm: p.heightMm, clearanceMm: p.clearanceZoneMm,
    requiredServicePoints: p.requiredServicePoints, constraints: [],
  }));
  const layoutInput: LayoutInput = {
    projectId: ctx.projectId, spaceId: ctx.spaceId, roomCategory: ctx.roomCategory,
    floorPlanVersionId: ctx.floorPlanVersionId, shape: ctx.shape,
    candidateTypes: ctx.candidateTypes, requirements: ctx.requirements,
    roomBoundingBoxMm: ctx.roomBoundingBoxMm, usableWalls: ctx.usableWalls,
    openings: ctx.openings, servicePoints: ctx.servicePoints,
    structuralElements: ctx.structuralElements, companyRules: ctx.companyRules,
  };
  const base = layoutValidate(layoutInput, lcPlacements);
  const issues: ValidationIssue[] = [...base.issues];

  // Curtain zones
  for (const cz of ctx.curtainZones ?? []) {
    const czBox = { minX: cz.xMm, minY: cz.yMm, maxX: cz.xMm + cz.widthMm, maxY: cz.yMm + cz.depthMm };
    for (const p of placements) if (overlaps(boxOf(p), czBox, 0)) issues.push({ code: 'CURTAIN_ZONE', severity: 'warning', message: `Placement ${p.id} intrudes curtain zone ${cz.id}.`, entityIds: [p.id, cz.id] });
  }
  // AC clearance
  for (const ac of ctx.acUnits ?? []) {
    const acBox = { minX: ac.xMm - ac.clearanceMm, minY: ac.yMm - ac.clearanceMm, maxX: ac.xMm + ac.clearanceMm, maxY: ac.yMm + ac.clearanceMm };
    for (const p of placements) if (overlaps(boxOf(p), acBox, 0)) issues.push({ code: 'AC_CLEARANCE', severity: 'warning', message: `Placement ${p.id} violates AC clearance ${ac.id}.`, entityIds: [p.id, ac.id] });
  }
  // Fillers: top-of-wall filler required if module height < wall height - 50
  for (const p of placements) {
    const wall = ctx.usableWalls.find((w) => w.id === p.wallId);
    if (wall && p.heightMm < (wall.maxY - wall.minY) - 50 && p.source !== 'builder_symbol') {
      issues.push({ code: 'FILLER_REQUIRED', severity: 'warning', message: `Placement ${p.id} leaves a gap; add a filler panel.`, entityIds: [p.id] });
    }
  }
  // Company rules
  const rules = ctx.companyRules ?? {};
  if (rules.minWardrobeDepthMm && placements.some((p) => p.templateFamily.includes('wardrobe') && p.depthMm < Number(rules.minWardrobeDepthMm))) {
    issues.push({ code: 'COMPANY_RULE', severity: 'blocking', message: `Company rule: wardrobe depth >= ${rules.minWardrobeDepthMm}mm.`, entityIds: placements.filter((p) => p.templateFamily.includes('wardrobe')).map((p) => p.id) });
  }
  return { valid: issues.filter((i) => i.severity === 'blocking').length === 0, issues };
}

// ── Approval → immutable DesignVersion ──
export interface DesignVersion {
  id: string;
  projectId: string;
  spaceId: string;
  floorPlanVersionId: string;
  layoutShape: string;
  mode: DesignMode;
  placements: SymbolicPlacement[];
  moduleParts: Record<string, TemplateCompileResult>;
  materials: Record<string, Record<string, string>>;
  validation: ValidationResult;
  inputVersionReferences: { floorPlanVersionId: string; layoutVersionId?: string; sceneVersionId?: string };
  approvedAt: string;
  createdBy?: string;
}
export function approveDesign(args: {
  projectId: string; spaceId: string; floorPlanVersionId: string; layoutShape: string; mode: DesignMode;
  placements: SymbolicPlacement[]; moduleParts: Record<string, TemplateCompileResult>;
  materials: Record<string, Record<string, string>>; validation: ValidationResult;
  inputVersionReferences: { floorPlanVersionId: string; layoutVersionId?: string; sceneVersionId?: string };
  userId?: string;
}): DesignVersion {
  if (args.validation.valid === false) throw new Error('Cannot approve a design with blocking validation issues.');
  if (args.placements.some((p) => !p.confirmed)) throw new Error('All placements must be confirmed before approval.');
  return {
    id: `design-${Date.now().toString(36)}`,
    projectId: args.projectId, spaceId: args.spaceId, floorPlanVersionId: args.floorPlanVersionId,
    layoutShape: args.layoutShape, mode: args.mode, placements: args.placements,
    moduleParts: args.moduleParts, materials: args.materials, validation: args.validation,
    inputVersionReferences: args.inputVersionReferences, approvedAt: new Date().toISOString(), createdBy: args.userId,
  };
}

export function invalidateDownstream(version: DesignVersion, reason: string, targets: InvalidationEvent['targets'] = ['modules', 'scene', 'render', 'drawing', 'estimate']): InvalidationEvent[] {
  return layoutInvalidate(
    ({ id: version.id, projectId: version.projectId, spaceId: version.spaceId, floorPlanVersionId: version.floorPlanVersionId, shape: version.layoutShape, candidateType: 'balanced', placements: [], validation: version.validation, score: {} as any, active: true, createdAt: version.approvedAt, updatedAt: version.approvedAt } as unknown) as LayoutVersion,
    reason, targets
  );
}

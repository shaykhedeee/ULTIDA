import {
  CandidateTypeSchema,
  RoomCategorySchema,
  KitchenShapeSchema,
  TvUnitShapeSchema,
  WardrobeShapeSchema,
  LivingShapeSchema,
  BedroomShapeSchema,
  PlacementAnchorSchema,
  PlacementSchema,
  LayoutCandidateSchema,
  CandidateScoreSchema,
  ValidationResultSchema,
  ValidationIssueSchema,
  LayoutVersionSchema,
  InvalidationEventSchema,
  InvalidationTargetSchema,
  LayoutInputSchema,
  LayoutApprovalSchema,
} from './schema.js';
import { z } from 'zod';

export type CandidateType = z.infer<typeof CandidateTypeSchema>;
export type RoomCategory = z.infer<typeof RoomCategorySchema>;
export type KitchenShape = z.infer<typeof KitchenShapeSchema>;
export type TvUnitShape = z.infer<typeof TvUnitShapeSchema>;
export type WardrobeShape = z.infer<typeof WardrobeShapeSchema>;
export type LivingShape = z.infer<typeof LivingShapeSchema>;
export type BedroomShape = z.infer<typeof BedroomShapeSchema>;
export type PlacementAnchor = z.infer<typeof PlacementAnchorSchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type LayoutCandidate = z.infer<typeof LayoutCandidateSchema>;
export type CandidateScore = z.infer<typeof CandidateScoreSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type LayoutVersion = z.infer<typeof LayoutVersionSchema>;
export type InvalidationEvent = z.infer<typeof InvalidationEventSchema>;
export type InvalidationTarget = z.infer<typeof InvalidationTargetSchema>;
export type LayoutInput = z.infer<typeof LayoutInputSchema>;
export type LayoutApproval = z.infer<typeof LayoutApprovalSchema>;

const DEFAULT_CLEARANCE_MM = 900;
const MIN_WALL_LENGTH_MM = 1200;
const DEFAULT_SHAPE_WEIGHTS = {
  validity: 1,
  storage: 0.25,
  circulation: 0.25,
  symmetry: 0.15,
  manufacturingSimplicity: 0.2,
  cost: 0.15,
  userPriority: 0.25,
} as const;

export const SHAPE_CATALOG: Record<RoomCategory, string[]> = {
  kitchen: KitchenShapeSchema.options,
  tv_unit: TvUnitShapeSchema.options,
  wardrobe: WardrobeShapeSchema.options,
  living: LivingShapeSchema.options,
  bedroom: BedroomShapeSchema.options,
  other: [],
};

export function shapeCatalogFor(roomCategory: RoomCategory): Array<{ id: string; label: string; sub?: string }> {
  return SHAPE_CATALOG[roomCategory]?.map((id) => ({ id, label: formatShape(id) })) ?? [];
}

function formatShape(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generateCandidates(input: LayoutInput): LayoutCandidate[] {
  const parsed = LayoutInputSchema.parse(input);
  const shapes = SHAPE_CATALOG[parsed.roomCategory] ?? [];
  const candidateTypes = parsed.candidateTypes.length ? parsed.candidateTypes : ['balanced'];
  const candidates: LayoutCandidate[] = [];

  for (const candidateType of candidateTypes as CandidateType[]) {
    for (const shape of shapes) {
      const placements = derivePlacements({ ...parsed, shape, candidateType });
      const validation = validatePlacements(parsed, placements);
      const score = scoreCandidate({ ...parsed, shape, candidateType }, placements, validation);
      candidates.push(LayoutCandidateSchema.parse({
        id: `${parsed.spaceId}-${candidateType}-${shape}-${Date.now().toString(36)}`,
        category: parsed.roomCategory,
        shape,
        candidateType,
        placements,
        validation,
        score,
      }));
    }
  }

  return candidates.sort((a, b) => b.score.weighted - a.score.weighted);
}

function derivePlacements(input: LayoutInput & { shape: string; candidateType: CandidateType }): Placement[] {
  const { roomCategory, shape, candidateType, roomBoundingBoxMm, usableWalls } = input;
  const widthMm = Math.max(roomBoundingBoxMm.maxX - roomBoundingBoxMm.minX, MIN_WALL_LENGTH_MM);
  const depthMm = Math.max(roomBoundingBoxMm.maxY - roomBoundingBoxMm.minY, MIN_WALL_LENGTH_MM);
  const baseClearance = DEFAULT_CLEARANCE_MM;

  if (roomCategory === 'kitchen') {
    return kitchenPlacements(shape as KitchenShape, widthMm, depthMm, baseClearance, candidateType, usableWalls);
  }
  if (roomCategory === 'tv_unit') {
    return tvUnitPlacements(shape as TvUnitShape, widthMm, depthMm, baseClearance, candidateType);
  }
  if (roomCategory === 'wardrobe') {
    return wardrobePlacements(shape as WardrobeShape, widthMm, depthMm, baseClearance, candidateType);
  }
  if (roomCategory === 'living') {
    return livingPlacements(shape as LivingShape, widthMm, depthMm, baseClearance, candidateType);
  }
  if (roomCategory === 'bedroom') {
    return bedroomPlacements(shape as BedroomShape, widthMm, depthMm, baseClearance, candidateType);
  }

  return [
    PlacementSchema.parse({
      id: `${roomCategory}-main-${Date.now().toString(36)}`,
      category: roomCategory,
      templateFamily: `generic-${roomCategory}`,
      anchor: 'room',
      positionMm: [roomBoundingBoxMm.minX, roomBoundingBoxMm.minY, 0],
      rotationYawDeg: 0,
      widthMm,
      depthMm,
      heightMm: Math.min(depthMm, 900),
      clearanceMm: baseClearance,
      requiredServicePoints: [],
    }),
  ];
}

function kitchenPlacements(shape: KitchenShape, widthMm: number, depthMm: number, clearanceMm: number, candidateType: CandidateType, usableWalls: LayoutInput['usableWalls']): Placement[] {
  const baseDepth = candidateType === 'maximum_storage' ? 600 : candidateType === 'best_circulation' ? 500 : 550;
  if (shape === 'single_wall') {
    return [wallPlacement('kitchen-base', usableWalls[0], widthMm, baseDepth, 750, clearanceMm, ['plumbing', 'power'])];
  }
  if (shape === 'parallel') {
    return [wallPlacement('kitchen-base', usableWalls[0], widthMm, baseDepth, 750, clearanceMm, ['plumbing']), wallPlacement('kitchen-tall', usableWalls[1], widthMm, 350, 2100, clearanceMm, ['power'])];
  }
  if (shape === 'l_shaped') {
    return [wallPlacement('kitchen-base', usableWalls[0], widthMm, baseDepth, 750, clearanceMm, ['plumbing']), wallPlacement('kitchen-wall', usableWalls[1], depthMm * 0.6, baseDepth, 1200, clearanceMm, ['power'])];
  }
  if (shape === 'u_shaped') {
    return [wallPlacement('kitchen-base', usableWalls[0], widthMm, baseDepth, 750, clearanceMm, ['plumbing']), wallPlacement('kitchen-tall', usableWalls[1], depthMm * 0.3, 350, 2100, clearanceMm, ['power']), wallPlacement('kitchen-tall', usableWalls[2], depthMm * 0.3, 350, 2100, clearanceMm, ['power'])];
  }
  if (shape === 'peninsula') {
    return [wallPlacement('kitchen-base', usableWalls[0], widthMm, baseDepth, 750, clearanceMm, ['plumbing']), roomPlacement('kitchen-island', widthMm * 0.5, baseDepth, 750, 0, ['power'])];
  }
  if (shape === 'island') {
    return [roomPlacement('kitchen-island', widthMm * 0.6, depthMm * 0.45, 750, clearanceMm, ['plumbing', 'power'])];
  }
  return [wallPlacement('kitchen-base', usableWalls[0], widthMm, baseDepth, 750, clearanceMm, ['plumbing']), wallPlacement('kitchen-tall', usableWalls[2], widthMm * 0.4, 350, 2100, clearanceMm, ['power'])];
}

function tvUnitPlacements(shape: TvUnitShape, widthMm: number, depthMm: number, clearanceMm: number, candidateType: CandidateType): Placement[] {
  const baseDepth = candidateType === 'best_circulation' ? 350 : 450;
  if (shape === 'linear' || shape === 'floating' || shape === 'full_wall') {
    return [roomPlacement('tv-unit', widthMm, baseDepth, 600, clearanceMm, ['power'])];
  }
  if (shape === 'asymmetrical') {
    return [roomPlacement('tv-unit', widthMm * 0.75, baseDepth, 600, clearanceMm, ['power']), roomPlacement('tv-shelf', widthMm * 0.2, 250, 200, clearanceMm, [])];
  }
  if (shape === 'l_shaped') {
    return [roomPlacement('tv-unit', widthMm * 0.8, baseDepth, 600, clearanceMm, ['power']), roomPlacement('tv-unit-side', depthMm * 0.5, baseDepth, 600, clearanceMm, [])];
  }
  if (shape === 'partition') {
    return [roomPlacement('partition-tv', widthMm * 0.35, depthMm * 0.6, 2400, 0, ['power'])];
  }
  if (shape === 'tv_plus_study') {
    return [roomPlacement('tv-unit', widthMm * 0.65, baseDepth, 600, clearanceMm, ['power']), roomPlacement('study', widthMm * 0.3, 600, 750, clearanceMm, ['power'])];
  }
  return [roomPlacement('tv-unit', widthMm * 0.6, baseDepth, 600, clearanceMm, ['power']), roomPlacement('crockery', widthMm * 0.3, 400, 1200, clearanceMm, [])];
}

function wardrobePlacements(shape: WardrobeShape, widthMm: number, depthMm: number, clearanceMm: number, candidateType: CandidateType): Placement[] {
  const baseDepth = candidateType === 'maximum_storage' ? 700 : 600;
  if (shape === 'linear') {
    return [wallPlacement('wardrobe', null, widthMm, baseDepth, 2400, clearanceMm, [])];
  }
  if (shape === 'l_shaped') {
    return [wallPlacement('wardrobe', null, widthMm, baseDepth, 2400, clearanceMm, []), wallPlacement('wardrobe', null, depthMm * 0.35, baseDepth, 2400, clearanceMm, [])];
  }
  if (shape === 'walk_in') {
    return [roomPlacement('walk-in-wardrobe', widthMm * 0.55, depthMm * 0.45, 2400, clearanceMm, [])];
  }
  if (shape === 'wardrobe_plus_dresser') {
    return [wallPlacement('wardrobe', null, widthMm * 0.7, baseDepth, 2400, clearanceMm, []), roomPlacement('dresser', widthMm * 0.25, 450, 750, clearanceMm, [])];
  }
  if (shape === 'wardrobe_plus_study') {
    return [wallPlacement('wardrobe', null, widthMm * 0.65, baseDepth, 2400, clearanceMm, []), roomPlacement('study', widthMm * 0.3, 550, 750, clearanceMm, ['power'])];
  }
  return [wallPlacement('wardrobe', null, widthMm * 0.6, baseDepth, 2400, clearanceMm, []), roomPlacement('tv-unit', widthMm * 0.35, 400, 600, clearanceMm, ['power'])];
}

function livingPlacements(shape: LivingShape, widthMm: number, depthMm: number, clearanceMm: number, candidateType: CandidateType): Placement[] {
  if (shape === 'tv_opposite_sofa') {
    return [roomPlacement('sofa', widthMm * 0.65, 950, 850, clearanceMm, []), roomPlacement('tv-unit', widthMm * 0.65, 400, 600, clearanceMm, ['power'])];
  }
  if (shape === 'tv_adjacent_entrance') {
    return [roomPlacement('tv-unit', depthMm * 0.5, 400, 600, clearanceMm, ['power']), roomPlacement('sofa', widthMm * 0.6, 950, 850, clearanceMm, [])];
  }
  if (shape === 'l_seating') {
    return [roomPlacement('l-sofa', widthMm * 0.8, 950, 850, clearanceMm, []), roomPlacement('tv-unit', widthMm * 0.5, 400, 600, clearanceMm, ['power'])];
  }
  if (shape === 'parallel_seating') {
    return [roomPlacement('sofa-1', widthMm * 0.55, 900, 850, clearanceMm, []), roomPlacement('sofa-2', widthMm * 0.55, 900, 850, clearanceMm, [])];
  }
  if (shape === 'open_living_dining') {
    return [roomPlacement('sofa', widthMm * 0.6, 950, 850, clearanceMm, []), roomPlacement('dining-table', widthMm * 0.5, 800, 750, clearanceMm, [])];
  }
  return [roomPlacement('partition-seating', widthMm * 0.5, 850, 850, clearanceMm, []), roomPlacement('tv-unit', widthMm * 0.5, 400, 600, clearanceMm, ['power'])];
}

function bedroomPlacements(shape: BedroomShape, widthMm: number, depthMm: number, clearanceMm: number, candidateType: CandidateType): Placement[] {
  if (shape === 'bed_centred') {
    return [roomPlacement('bed-king', widthMm * 0.55, 2200, 1200, clearanceMm, []), wallPlacement('wardrobe', null, widthMm * 0.4, 600, 2400, clearanceMm, [])];
  }
  if (shape === 'side_wall_bed') {
    return [wallPlacement('bed', null, widthMm * 0.35, 2200, 1200, clearanceMm, []), wallPlacement('wardrobe', null, widthMm * 0.6, 600, 2400, clearanceMm, [])];
  }
  if (shape === 'wardrobe_opposite_bed') {
    return [roomPlacement('bed-king', widthMm * 0.5, 2200, 1200, clearanceMm, []), wallPlacement('wardrobe', null, widthMm * 0.6, 600, 2400, clearanceMm, [])];
  }
  if (shape === 'wardrobe_near_entrance') {
    return [wallPlacement('wardrobe', null, widthMm * 0.55, 600, 2400, clearanceMm, []), roomPlacement('bed-king', widthMm * 0.5, 2200, 1200, clearanceMm, [])];
  }
  return [wallPlacement('wardrobe', null, widthMm * 0.45, 600, 2400, clearanceMm, []), roomPlacement('study', widthMm * 0.4, 550, 750, clearanceMm, ['power', 'natural_light'])];
}

function wallPlacement(templateFamily: string, wall: { minX?: number; minY?: number; maxX?: number; maxY?: number } | null | undefined, widthMm: number, depthMm: number, heightMm: number, clearanceMm: number, requiredServicePoints: string[]): Placement {
  const positionMm: [number, number, number] = wall ? [(wall.minX ?? 0), (wall.minY ?? 0), 0] : [0, 0, 0];
  return PlacementSchema.parse({
    id: `${templateFamily}-${Date.now().toString(36)}`,
    category: inferCategory(templateFamily),
    templateFamily,
    anchor: 'wall',
    wallRef: wall ? 'wall-1' : undefined,
    positionMm,
    rotationYawDeg: 0,
    widthMm,
    depthMm,
    heightMm,
    clearanceMm,
    requiredServicePoints,
  });
}

function roomPlacement(templateFamily: string, widthMm: number, depthMm: number, heightMm: number, clearanceMm: number, requiredServicePoints: string[]): Placement {
  return PlacementSchema.parse({
    id: `${templateFamily}-${Date.now().toString(36)}`,
    category: inferCategory(templateFamily),
    templateFamily,
    anchor: 'room',
    positionMm: [0, 0, 0],
    rotationYawDeg: 0,
    widthMm,
    depthMm,
    heightMm,
    clearanceMm,
    requiredServicePoints,
  });
}

function inferCategory(templateFamily: string): LayoutCandidate['category'] {
  if (templateFamily.startsWith('kitchen')) return 'kitchen';
  if (templateFamily.startsWith('tv') || templateFamily.startsWith('crockery')) return 'tv_unit';
  if (templateFamily.startsWith('wardrobe') || templateFamily.startsWith('walk-in') || templateFamily.startsWith('dresser')) return 'wardrobe';
  if (templateFamily.startsWith('sofa') || templateFamily.startsWith('partition') || templateFamily.startsWith('dining')) return 'living';
  if (templateFamily.startsWith('bed') || templateFamily.startsWith('study')) return 'bedroom';
  return 'other';
}

export function validatePlacements(input: LayoutInput, placements: Placement[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const placement of placements) {
    issues.push(...validatePlacement(input, placement, placements));
  }
  return ValidationResultSchema.parse({ valid: issues.filter((issue) => issue.severity === 'blocking').length === 0, issues });
}

function validatePlacement(input: LayoutInput, placement: Placement, allPlacements: Placement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const box = placementBox(placement);
  if (!fitsInRoom(input.roomBoundingBoxMm, box)) {
    issues.push({ code: 'WALL_FIT', severity: 'blocking', message: `${placement.templateFamily} does not fit room bounds.`, entityIds: [placement.id] });
  }

  for (const opening of input.openings) {
    if (opening.type === 'door' && doorSwingBlocksPlacement(opening as LayoutInput['openings'][number] & { type: 'door' }, placement, box)) {
      issues.push({ code: 'DOOR_SWING', severity: 'blocking', message: 'Door swing blocks placement.', entityIds: [placement.id, opening.id] });
    }
    if (opening.type === 'window' && windowBlockedByPlacement(opening as LayoutInput['openings'][number] & { type: 'window' }, box)) {
      issues.push({ code: 'WINDOW_BLOCKED', severity: 'warning', message: 'Placement blocks window.', entityIds: [placement.id, opening.id] });
    }
  }

  for (const other of allPlacements) {
    if (other.id === placement.id) continue;
    const otherBox = placementBox(other);
    if (boxesOverlapWithClearance(box, otherBox, placement.clearanceMm)) {
      issues.push({ code: 'FURNITURE_COLLISION', severity: 'blocking', message: 'Furniture collision detected.', entityIds: [placement.id, other.id] });
    }
  }

  for (const service of input.servicePoints) {
    if (!placement.requiredServicePoints.includes(service.type) && withinServiceClearance(placement, service)) {
      issues.push({ code: 'SERVICE_ACCESS', severity: 'warning', message: `Requires ${service.type} access.`, entityIds: [placement.id] });
    }
  }

  for (const element of input.structuralElements as Array<{ id: string; type: string; xMm: number; yMm: number; widthMm: number; depthMm: number }>) {
    if (boxesOverlapWithClearance(box, elementBox(element), 0)) {
      issues.push({ code: 'CEILING_CONFLICT', severity: 'blocking', message: 'Structural element conflict.', entityIds: [placement.id, element.id] });
    }
  }

  if (placement.templateFamily.includes('kitchen-base') && !input.servicePoints.some((s) => s.type === 'plumbing')) {
    issues.push({ code: 'APPLIANCE_ACCESS', severity: 'warning', message: 'No plumbing service point found.', entityIds: [placement.id] });
  }
  if (placement.templateFamily.includes('wardrobe') && placement.depthMm < 550) {
    issues.push({ code: 'WARDROBE_OPENING', severity: 'warning', message: 'Wardrobe opening may be restricted.', entityIds: [placement.id] });
  }
  if (placement.templateFamily.includes('drawer') || placement.templateFamily.includes('kitchen-base')) {
    issues.push({ code: 'DRAWER_OPENING', severity: 'warning', message: 'Drawer opening space reduced.', entityIds: [placement.id] });
  }

  return issues;
}

function placementBox(placement: Placement) {
  const [cx, cy] = placement.positionMm;
  return { minX: cx, minY: cy, maxX: cx + placement.widthMm, maxY: cy + placement.depthMm };
}

function fitsInRoom(room: { minX: number; minY: number; maxX: number; maxY: number }, box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return box.minX >= room.minX && box.minY >= room.minY && box.maxX <= room.maxX && box.maxY <= room.maxY;
}

function doorSwingBlocksPlacement(opening: { type: 'door'; xMm: number; yMm: number; widthMm: number; heightMm: number; swingDeg?: number }, placement: Placement, box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  const swing = opening.swingDeg ?? 90;
  const swingRadius = opening.widthMm * (swing / 180) * Math.PI;
  const doorBox = { minX: opening.xMm - swingRadius, minY: opening.yMm - swingRadius, maxX: opening.xMm + swingRadius, maxY: opening.yMm + swingRadius };
  return boxesOverlapWithClearance(box, doorBox, 0);
}

function windowBlockedByPlacement(opening: { type: 'window'; xMm: number; yMm: number; widthMm: number; heightMm: number }, box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  const windowBox = { minX: opening.xMm - opening.widthMm / 2, minY: opening.yMm - 300, maxX: opening.xMm + opening.widthMm / 2, maxY: opening.yMm + 300 };
  return boxesOverlapWithClearance(box, windowBox, 200);
}

function boxesOverlapWithClearance(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }, clearanceMm: number) {
  const ax1 = a.minX - clearanceMm;
  const ay1 = a.minY - clearanceMm;
  const ax2 = a.maxX + clearanceMm;
  const ay2 = a.maxY + clearanceMm;
  const bx1 = b.minX - clearanceMm;
  const by1 = b.minY - clearanceMm;
  const bx2 = b.maxX + clearanceMm;
  const by2 = b.maxY + clearanceMm;
  return ax1 < bx2 && ay1 < by2 && ax2 > bx1 && ay2 > by1;
}

function elementBox(element: { xMm: number; yMm: number; widthMm: number; depthMm: number }) {
  return { minX: element.xMm, minY: element.yMm, maxX: element.xMm + element.widthMm, maxY: element.yMm + element.depthMm };
}

function withinServiceClearance(placement: Placement, service: { type: string; xMm: number; yMm: number }) {
  const box = placementBox(placement);
  return service.xMm >= box.minX - 800 && service.xMm <= box.maxX + 800 && service.yMm >= box.minY - 800 && service.yMm <= box.maxY + 800;
}

export function scoreCandidate(input: LayoutInput & { shape: string; candidateType: CandidateType }, placements: Placement[], validation: ValidationResult): CandidateScore {
  const blockingCount = validation.issues.filter((i) => i.severity === 'blocking').length;
  const warningCount = validation.issues.filter((i) => i.severity === 'warning').length;
  const validity = blockingCount === 0 ? 1 : Math.max(0, 1 - blockingCount * 0.2);
  const volume = placements.reduce((sum, p) => sum + p.widthMm * p.depthMm * p.heightMm, 0);
  const storage = input.roomCategory === 'wardrobe' || input.roomCategory === 'kitchen' ? Math.min(1, volume / 1_000_000_000) : Math.min(1, volume / 1_500_000_000);
  const circulation = Math.max(0, 1 - placements.reduce((sum, p) => sum + p.clearanceMm, 0) / 10_000);
  const symmetry = placements.length <= 2 ? 0.9 : 0.7;
  const manufacturingSimplicity = input.candidateType === 'cost_efficient' ? 0.95 : input.candidateType === 'maximum_storage' ? 0.7 : 0.85;
  const cost = input.candidateType === 'cost_efficient' ? 0.9 : input.candidateType === 'maximum_storage' ? 0.6 : 0.8;
  const userPriority = typeof input.requirements.user_priority_score === 'number' ? Math.min(1, input.requirements.user_priority_score as number) : 0.7;

  const weighted = sumWeighted([
    { value: validity, weight: DEFAULT_SHAPE_WEIGHTS.validity },
    { value: storage, weight: DEFAULT_SHAPE_WEIGHTS.storage },
    { value: circulation, weight: DEFAULT_SHAPE_WEIGHTS.circulation },
    { value: symmetry, weight: DEFAULT_SHAPE_WEIGHTS.symmetry },
    { value: manufacturingSimplicity, weight: DEFAULT_SHAPE_WEIGHTS.manufacturingSimplicity },
    { value: cost, weight: DEFAULT_SHAPE_WEIGHTS.cost },
    { value: userPriority, weight: DEFAULT_SHAPE_WEIGHTS.userPriority },
  ]);

  return CandidateScoreSchema.parse({ validity, storage, circulation, symmetry, manufacturingSimplicity, cost, userPriority, weighted });
}

function sumWeighted(items: Array<{ value: number; weight: number }>) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight === 0 ? 0 : items.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

export function approveLayout(input: LayoutApproval, candidate: LayoutCandidate, userId?: string): LayoutVersion {
  const parsed = LayoutApprovalSchema.parse({ ...input, userId });
  return LayoutVersionSchema.parse({
    id: `lv-${Date.now().toString(36)}`,
    projectId: parsed.projectId,
    spaceId: parsed.spaceId,
    floorPlanVersionId: parsed.floorPlanVersionId,
    shape: candidate.shape,
    candidateType: candidate.candidateType,
    placements: candidate.placements,
    validation: candidate.validation,
    score: candidate.score,
    active: true,
    approvedAt: new Date().toISOString(),
    createdBy: parsed.userId,
  });
}

export function invalidateDownstream(version: LayoutVersion, reason: string, targets: InvalidationTarget[] = ['modules', 'scene', 'render', 'drawing', 'estimate']): InvalidationEvent[] {
  return targets.map((target) => InvalidationEventSchema.parse({ id: `inv-${Date.now().toString(36)}-${target}`, projectId: version.projectId, sourceLayoutVersionId: version.id, targets: [target], reason }));
}

export function restoreApprovedVersion(versions: LayoutVersion[]): LayoutVersion | null {
  return versions.slice().reverse().find((v) => v.active && v.approvedAt) ?? null;
}

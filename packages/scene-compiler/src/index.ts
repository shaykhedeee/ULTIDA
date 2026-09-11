import { validateCanonicalPlan, type CanonicalPlanModel } from '@ultida/plan-core';
import { CompositionScheduleV1Schema, FloorSurfaceV1Schema, type CompositionScheduleV1, type FloorSurfaceV1 } from '@ultida/contracts';
import { SceneV1Schema, type SceneV1 } from '@ultida/scene-core';

export type CompiledModulePart = {
  id: string;
  moduleId?: string;
  roomId: string;
  family: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  xMm: number;
  yMm: number;
  zMm?: number;
  rotationDeg?: number;
  anchor?: 'floor' | 'wall' | 'ceiling' | 'free';
  materialId?: string;
  glbUrl?: string;
  semanticType?: string;
  name?: string;
  kind?: string;
  fixtureType?: string;
  colorTemperatureK?: number;
  lengthMm?: number;
};

export type SceneCompilerInput = {
  projectId: string;
  floorPlanVersionId: string;
  designVersion: string;
  plan: CanonicalPlanModel;
  modules?: CompiledModulePart[];
  moduleParts?: CompiledModulePart[];
  materials?: Array<{ id: string; name: string; code: string; finish?: string }>;
  compositionSchedules?: CompositionScheduleV1[];
  floorSurfaces?: FloorSurfaceV1[];
  changeReason?: string;
};

export type Wall = Pick<SceneV1['walls'][number], 'id' | 'start' | 'end'>;
export type Opening = Pick<SceneV1['openings'][number], 'id' | 'wallId' | 'kind' | 'offsetMm' | 'widthMm'>;
export type ModuleInstance = Pick<SceneV1['modules'][number], 'id' | 'widthMm' | 'position'>;
export type ReconciliationIssue = { code: string; message: string; severity: 'blocking' };
export type ReconciliationResult = {
  valid: boolean;
  blocking: boolean;
  bayTotalMm: number;
  deltaMm: number;
  issues: ReconciliationIssue[];
};

const BAY_TOLERANCE_MM = 0.5;

function formatMm(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value.toFixed(2)));
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB - BAY_TOLERANCE_MM && endA > startB + BAY_TOLERANCE_MM;
}

/**
 * Reconciles one measured wall composition before it can be rendered or
 * exported. This is intentionally pure so the same gate can run in the
 * compiler, library fit filtering, and every production endpoint.
 */
export function reconcileBays(schedule: CompositionScheduleV1, wall: Wall, openings: Opening[], modules: ModuleInstance[]): ReconciliationResult {
  const issues: ReconciliationIssue[] = [];
  const bayTotalMm = schedule.bays.reduce((sum, bay) => sum + bay.widthMm + (bay.fillerMm ?? 0), 0);
  const deltaMm = schedule.approvedUsableWidthMm - bayTotalMm;
  if (Math.abs(deltaMm) > BAY_TOLERANCE_MM) {
    const gap = Math.abs(deltaMm);
    issues.push({
      code: 'BAY_TOTAL_MISMATCH',
      severity: 'blocking',
      message: `Bay total is ${formatMm(bayTotalMm)}mm but approved usable wall is ${formatMm(schedule.approvedUsableWidthMm)}mm. ${formatMm(gap)}mm unresolved gap requires filler or dimension confirmation.`,
    });
  }
  if (!schedule.confirmed) {
    issues.push({ code: 'SCHEDULE_UNCONFIRMED', severity: 'blocking', message: `Wall ${schedule.wallId} composition dimensions are not confirmed by a designer.` });
  }

  const wallLengthMm = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
  if (schedule.leftClearanceMm + schedule.approvedUsableWidthMm + schedule.rightClearanceMm > wallLengthMm + BAY_TOLERANCE_MM) {
    issues.push({ code: 'USABLE_WIDTH_EXCEEDS_WALL', severity: 'blocking', message: `Approved usable wall ${formatMm(schedule.approvedUsableWidthMm)}mm plus clearances exceeds measured wall ${formatMm(wallLengthMm)}mm.` });
  }

  const wallOpenings = openings.filter((opening) => opening.wallId === wall.id);
  const bayRanges = schedule.bays.map((bay) => ({ bay, start: bay.offsetMm, end: bay.offsetMm + bay.widthMm }));
  for (const { bay, start, end } of bayRanges) {
    if (end > schedule.approvedUsableWidthMm + BAY_TOLERANCE_MM) {
      issues.push({ code: 'BAY_OUTSIDE_APPROVED_WIDTH', severity: 'blocking', message: `Bay ${bay.id} extends beyond approved usable wall ${formatMm(schedule.approvedUsableWidthMm)}mm.` });
    }
    if (bay.keepOut) {
      const matchingOpening = wallOpenings.find((opening) => Math.abs(opening.offsetMm - start) <= BAY_TOLERANCE_MM && Math.abs(opening.widthMm - bay.widthMm) <= BAY_TOLERANCE_MM);
      if (!matchingOpening) {
        issues.push({ code: 'KEEP_OUT_BAY_MISMATCH', severity: 'blocking', message: `Keep-out bay ${bay.id} must exactly match a measured door or window range on wall ${wall.id}.` });
      }
      continue;
    }

    const module = bay.moduleId ? modules.find((candidate) => candidate.id === bay.moduleId) : undefined;
    if (bay.moduleId && !module) {
      issues.push({ code: 'COMPOSITION_MODULE_MISSING', severity: 'blocking', message: `Bay ${bay.id} references missing module ${bay.moduleId}.` });
      continue;
    }
    if (!module) continue;
    if (Math.abs(module.widthMm - bay.widthMm) > BAY_TOLERANCE_MM) {
      issues.push({ code: 'BAY_MODULE_WIDTH_MISMATCH', severity: 'blocking', message: `Bay ${bay.id} is ${formatMm(bay.widthMm)}mm but module ${module.id} is ${formatMm(module.widthMm)}mm wide.` });
    }
    const dx = wall.end.xMm - wall.start.xMm;
    const dy = wall.end.yMm - wall.start.yMm;
    const wallLengthSquared = dx * dx + dy * dy;
    const moduleAlongWall = wallLengthSquared > 0
      ? ((module.position.xMm - wall.start.xMm) * dx + (module.position.yMm - wall.start.yMm) * dy) / wallLengthSquared * wallLengthMm
      : module.position.xMm;
    const moduleStart = moduleAlongWall - schedule.leftClearanceMm;
    const moduleEnd = moduleStart + module.widthMm;
    const opening = wallOpenings.find((candidate) => rangesOverlap(moduleStart, moduleEnd, candidate.offsetMm, candidate.offsetMm + candidate.widthMm));
    if (opening) {
      issues.push({ code: 'MODULE_KEEP_OUT_CONFLICT', severity: 'blocking', message: `Module ${module.id} in bay ${bay.id} overlaps measured ${opening.kind ?? 'opening'} ${opening.id} keep-out range on wall ${wall.id}.` });
    }
  }

  const sortedRanges = [...bayRanges].sort((a, b) => a.start - b.start);
  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previous = sortedRanges[index - 1];
    const current = sortedRanges[index];
    if (current.start < previous.end - BAY_TOLERANCE_MM) {
      issues.push({ code: 'BAY_OVERLAP', severity: 'blocking', message: `Bays ${previous.bay.id} and ${current.bay.id} overlap on wall ${wall.id}.` });
    }
  }

  return { valid: issues.length === 0, blocking: issues.length > 0, bayTotalMm, deltaMm, issues };
}

export type CatalogPlacementReconciliationInput = {
  wallId: string;
  wallLengthMm: number;
  openings: Opening[];
  module: { id: string; widthMm: number; position?: { xMm: number; yMm: number } };
  offsetMm: number;
  leftClearanceMm?: number;
  rightClearanceMm?: number;
  /** Only persisted designer confirmation may promote a fit to production certification. */
  confirmed?: boolean;
};

export type CatalogPlacementReconciliation = {
  reconciliation: ReconciliationResult;
  geometryValid: boolean;
  productionCertified: boolean;
};

/**
 * Builds a complete bay schedule around a proposed catalog placement, then
 * delegates to the same seven-rule gate used for scene compilation. A library
 * preview is deliberately unconfirmed until it has been saved to scene.v1.
 */
export function reconcileCatalogPlacement(input: CatalogPlacementReconciliationInput): CatalogPlacementReconciliation {
  const leftClearanceMm = input.leftClearanceMm ?? 0;
  const rightClearanceMm = input.rightClearanceMm ?? 0;
  const usableWidthMm = input.wallLengthMm - leftClearanceMm - rightClearanceMm;
  const entries = [
    ...input.openings.filter((opening) => opening.wallId === input.wallId).map((opening) => ({ id: `keep-out-${opening.id}`, startMm: opening.offsetMm, widthMm: opening.widthMm, keepOut: true as const })),
    { id: `module-${input.module.id}`, startMm: input.offsetMm, widthMm: input.module.widthMm, moduleId: input.module.id, keepOut: false as const },
  ].sort((a, b) => a.startMm - b.startMm);
  const bays: CompositionScheduleV1['bays'] = [];
  let cursor = 0;
  for (const entry of entries) {
    if (entry.startMm > cursor) bays.push({ id: `filler-${bays.length + 1}`, offsetMm: cursor, widthMm: entry.startMm - cursor, keepOut: false });
    bays.push({ id: entry.id, offsetMm: entry.startMm, widthMm: entry.widthMm, moduleId: 'moduleId' in entry ? entry.moduleId : undefined, keepOut: entry.keepOut });
    cursor = Math.max(cursor, entry.startMm + entry.widthMm);
  }
  if (cursor < usableWidthMm) bays.push({ id: `filler-${bays.length + 1}`, offsetMm: cursor, widthMm: usableWidthMm - cursor, keepOut: false });

  const schedule: CompositionScheduleV1 = {
    wallId: input.wallId,
    approvedUsableWidthMm: usableWidthMm,
    leftClearanceMm,
    rightClearanceMm,
    bays,
    confirmed: input.confirmed === true,
  };
  const reconciliation = reconcileBays(
    schedule,
    { id: input.wallId, start: { xMm: 0, yMm: 0 }, end: { xMm: input.wallLengthMm, yMm: 0 } },
    input.openings,
    [{ id: input.module.id, widthMm: input.module.widthMm, position: { xMm: input.offsetMm, yMm: 0, zMm: 0 } }]
  );
  const geometryValid = reconciliation.issues.every((issue) => issue.code === 'SCHEDULE_UNCONFIRMED');
  return { reconciliation, geometryValid, productionCertified: geometryValid && reconciliation.valid };
}

export function reconcileSceneBays(scene: SceneV1): ReconciliationResult[] {
  return (scene.compositions ?? []).map((composition) => {
    const wall = scene.walls.find((candidate) => candidate.id === composition.wallId);
    if (!wall) {
      return { valid: false, blocking: true, bayTotalMm: 0, deltaMm: 0, issues: [{ code: 'COMPOSITION_WALL_MISSING', severity: 'blocking', message: `Composition ${composition.id} references missing wall ${composition.wallId}.` }] };
    }
    const legacyFillerMm = composition.fillers.reduce((sum, filler) => sum + filler.widthMm, 0);
    const bays = composition.bays.map((bay, index, source) => ({
      id: bay.id,
      offsetMm: bay.offsetMm,
      widthMm: bay.widthMm,
      moduleId: bay.moduleId,
      keepOut: bay.keepOut,
      fillerMm: (bay.fillerMm ?? 0) + (index === source.length - 1 ? legacyFillerMm : 0),
    }));
    const parsed = CompositionScheduleV1Schema.safeParse({
      wallId: composition.wallId,
      approvedUsableWidthMm: composition.approvedUsableWidthMm ?? composition.usableWidthMm,
      leftClearanceMm: composition.leftClearanceMm,
      rightClearanceMm: composition.rightClearanceMm,
      bays,
      confirmed: composition.confirmed,
      confirmedBy: composition.confirmedBy,
      confirmedAt: composition.confirmedAt,
    });
    if (!parsed.success) {
      return { valid: false, blocking: true, bayTotalMm: 0, deltaMm: 0, issues: [{ code: 'COMPOSITION_CONTRACT_INVALID', severity: 'blocking', message: `Composition ${composition.id} does not satisfy the bay schedule contract.` }] };
    }
    return reconcileBays(parsed.data, wall, scene.openings, scene.modules);
  });
}

export class SceneCompilationError extends Error {
  constructor(public readonly issues: Array<{ code: string; message: string }>) {
    super('Scene compilation requires an approved, valid canonical plan.');
  }
}

export type SceneGraphNode = {
  id: string;
  kind: 'floor' | 'room' | 'wall' | 'opening' | 'module' | 'module-part';
  sourceId: string;
  dimensionsMm?: { widthMm: number; depthMm: number; heightMm: number };
  positionMm?: { xMm: number; yMm: number; zMm: number };
};

export type CompiledSceneGraph = {
  schema: 'scene-graph.v1';
  sceneVersion: '1.0';
  units: 'mm';
  coordinateSystem: 'right-handed-z-up';
  nodes: SceneGraphNode[];
  readiness: ReturnType<typeof checkRenderReadiness>;
  provenance: { compiler: 'scene-compiler@0.1.0'; generatedAt: string; provider?: string; model?: string };
};

export function checkRenderReadiness(scene: SceneV1) {
  const issues: Array<{ code: string; severity: 'warning' | 'critical'; message: string }> = [];
  const checkDuplicateIds = (items: Array<{ id: string }>, kind: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) issues.push({ code: 'DUPLICATE_SOURCE_ID', severity: 'critical', message: `Duplicate ${kind} id ${item.id} would make scene references ambiguous.` });
      seen.add(item.id);
    }
  };
  checkDuplicateIds(scene.walls, 'wall');
  checkDuplicateIds(scene.openings, 'opening');
  checkDuplicateIds(scene.modules, 'module');
  checkDuplicateIds(scene.moduleParts, 'module part');
  checkDuplicateIds(scene.compositions ?? [], 'composition');
  for (const wall of scene.walls) {
    if (wall.heightMm <= 0 || wall.thicknessMm <= 0) issues.push({ code: 'WALL_INVALID', severity: 'critical', message: `Wall ${wall.id} is missing valid dimensions.` });
  }
  for (const opening of scene.openings) {
    if (opening.kind === 'window' && opening.sillHeightMm < 0) issues.push({ code: 'UNVERIFIED_WINDOW_HEIGHT', severity: 'critical', message: `Window ${opening.id} has an invalid sill height.` });
  }
  for (const module of scene.modules) {
    if (![module.widthMm, module.depthMm, module.heightMm, module.position.xMm, module.position.yMm, module.position.zMm].every(Number.isFinite) || module.widthMm <= 0 || module.depthMm <= 0 || module.heightMm <= 0) issues.push({ code: 'MODULE_INVALID', severity: 'critical', message: `Module ${module.id} has invalid dimensions or position.` });
  }
  const partsByModule = new Set(scene.moduleParts.map((part) => part.moduleId));
  for (const module of scene.modules) {
    if (isPanelBasedFamily(module.family) && !partsByModule.has(module.id)) {
      issues.push({ code: 'MODULE_PARTS_MISSING', severity: 'critical', message: `Module ${module.id} must compile into cabinet parts before rendering.` });
    }
  }
  const moduleIds = new Set(scene.modules.map((module) => module.id));
  for (const part of scene.moduleParts) {
    if (!moduleIds.has(part.moduleId)) issues.push({ code: 'ORPHAN_MODULE_PART', severity: 'critical', message: `Module part ${part.id} references missing module ${part.moduleId}.` });
  }
  const bayReconciliations = reconcileSceneBays(scene);
  for (const [index, composition] of (scene.compositions ?? []).entries()) {
    const result = bayReconciliations[index];
    for (const issue of result?.issues ?? []) issues.push({ code: issue.code, severity: 'critical', message: issue.message });
    const bayIds = new Set<string>();
    const fillerIds = new Set<string>();
    for (const filler of composition.fillers) {
      if (fillerIds.has(filler.id)) issues.push({ code: 'DUPLICATE_FILLER_ID', severity: 'critical', message: `Composition ${composition.id} repeats filler id ${filler.id}.` });
      fillerIds.add(filler.id);
    }
    for (const bay of composition.bays) {
      if (bayIds.has(bay.id)) issues.push({ code: 'DUPLICATE_BAY_ID', severity: 'critical', message: `Composition ${composition.id} repeats bay id ${bay.id}.` });
      bayIds.add(bay.id);
      if (bay.moduleId && !moduleIds.has(bay.moduleId)) issues.push({ code: 'COMPOSITION_MODULE_MISSING', severity: 'critical', message: `Composition ${composition.id} contains a bay whose module is missing.` });
      const module = bay.moduleId ? scene.modules.find((candidate) => candidate.id === bay.moduleId) : undefined;
      if (module && Math.abs(module.widthMm - bay.widthMm) > 0.5) issues.push({ code: 'BAY_MODULE_WIDTH_MISMATCH', severity: 'critical', message: `Bay ${bay.id} is ${bay.widthMm} mm but module ${bay.moduleId} is ${module.widthMm} mm wide.` });
    }
  }
  const blockingCount = issues.filter((issue) => issue.severity === 'critical').length;
  return { ready: blockingCount === 0, blockingCount, warningCount: issues.length - blockingCount, issues };
}

export function compileScene(scene: SceneV1, provenance: { provider?: string; model?: string } = {}): CompiledSceneGraph {
  const parsed = SceneV1Schema.parse(scene);
  const readiness = checkRenderReadiness(parsed);
  const nodes: SceneGraphNode[] = [
    ...parsed.floors.map((floor) => ({ id: `floor-${floor.id}`, kind: 'floor' as const, sourceId: floor.id })),
    ...parsed.rooms.map((room) => ({ id: `room-${room.id}`, kind: 'room' as const, sourceId: room.id })),
    ...parsed.walls.map((wall) => ({ id: `wall-${wall.id}`, kind: 'wall' as const, sourceId: wall.id, dimensionsMm: { widthMm: Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm), depthMm: wall.thicknessMm, heightMm: wall.heightMm } })),
    ...parsed.openings.map((opening) => ({ id: `opening-${opening.id}`, kind: 'opening' as const, sourceId: opening.id, dimensionsMm: { widthMm: opening.widthMm, depthMm: 0, heightMm: opening.heightMm } })),
    ...parsed.modules.map((module) => ({ id: `module-${module.id}`, kind: 'module' as const, sourceId: module.id, dimensionsMm: { widthMm: module.widthMm, depthMm: module.depthMm, heightMm: module.heightMm }, positionMm: { xMm: module.position.xMm, yMm: module.position.yMm, zMm: module.position.zMm } })),
    ...parsed.moduleParts.map((part) => ({ id: `module-part-${part.id}`, kind: 'module-part' as const, sourceId: part.id, dimensionsMm: { widthMm: part.widthMm, depthMm: part.depthMm, heightMm: part.heightMm }, positionMm: part.position })),
  ];
  return { schema: 'scene-graph.v1', sceneVersion: '1.0', units: 'mm', coordinateSystem: 'right-handed-z-up', nodes, readiness, provenance: { compiler: 'scene-compiler@0.1.0', generatedAt: new Date().toISOString(), ...provenance } };
}

function polygonCenter(polygon: Array<{ xMm: number; yMm: number }>) {
  const points = polygon.slice(0, -1);
  const divisor = Math.max(points.length, 1);
  return points.reduce((sum, point) => ({ xMm: sum.xMm + point.xMm / divisor, yMm: sum.yMm + point.yMm / divisor }), { xMm: 0, yMm: 0 });
}

function compileRoomLighting(rooms: Array<{ id: string; type: string; boundary: Array<{ xMm: number; yMm: number }> }>, ceilingHeightMm: number) {
  return rooms.flatMap((room) => {
    const center = polygonCenter(room.boundary);
    const type = room.type.toLowerCase();
    const common = {
      spaceId: room.id,
      position: center,
      confidence: 1,
    };
    const fixtures: SceneV1['lighting'] = [{
      id: `light-${room.id}-ceiling`,
      ...common,
      kind: 'ambient' as const,
      fixture: 'ceiling-spot' as const,
      heightMm: Math.max(2200, ceilingHeightMm - 80),
      shadeDiameterMm: 90,
      colorTemperatureK: 3000,
      lumens: 700,
    }];
    if (/(living|lounge|hall)/.test(type)) fixtures.push({
      id: `light-${room.id}-floor`, ...common, kind: 'task' as const,
      fixture: 'floor-lamp' as const, heightMm: 1650, shadeDiameterMm: 380,
      colorTemperatureK: 2700, lumens: 800,
      position: { xMm: center.xMm + 700, yMm: center.yMm + 500 },
    });
    if (/bed/.test(type)) fixtures.push({
      id: `light-${room.id}-table`, ...common, kind: 'task' as const,
      fixture: 'table-lamp' as const, heightMm: 520, shadeDiameterMm: 280,
      colorTemperatureK: 2700, lumens: 420,
      position: { xMm: center.xMm + 650, yMm: center.yMm - 500 },
    });
    if (/dining/.test(type)) fixtures.push({
      id: `light-${room.id}-pendant`, ...common, kind: 'accent' as const,
      fixture: 'pendant' as const, heightMm: Math.max(1500, ceilingHeightMm - 900), shadeDiameterMm: 360,
      colorTemperatureK: 3000, lumens: 900,
    });
    return fixtures;
  });
}

function compileModuleLighting(moduleParts: SceneV1['moduleParts']): SceneV1['lighting'] {
  return moduleParts.flatMap((part) => {
    const isLighting =
      part.semanticType === 'lighting_anchor' ||
      part.kind === 'lighting_anchor' ||
      part.semanticType === 'lighting_channel';
    if (!isLighting) return [];

    let fixture: 'ceiling-spot' | 'floor-lamp' | 'table-lamp' | 'pendant' | 'cove' = 'cove';
    const ft = (part.fixtureType ?? '').toLowerCase();
    const name = (part.name ?? '').toLowerCase();
    if (ft === 'pendant' || name.includes('pendant')) fixture = 'pendant';
    else if (ft.includes('floor') || name.includes('floor')) fixture = 'floor-lamp';
    else if (ft.includes('table') || name.includes('table') || name.includes('desk')) fixture = 'table-lamp';
    else if (ft.includes('spot') || ft.includes('downlight') || ft.includes('ceiling') || name.includes('spot')) fixture = 'ceiling-spot';
    else if (ft.includes('strip') || ft.includes('channel') || ft.includes('led') || ft.includes('cove') || name.includes('led') || name.includes('strip')) fixture = 'cove';

    const kind: 'accent' | 'task' | 'ambient' =
      fixture === 'ceiling-spot'
        ? 'ambient'
        : fixture === 'table-lamp' || fixture === 'floor-lamp'
          ? 'task'
          : 'accent';

    const rawCct = Number(part.colorTemperatureK);
    const colorTemperatureK = Number.isFinite(rawCct) && rawCct >= 1800 && rawCct <= 6500
      ? Math.round(rawCct)
      : 3000;

    const xMm = Number(part.position?.xMm ?? 0);
    const yMm = Number(part.position?.yMm ?? 0);
    const zMm = Number(part.position?.zMm ?? 0);
    const heightMm = Math.max(50, Math.round(zMm > 0 ? zMm : (part.heightMm && part.heightMm > 0 ? part.heightMm : 100)));
    const shadeDiameterMm =
      fixture === 'ceiling-spot'
        ? 90
        : fixture === 'pendant'
          ? 300
          : fixture === 'floor-lamp'
            ? 380
            : fixture === 'table-lamp'
              ? 260
              : undefined;

    const lumens = Math.max(100, Math.round(part.lengthMm ? part.lengthMm * 0.8 : 650));

    return [{
      id: `light-mod-${part.id}`,
      spaceId: part.roomId,
      kind,
      fixture,
      position: { xMm, yMm },
      heightMm,
      shadeDiameterMm,
      colorTemperatureK,
      lumens,
      materialId: part.materialId,
      confidence: 1,
    }];
  });
}

export function compileSceneV1(input: SceneCompilerInput): SceneV1 {
  const validation = validateCanonicalPlan(input.plan);
  if (!validation.valid) {
    throw new SceneCompilationError(validation.issues.map((issue) => ({ code: issue.code, message: issue.message })));
  }

  const defaultFloorId = 'floor-1';
  const spaces = input.plan.spaces;
  const rooms = spaces.map((space) => ({
    id: space.id,
    spaceId: space.id,
    name: space.roomName ?? space.roomType,
    type: space.roomType,
    boundary: space.worldPolygon ?? space.sourcePolygon.map((point) => ({ xMm: point.x, yMm: point.y })),
    confidence: space.confidence ?? 1,
  }));
  const walls = input.plan.walls.map((wall) => ({
    id: wall.id,
    floorId: defaultFloorId,
    start: wall.worldStart,
    end: wall.worldEnd,
    thicknessMm: wall.thicknessMm ?? 0,
    heightMm: wall.heightMm ?? 0,
    baseElevationMm: 0,
    spaceIds: wall.adjacentSpaces,
    confidence: wall.confidence ?? 1,
  }));
  const openings = input.plan.openings.map((opening) => {
    const isWindow = 'sillMm' in opening;
    return {
      id: opening.id,
      wallId: opening.wallId,
      kind: isWindow ? 'window' as const : 'door' as const,
      offsetMm: opening.offsetMm,
      widthMm: opening.widthMm,
      heightMm: isWindow ? opening.headMm! - opening.sillMm! : opening.heightMm,
      sillHeightMm: isWindow ? opening.sillMm! : 0,
      confidence: opening.confidence ?? 1,
    };
  });
  const modules = (input.modules ?? []).map((module) => ({
    id: module.id,
    roomId: module.roomId,
    family: module.family,
    widthMm: module.widthMm,
    depthMm: module.depthMm,
    heightMm: module.heightMm,
    position: { xMm: module.xMm, yMm: module.yMm, zMm: module.zMm ?? 0 },
    rotationDeg: module.rotationDeg ?? 0,
    anchor: module.anchor ?? 'floor',
    materialId: module.materialId,
    glbUrl: module.glbUrl,
    confidence: 1,
  }));
  const moduleParts = (input.moduleParts ?? []).map((part) => ({
    id: part.id,
    moduleId: part.moduleId ?? part.id,
    roomId: part.roomId,
    semanticType: part.semanticType ?? 'component',
    name: part.name ?? part.family,
    widthMm: part.widthMm,
    depthMm: part.depthMm,
    heightMm: part.heightMm,
    position: { xMm: part.xMm, yMm: part.yMm, zMm: part.zMm ?? 0 },
    rotationDeg: part.rotationDeg ?? 0,
    materialId: part.materialId,
    confidence: 1,
    kind: part.kind,
    fixtureType: part.fixtureType,
    colorTemperatureK: part.colorTemperatureK,
    lengthMm: part.lengthMm,
  }));
  const firstRoom = rooms[0];
  const cameraCenter = firstRoom ? polygonCenter(firstRoom.boundary) : { xMm: 0, yMm: 0 };
  const focalModule = modules.find((module) => module.roomId === firstRoom?.id);
  const focalAngle = (focalModule?.rotationDeg ?? 0) * Math.PI / 180;
  const cameraTarget = focalModule
    ? { xMm: focalModule.position.xMm + Math.cos(focalAngle) * focalModule.widthMm / 2, yMm: Math.max(600, (focalModule.position.zMm ?? 0) + focalModule.heightMm / 2), zMm: focalModule.position.yMm + Math.sin(focalAngle) * focalModule.widthMm / 2 }
    : { xMm: cameraCenter.xMm, yMm: 1200, zMm: cameraCenter.yMm + 1000 };
  const compositions = (input.compositionSchedules ?? []).map((candidate, index) => {
    const parsedSchedule = CompositionScheduleV1Schema.safeParse(candidate);
    if (!parsedSchedule.success) throw new SceneCompilationError([{ code: 'COMPOSITION_CONTRACT_INVALID', message: `Composition schedule ${index + 1} does not satisfy the bay schedule contract.` }]);
    const schedule = parsedSchedule.data;
    const wall = walls.find((item) => item.id === schedule.wallId);
    const result = wall
      ? reconcileBays(schedule, wall, openings, modules)
      : { valid: false, issues: [{ code: 'COMPOSITION_WALL_MISSING', message: `Composition schedule references missing measured wall ${schedule.wallId}.` }] };
    if (!result.valid) throw new SceneCompilationError(result.issues.map((issue) => ({ code: issue.code, message: issue.message })));
    return {
      id: `${schedule.wallId}:composition:${index + 1}`,
      wallId: schedule.wallId,
      usableWidthMm: schedule.approvedUsableWidthMm,
      approvedUsableWidthMm: schedule.approvedUsableWidthMm,
      leftClearanceMm: schedule.leftClearanceMm,
      rightClearanceMm: schedule.rightClearanceMm,
      bays: schedule.bays.map((bay) => ({ ...bay })),
      fillers: [],
      confirmed: schedule.confirmed,
      confirmedBy: schedule.confirmedBy,
      confirmedAt: schedule.confirmedAt,
    };
  });
  const floorSurfaces = (input.floorSurfaces ?? []).map((candidate, index) => {
    const surface = FloorSurfaceV1Schema.parse(candidate);
    const room = rooms.find((item) => item.id === surface.roomId);
    if (!room) throw new SceneCompilationError([{ code: 'FLOOR_SURFACE_ROOM_MISSING', message: `Floor surface ${surface.id} references missing room ${surface.roomId}.` }]);
    return { ...surface, regionPolygon: surface.regionPolygon.map((point) => ({ ...point })), tile: surface.tile ? { ...surface.tile } : undefined, skirting: surface.skirting ? { ...surface.skirting, doorwayExclusions: surface.skirting.doorwayExclusions.map((range) => ({ ...range })) } : undefined };
  });

    const roomLighting = compileRoomLighting(rooms, input.plan.ceilingHeightMm);
    const moduleLighting = compileModuleLighting(moduleParts);
    const seenLightingIds = new Set<string>();
    const combinedLighting: SceneV1['lighting'] = [];
    for (const item of [...roomLighting, ...moduleLighting]) {
      if (!seenLightingIds.has(item.id)) {
        seenLightingIds.add(item.id);
        combinedLighting.push(item);
      }
    }

    return SceneV1Schema.parse({
      schema: 'scene.v1',
      units: 'mm',
      coordinateSystem: 'right-handed-z-up',
      projectId: input.projectId,
      floorPlanVersionId: input.floorPlanVersionId,
      floors: [{ id: defaultFloorId, name: 'Ground Floor', elevationMm: 0, heightMm: input.plan.ceilingHeightMm, surfaces: floorSurfaces }],
      spaces: spaces.map((space) => ({ id: space.id, floorId: defaultFloorId, name: space.roomName ?? space.roomType, type: space.roomType })),
      rooms,
      walls,
      openings,
      fixedFixtures: [],
      modules,
      moduleParts,
      compositions,
      materials: input.materials ?? [],
      lighting: combinedLighting,
    // Cameras use renderer Y-up coordinates; plan Y becomes camera Z.
    cameras: [{ id: 'camera-default', name: 'Perspective', position: { xMm: cameraCenter.xMm, yMm: 1500, zMm: cameraCenter.yMm }, target: cameraTarget, lensMm: 24 }],
    constraints: [],
    unresolvedDetections: [],
    metadata: { branch: 'main', status: 'draft', changeReason: input.changeReason ?? 'Compiled from approved plan.v1', schemaVersion: 'scene.v1', designVersion: input.designVersion },
  });
}

function isPanelBasedFamily(family: string) {
  return /tv|wardrobe|kitchen|crockery|study|pooja|utility/i.test(family);
}

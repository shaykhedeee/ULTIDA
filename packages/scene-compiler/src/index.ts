import { validateCanonicalPlan, type CanonicalPlanModel } from '@ultida/plan-core';
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
  semanticType?: string;
  name?: string;
};

export type SceneCompilerInput = {
  projectId: string;
  floorPlanVersionId: string;
  designVersion: string;
  plan: CanonicalPlanModel;
  modules?: CompiledModulePart[];
  moduleParts?: CompiledModulePart[];
  materials?: Array<{ id: string; name: string; code: string; finish?: string }>;
  changeReason?: string;
};

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
  for (const wall of scene.walls) {
    if (wall.heightMm <= 0 || wall.thicknessMm <= 0) issues.push({ code: 'WALL_INVALID', severity: 'critical', message: `Wall ${wall.id} is missing valid dimensions.` });
  }
  for (const opening of scene.openings) {
    if (opening.kind === 'window' && opening.sillHeightMm < 0) issues.push({ code: 'UNVERIFIED_WINDOW_HEIGHT', severity: 'critical', message: `Window ${opening.id} has an invalid sill height.` });
  }
  for (const module of scene.modules) {
    if (module.widthMm <= 0 || module.depthMm <= 0 || module.heightMm <= 0) issues.push({ code: 'MODULE_INVALID', severity: 'critical', message: `Module ${module.id} has invalid dimensions.` });
  }
  const partsByModule = new Set(scene.moduleParts.map((part) => part.moduleId));
  for (const module of scene.modules) {
    if (isPanelBasedFamily(module.family) && !partsByModule.has(module.id)) {
      issues.push({ code: 'MODULE_PARTS_MISSING', severity: 'critical', message: `Module ${module.id} must compile into cabinet parts before rendering.` });
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
    ...parsed.modules.map((module) => ({ id: `module-${module.id}`, kind: 'module' as const, sourceId: module.id, dimensionsMm: { widthMm: module.widthMm, depthMm: module.depthMm, heightMm: module.heightMm }, positionMm: { xMm: module.position.xMm, yMm: module.position.yMm, zMm: 0 } })),
    ...parsed.moduleParts.map((part) => ({ id: `module-part-${part.id}`, kind: 'module-part' as const, sourceId: part.id, dimensionsMm: { widthMm: part.widthMm, depthMm: part.depthMm, heightMm: part.heightMm }, positionMm: part.position })),
  ];
  return { schema: 'scene-graph.v1', sceneVersion: '1.0', units: 'mm', coordinateSystem: 'right-handed-z-up', nodes, readiness, provenance: { compiler: 'scene-compiler@0.1.0', generatedAt: new Date().toISOString(), ...provenance } };
}

function polygonCenter(polygon: Array<{ xMm: number; yMm: number }>) {
  const points = polygon.slice(0, -1);
  const divisor = Math.max(points.length, 1);
  return points.reduce((sum, point) => ({ xMm: sum.xMm + point.xMm / divisor, yMm: sum.yMm + point.yMm / divisor }), { xMm: 0, yMm: 0 });
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
    position: { xMm: module.xMm, yMm: module.yMm },
    rotationDeg: module.rotationDeg ?? 0,
    anchor: module.anchor ?? 'floor',
    materialId: module.materialId,
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
  }));
  const firstRoom = rooms[0];
  const cameraCenter = firstRoom ? polygonCenter(firstRoom.boundary) : { xMm: 0, yMm: 0 };

  return SceneV1Schema.parse({
    schema: 'scene.v1',
    units: 'mm',
    coordinateSystem: 'right-handed-z-up',
    projectId: input.projectId,
    floorPlanVersionId: input.floorPlanVersionId,
    floors: [{ id: defaultFloorId, name: 'Ground Floor', elevationMm: 0, heightMm: input.plan.ceilingHeightMm }],
    spaces: spaces.map((space) => ({ id: space.id, floorId: defaultFloorId, name: space.roomName ?? space.roomType, type: space.roomType })),
    rooms,
    walls,
    openings,
    fixedFixtures: [],
    modules,
    moduleParts,
    materials: input.materials ?? [],
    lighting: [],
    cameras: [{ id: 'camera-default', name: 'Perspective', position: { xMm: cameraCenter.xMm, yMm: cameraCenter.yMm - 1800, zMm: 1500 }, target: { xMm: cameraCenter.xMm, yMm: cameraCenter.yMm, zMm: 1200 }, lensMm: 35 }],
    constraints: [],
    unresolvedDetections: [],
    metadata: { branch: 'main', status: 'draft', changeReason: input.changeReason ?? 'Compiled from approved plan.v1', schemaVersion: 'scene.v1', designVersion: input.designVersion },
  });
}

function isPanelBasedFamily(family: string) {
  return /tv|wardrobe|kitchen|crockery|study|pooja|utility/i.test(family);
}

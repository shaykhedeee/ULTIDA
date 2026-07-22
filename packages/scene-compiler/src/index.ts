import { z } from 'zod';

const PointMm = z.object({ xMm: z.number().finite(), yMm: z.number().finite() });
const Confidence = z.number().min(0).max(1);
const Id = z.string().min(1).regex(/^[A-Za-z][A-Za-z0-9_.:-]*$/);
const Polygon = z.array(PointMm).min(3);

const BaseSceneSchema = z.object({
  schema: z.literal('scene.v1'),
  units: z.literal('mm'),
  coordinateSystem: z.literal('right-handed-z-up'),
  projectId: Id,
  floorPlanVersionId: Id,
  floors: z.array(z.object({ id: Id, name: z.string(), elevationMm: z.number().finite(), heightMm: z.number().positive() })).min(1),
  spaces: z.array(z.object({ id: Id, floorId: Id, name: z.string(), type: z.string() })),
  rooms: z.array(z.object({ id: Id, spaceId: Id, name: z.string(), type: z.string(), boundary: Polygon, confidence: Confidence })),
  walls: z.array(z.object({ id: Id, floorId: Id, start: PointMm, end: PointMm, thicknessMm: z.number().positive(), heightMm: z.number().positive(), baseElevationMm: z.number().nonnegative().default(0), spaceIds: z.array(Id).default([]), confidence: Confidence })),
  openings: z.array(z.object({ id: Id, wallId: Id, kind: z.enum(['door','window','passage']), offsetMm: z.number().nonnegative(), widthMm: z.number().positive(), heightMm: z.number().positive(), sillHeightMm: z.number().nonnegative().default(0), confidence: Confidence })),
  fixedFixtures: z.array(z.object({ id: Id, spaceId: Id, kind: z.string(), anchor: PointMm, widthMm: z.number().positive(), depthMm: z.number().positive(), confidence: Confidence })),
  modules: z.array(z.object({ id: Id, roomId: Id, family: z.string(), widthMm: z.number().positive(), depthMm: z.number().positive(), heightMm: z.number().positive(), position: PointMm, rotationDeg: z.number().finite(), anchor: z.enum(['floor','wall','ceiling','free']), materialId: Id.optional(), confidence: Confidence })),
  materials: z.array(z.object({ id: Id, name: z.string(), code: z.string(), unitCost: z.number().nonnegative().optional(), finish: z.string().optional() })),
  lighting: z.array(z.object({ id: Id, spaceId: Id, kind: z.enum(['ambient','task','accent','natural']), position: PointMm, confidence: Confidence })),
  cameras: z.array(z.object({ id: Id, name: z.string(), position: z.object({ xMm: z.number(), yMm: z.number(), zMm: z.number() }), target: z.object({ xMm: z.number(), yMm: z.number(), zMm: z.number() }), lensMm: z.number().positive() })),
  constraints: z.array(z.object({ id: Id, kind: z.string(), severity: z.enum(['advisory','warning','critical']), description: z.string(), entityIds: z.array(Id) })),
  unresolvedDetections: z.array(z.object({ id: Id, kind: z.string(), description: z.string(), confidence: Confidence, source: z.string() })),
  metadata: z.object({ branch: z.string(), status: z.enum(['draft','review','approved','locked','superseded']), changeReason: z.string(), schemaVersion: z.literal('scene.v1'), designVersion: z.string() })
});
type BaseScene = z.infer<typeof BaseSceneSchema>;

export type NodeType = 'room_shell' | 'wall' | 'opening' | 'floor' | 'ceiling' | 'column' | 'module' | 'part' | 'fixture' | 'light' | 'camera' | 'material' | 'metadata';

export type SceneNode = {
  id: string;
  nodeType: NodeType;
  sourceEntityId: string;
  parentId?: string;
  transform: {
    translationMm: [number, number, number];
    rotationDeg?: number;
    scaleMm?: [number, number, number];
  };
  geometry?: {
    geometryType: 'box' | 'plane' | 'opening' | 'light_volume' | 'camera_frustum';
    sizeMm?: [number, number, number];
    polygonMm?: [number, number][];
    wallId?: string;
    openingId?: string;
  };
  materialId?: string;
  metadata?: Record<string, unknown>;
};

export type SceneGraph = {
  sceneVersion: '1.0';
  units: 'mm';
  coordinateSystem: 'right-handed-z-up';
  projectId: string;
  floorPlanVersionId: string;
  nodes: SceneNode[];
  materialLibrary: CompiledMaterial[];
  lights: LightDefinition[];
  cameras: CameraDefinition[];
  provenance: VersionProvenance;
  warnings: string[];
  readiness: RenderReadiness;
};

export type CompiledMaterial = {
  id: string;
  name: string;
  category: string;
  brand?: string;
  code?: string;
  textureAsset?: string;
  textureWidthMm?: number;
  textureHeightMm?: number;
  roughness?: number;
  metalness?: number;
  reflectivity?: number;
  transparency?: number;
  normalStrength?: number;
  thicknessMm?: number;
  grainDirection?: 'horizontal' | 'vertical' | 'none';
  edgeTreatment?: string;
};

export type LightDefinition = {
  id: string;
  type: 'ambient' | 'point' | 'directional' | 'linear' | 'spot';
  parentModuleId?: string;
  anchor?: string;
  startMm: [number, number, number];
  endMm?: [number, number, number];
  colourTemperatureKelvin?: number;
  intensityLumens?: number;
  beamAngleDeg?: number;
};

export type CameraDefinition = {
  id: string;
  positionMm: [number, number, number];
  targetMm: [number, number, number];
  focalLengthMm: number;
  sensorWidthMm?: number;
  verticalCorrection?: boolean;
  aspectRatio?: string;
};

export type VersionProvenance = {
  projectId: string;
  floorPlanVersionId: string;
  designVersion: string;
  sceneVersion: string;
  layoutVersionId?: string;
  materialPaletteVersion?: string;
  lightingVersion?: string;
  promptVersion?: string;
  provider?: string;
  model?: string;
  geometryLock: 'strict' | 'moderate' | 'creative';
  generatedAt: string;
  compiler: 'scene-compiler@0.1.0';
};

export type ReadinessCode = 'PLAN_SCALE_UNVERIFIED' | 'ROOM_POLYGON_INVALID' | 'WALL_POLYGON_INVALID' | 'UNVERIFIED_WINDOW_HEIGHT' | 'UNVERIFIED_DOOR' | 'MISSING_MATERIAL' | 'MODULE_INVALID';

export type ReadinessIssue = {
  code: ReadinessCode;
  severity: 'blocking' | 'warning';
  message: string;
  entityIds: string[];
};

export type RenderReadiness = {
  ready: boolean;
  blockingCount: number;
  warningCount: number;
  issues: ReadinessIssue[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finitePositive(value: number | undefined | null): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function finite(value: number | undefined | null): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function add(node: SceneNode, nodes: SceneNode[]) {
  nodes.push(node);
}

function wallLengthMm(wall: BaseScene['walls'][number]) {
  return Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
}

function roomPolygonAreaMm2(polygon: Array<{ xMm: number; yMm: number }>) {
  let area = 0;
  for (let i = 0, len = polygon.length; i < len; i += 1) {
    const j = (i + 1) % len;
    area += polygon[i].xMm * polygon[j].yMm;
    area -= polygon[j].xMm * polygon[i].yMm;
  }
  return Math.abs(area / 2);
}

const FALLBACK_FLOOR_ID = 'floor-1';
const DEFAULT_CEILING_HEIGHT_MM = 2700;
const DEFAULT_WALL_THICKNESS_MM = 150;

// ---------------------------------------------------------------------------
// Room / wall / opening compilation
// ---------------------------------------------------------------------------

function compileRoomShells(scene: BaseScene, nodes: SceneNode[], warnings: string[]) {
  const floor =
    scene.floors.find((candidate) => candidate.id) ??
    scene.floors[0] ??
    ({ id: FALLBACK_FLOOR_ID, elevationMm: 0, heightMm: DEFAULT_CEILING_HEIGHT_MM } as BaseScene['floors'][number]);

  const floorNode: SceneNode = {
    id: `floor-${floor.id}`,
    nodeType: 'floor',
    sourceEntityId: floor.id,
    transform: { translationMm: [0, floor.elevationMm, 0] },
    geometry: { geometryType: 'plane' },
    metadata: { floorId: floor.id, elevationMm: floor.elevationMm, heightMm: floor.heightMm }
  };
  add(floorNode, nodes);

  const ceilingHeightMm = finitePositive(floor.heightMm) ? floor.heightMm : DEFAULT_CEILING_HEIGHT_MM;
  const ceilingNode: SceneNode = {
    id: `ceiling-${floor.id}`,
    nodeType: 'ceiling',
    sourceEntityId: floor.id,
    parentId: floorNode.id,
    transform: { translationMm: [0, floor.elevationMm + ceilingHeightMm, 0] },
    geometry: { geometryType: 'plane' },
    metadata: { floorId: floor.id, heightMm: ceilingHeightMm }
  };
  add(ceilingNode, nodes);

  const spaces = scene.spaces ?? [];
  const rooms = scene.rooms ?? [];

  for (const room of rooms) {
    if (!Array.isArray(room.boundary) || room.boundary.length < 3) {
      warnings.push(`Room ${room.id} boundary is invalid and was skipped.`);
      continue;
    }
    const spaceMatch = spaces.find((space) => space.id === room.spaceId);
    const ceilingMm = spaceMatch && finite((spaceMatch as any).ceilingHeightMm) ? (spaceMatch as any).ceilingHeightMm : ceilingHeightMm;

    const roomNode: SceneNode = {
      id: `room-${room.id}`,
      nodeType: 'room_shell',
      sourceEntityId: room.id,
      transform: { translationMm: [0, 0, 0] },
      geometry: {
        geometryType: 'plane',
        polygonMm: room.boundary.map((point) => [point.xMm, point.yMm])
      },
      metadata: {
        spaceId: room.spaceId,
        roomType: room.type,
        areaMm2: roomPolygonAreaMm2(room.boundary)
      }
    };
    add(roomNode, nodes);

    const roomWalls = (scene.walls ?? []).filter((wall) => Array.isArray(wall.spaceIds) && wall.spaceIds.includes(room.id));
    for (const wall of roomWalls) {
      const lengthMm = wallLengthMm(wall);
      if (!finitePositive(lengthMm)) {
        warnings.push(`Wall ${wall.id} in room ${room.id} has invalid length and was skipped.`);
        continue;
      }
      const wallHeightMm = finitePositive(wall.heightMm) ? wall.heightMm : ceilingMm;
      const thicknessMm = finitePositive(wall.thicknessMm) ? wall.thicknessMm : DEFAULT_WALL_THICKNESS_MM;
      const ux = (wall.end.xMm - wall.start.xMm) / lengthMm;
      const uy = (wall.end.yMm - wall.start.yMm) / lengthMm;
      const normalX = -uy;
      const normalY = ux;
      const midZ = (wall.baseElevationMm ?? 0) + wallHeightMm / 2;
      const midX = (wall.start.xMm + wall.end.xMm) / 2 + normalX * thicknessMm / 2;
      const midY = (wall.start.yMm + wall.end.yMm) / 2 + normalY * thicknessMm / 2;

      const wallNode: SceneNode = {
        id: `wall-${wall.id}`,
        nodeType: 'wall',
        sourceEntityId: wall.id,
        parentId: roomNode.id,
        transform: { translationMm: [midX, midZ, midY], rotationDeg: Math.atan2(uy, ux) * (180 / Math.PI), scaleMm: [lengthMm, wallHeightMm, thicknessMm] },
        geometry: { geometryType: 'box' },
        metadata: {
          wallId: wall.id,
          spaceIds: wall.spaceIds,
          floorId: wall.floorId,
          thicknessMm,
          baseElevationMm: wall.baseElevationMm ?? 0,
          heightMm: wallHeightMm
        }
      };
      add(wallNode, nodes);

      for (const opening of scene.openings ?? []) {
        if (opening.wallId !== wall.id || !finitePositive(opening.widthMm)) continue;
        const openingHeightMm = finitePositive(opening.heightMm) ? opening.heightMm : 0;
        const offsetMm = finite(opening.offsetMm) ? Math.max(0, opening.offsetMm) : 0;
        const sillHeightMm = finite(opening.sillHeightMm) ? opening.sillHeightMm : 0;
        const t = Math.max(0, Math.min(1, offsetMm / lengthMm));
        const baseX = wall.start.xMm + t * (wall.end.xMm - wall.start.xMm);
        const baseY = wall.start.yMm + t * (wall.end.yMm - wall.start.yMm);
        const midOpenZ = sillHeightMm + openingHeightMm / 2;
        const midOpenX = baseX + normalX * thicknessMm / 2;
        const midOpenY = baseY + normalY * thicknessMm / 2;
        add(
          {
            id: `opening-${opening.id}`,
            nodeType: 'opening',
            sourceEntityId: opening.id,
            parentId: wallNode.id,
            transform: { translationMm: [midOpenX, midOpenZ, midOpenY], rotationDeg: Math.atan2(uy, ux) * (180 / Math.PI), scaleMm: [opening.widthMm, openingHeightMm, thicknessMm + 2] },
            geometry: { geometryType: 'opening', wallId: wall.id, openingId: opening.id },
            metadata: {
              openingId: opening.id,
              wallId: wall.id,
              kind: opening.kind,
              offsetMm,
              widthMm: opening.widthMm,
              heightMm: openingHeightMm,
              sillHeightMm
            }
          },
          nodes
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Module / part compilation
// ---------------------------------------------------------------------------

type ModulePart = {
  id: string;
  type: string;
  offsetMm: [number, number, number];
  widthMm: number;
  depthMm: number;
  heightMm: number;
  materialId?: string;
  bomMetadata?: Record<string, unknown>;
  semanticLabel: string;
};

function buildModuleParts(module: BaseScene['modules'][number]): ModulePart[] {
  const widthMm = module.widthMm;
  const heightMm = module.heightMm;
  const depthMm = module.depthMm;
  const floorClearanceMm = module.anchor === 'wall' ? Math.min(250, Math.max(100, Math.abs(heightMm * 0.12))) : 0;
  const baseHeightMm = Math.min(320, Math.max(220, heightMm * 0.22));
  const topPanelMm = Math.max(12, heightMm * 0.035);

  const parts: ModulePart[] = [
    {
      id: `${module.id}-base-carcass`,
      type: 'carcass',
      offsetMm: [0, floorClearanceMm, 0],
      widthMm,
      depthMm,
      heightMm: baseHeightMm,
      bomMetadata: { panelCount: 2, materialSlot: 'carcass' },
      semanticLabel: 'Base carcass'
    },
    {
      id: `${module.id}-top-panel`,
      type: 'panel',
      offsetMm: [0, floorClearanceMm + baseHeightMm, 0],
      widthMm,
      depthMm,
      heightMm: topPanelMm,
      bomMetadata: { panelCount: 1, materialSlot: 'top_panel' },
      semanticLabel: 'Top panel'
    }
  ];
  if (finitePositive(module.position.xMm) || finitePositive(module.position.yMm) || finitePositive((module.position as any).zMm)) {
    const cx = module.position.xMm;
    const cz = (module.position as any).zMm ?? module.position.yMm;
    const cy = module.position.yMm ?? 0;
    parts.push({
      id: `${module.id}-back-panel`,
      type: 'panel',
      offsetMm: [cx + widthMm * 0.1, cy + floorClearanceMm + baseHeightMm + (heightMm - floorClearanceMm - baseHeightMm - topPanelMm - 12) / 2, cz - depthMm * 0.08],
      widthMm: widthMm * 0.8,
      depthMm: Math.max(8, depthMm * 0.08),
      heightMm: Math.max(8, heightMm - floorClearanceMm - baseHeightMm - topPanelMm - 20),
      materialId: module.materialId,
      semanticLabel: 'Back panel'
    });
  }
  if (finitePositive(floorClearanceMm)) {
    parts.push({
      id: `${module.id}-skirting`,
      type: 'skirting',
      offsetMm: [0, Math.max(0, floorClearanceMm - Math.max(20, floorClearanceMm * 0.2)), 0],
      widthMm,
      depthMm: Math.max(15, depthMm * 0.12),
      heightMm: Math.max(20, floorClearanceMm * 0.9),
      bomMetadata: { profile: 'skirting' },
      semanticLabel: 'Skirting'
    });
  }
  return parts;
}

function compileModuleParts(module: BaseScene['modules'][number], nodes: SceneNode[], warnings: string[]) {
  const base: SceneNode = {
    id: module.id,
    nodeType: 'module',
    sourceEntityId: module.id,
    transform: { translationMm: [module.position.xMm, module.position.yMm ?? 0, (module.position as any).zMm ?? module.position.yMm], rotationDeg: module.rotationDeg ?? 0, scaleMm: [module.widthMm, module.heightMm, module.depthMm] },
    geometry: { geometryType: 'box', sizeMm: [module.widthMm, module.heightMm, module.depthMm] },
    materialId: module.materialId,
    metadata: {
      roomId: module.roomId,
      family: module.family,
      anchor: module.anchor,
      widthMm: module.widthMm,
      depthMm: module.depthMm,
      heightMm: module.heightMm
    }
  };
  add(base, nodes);
  const parts = buildModuleParts(module);
  for (const part of parts) {
    if (![part.widthMm, part.depthMm, part.heightMm].every((value) => finitePositive(value))) {
      warnings.push(`Part ${part.id} in ${module.id} has invalid size and was skipped.`);
      continue;
    }
    add(
      {
        id: part.id,
        nodeType: 'part',
        sourceEntityId: part.id,
        parentId: base.id,
        transform: { translationMm: part.offsetMm, scaleMm: [part.widthMm, part.heightMm, part.depthMm] },
        geometry: { geometryType: 'box', sizeMm: [part.widthMm, part.heightMm, part.depthMm] },
        materialId: part.materialId,
        metadata: {
          partType: part.type,
          parentModuleId: module.id,
          bomMetadata: part.bomMetadata,
          semanticLabel: part.semanticLabel
        }
      },
      nodes
    );
  }
}

// ---------------------------------------------------------------------------
// Lights / cameras / materials
// ---------------------------------------------------------------------------

function compileLights(scene: BaseScene, nodes: SceneNode[], lights: LightDefinition[]) {
  lights.push(
    ...(scene.lighting ?? []).map((light) => ({
      id: light.id,
      type: light.kind === 'natural' ? 'directional' : (light.kind as LightDefinition['type']),
      parentModuleId: undefined,
      anchor: undefined,
      startMm: [light.position.xMm, light.position.yMm, (light.position as any).zMm ?? light.position.yMm] as [number, number, number],
      endMm: undefined,
      colourTemperatureKelvin: light.kind === 'task' ? 4000 : light.kind === 'accent' ? 3000 : 3000,
      intensityLumens: 1200,
      beamAngleDeg: ['spot', 'task', 'accent'].includes(light.kind as any) ? 35 : undefined
    }))
  );

  const pm = (point: { xMm: number; yMm: number }, zCoord = point.yMm): [number, number, number] => [point.xMm, zCoord, point.yMm];

  for (const light of scene.lighting ?? []) {
    add(
      {
        id: `light-${light.id}`,
        nodeType: 'light',
        sourceEntityId: light.id,
        transform: { translationMm: pm(light.position) },
        geometry: { geometryType: 'light_volume' },
        metadata: { lightId: light.id }
      },
      nodes
    );
  }
}

function compileCameras(scene: BaseScene, nodes: SceneNode[], graph: SceneGraph) {
  const pm = (point: { xMm: number; yMm: number; zMm?: number }, fallbackZ = point.yMm): [number, number, number] => [point.xMm, point.yMm, point.zMm ?? fallbackZ];
  for (const camera of scene.cameras ?? []) {
    graph.cameras.push({
      id: camera.id,
      positionMm: pm(camera.position),
      targetMm: pm(camera.target),
      focalLengthMm: camera.lensMm,
      sensorWidthMm: 36,
      verticalCorrection: true,
      aspectRatio: '16:9'
    });
    add(
      {
        id: `camera-${camera.id}`,
        nodeType: 'camera',
        sourceEntityId: camera.id,
        transform: { translationMm: pm(camera.position) },
        geometry: { geometryType: 'camera_frustum' },
        metadata: { cameraId: camera.id }
      },
      nodes
    );
  }
}

function compileMaterials(scene: BaseScene, graph: SceneGraph) {
  graph.materialLibrary = (scene.materials ?? []).map((material) => ({
    id: material.id,
    name: material.name,
    category: material.finish ?? 'laminate',
    code: material.code,
    unitCost: material.unitCost,
    roughness: 0.55,
    transparency: 0,
    grainDirection: 'none' as const
  }));
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export function checkRenderReadiness(scene: BaseScene): RenderReadiness {
  const issues: Array<{ code: ReadinessCode; severity: 'blocking' | 'warning'; message: string; entityIds: string[] }> = [];

  for (const room of scene.rooms ?? []) {
    if (!Array.isArray(room.boundary) || room.boundary.length < 3) issues.push({ code: 'ROOM_POLYGON_INVALID', severity: 'blocking', message: `Room ${room.id} boundary is invalid.`, entityIds: [room.id] });
  }
  for (const wall of scene.walls ?? []) {
    if (!finitePositive(wallLengthMm(wall))) issues.push({ code: 'WALL_POLYGON_INVALID', severity: 'blocking', message: `Wall ${wall.id} is invalid.`, entityIds: [wall.id] });
  }
  for (const opening of scene.openings ?? []) {
    if (!finitePositive(opening.sillHeightMm) || !finitePositive(opening.heightMm)) issues.push({ code: 'UNVERIFIED_WINDOW_HEIGHT', severity: 'blocking', message: `Opening ${opening.id} height is unverified.`, entityIds: [opening.id] });
  }
  for (const module of scene.modules ?? []) {
    if (!finitePositive(module.widthMm) || !finitePositive(module.depthMm) || !finitePositive(module.heightMm)) issues.push({ code: 'MODULE_INVALID', severity: 'blocking', message: `Module ${module.id} has invalid size.`, entityIds: [module.id] });
  }

  const blockingCount = issues.filter((issue) => issue.severity === 'blocking').length;
  return { ready: blockingCount === 0, blockingCount, warningCount: issues.filter((issue) => issue.severity === 'warning').length, issues: issues as any };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function compileScene(scene: BaseScene, provenance: Partial<VersionProvenance> = {}): SceneGraph {
  const validated = BaseSceneSchema.parse(scene);
  const warnings: string[] = [];
  const nodes: SceneNode[] = [];
  const lights: LightDefinition[] = [];

  compileRoomShells(validated, nodes, warnings);
  for (const module of validated.modules ?? []) {
    compileModuleParts(module, nodes, warnings);
  }
  compileLights(validated, nodes, lights);
  compileCameras(validated, nodes, {} as SceneGraph);

  const graph: SceneGraph = {
    sceneVersion: '1.0',
    units: 'mm',
    coordinateSystem: 'right-handed-z-up',
    projectId: validated.projectId,
    floorPlanVersionId: validated.floorPlanVersionId,
    nodes,
    materialLibrary: [],
    lights,
    cameras: [],
    provenance: {
      projectId: validated.projectId,
      floorPlanVersionId: validated.floorPlanVersionId,
      designVersion: validated.metadata.designVersion,
      sceneVersion: validated.metadata.schemaVersion,
      layoutVersionId: provenance.layoutVersionId,
      materialPaletteVersion: provenance.materialPaletteVersion,
      lightingVersion: provenance.lightingVersion,
      promptVersion: provenance.promptVersion,
      provider: provenance.provider,
      model: provenance.model,
      geometryLock: 'strict',
      generatedAt: new Date().toISOString(),
      compiler: 'scene-compiler@0.1.0'
    },
    warnings,
    readiness: checkRenderReadiness(validated)
  };
  compileMaterials(validated, graph);
  return graph;
}

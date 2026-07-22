export type PlanIssue = { id: string; code?: string; severity?: string; resolved?: boolean };
export type SpaceModel = {
  id: string;
  roomType: string;
  ceilingHeightMm: number;
  wallRefs?: string[];
  openingRefs?: string[];
  verification?: string;
  requiredFurniture?: string[];
};
export type RequirementModel = {
  room_type: string;
  ceilingHeightMm: number;
  existingFixedItems?: string[];
  requiredFurniture?: string[];
};

export type RoomRequirements = Record<string, unknown> & RequirementModel;

export type ReadinessResult = {
  readyForLayout: boolean;
  blockedByPlanIssue: boolean;
  incompleteRequirements: string[];
};

export function calculateReadiness(space: SpaceModel, requirements: RequirementModel, issues: PlanIssue[] = []): ReadinessResult {
  const incomplete: string[] = [];
  if (!space.roomType) incomplete.push('room_type');
  if (!requirements.ceilingHeightMm || requirements.ceilingHeightMm <= 0) incomplete.push('ceiling_height');
  if (!space.verification || space.verification !== 'verified') incomplete.push('geometry');
  if (!requirements.requiredFurniture?.length) incomplete.push('required_furniture');
  if (!requirements.existingFixedItems?.length) incomplete.push('key_restrictions');
  const blocking = issues.some((issue) => issue.severity === 'critical' && !issue.resolved);
  return {
    readyForLayout: incomplete.length === 0 && !blocking,
    blockedByPlanIssue: blocking,
    incompleteRequirements: incomplete,
  };
}

export function deriveSpaceFromPlanVersion(space: {
  id: string;
  roomType: string;
  roomName?: string;
  ceilingHeightMm?: number;
  wallRefs?: string[];
  openingRefs?: string[];
  verification?: string;
  requiredFurniture?: string[];
  areaMm2?: number;
  worldPolygon?: Array<{ xMm: number; yMm: number }>;
  sourcePolygon?: Array<{ x: number; y: number }>;
}) {
  const worldPoints = space.worldPolygon ?? (space.sourcePolygon?.map((pt) => ({ xMm: pt.x, yMm: pt.y })) ?? []);
  const areaMm2 = space.areaMm2 ?? polygonAreaMm2(worldPoints);
  return {
    id: space.id,
    name: space.roomName ?? space.roomType,
    roomType: space.roomType,
    areaSqm: Number((areaMm2 / 1_000_000).toFixed(2)),
    dimensionsText: formatDimensions(areaMm2),
    ceilingHeightMm: space.ceilingHeightMm ?? 2700,
    usableWalls: Math.max(space.wallRefs?.length ?? 0, 0),
    floorFinish: '',
    falseCeiling: '',
    requiredFurniture: space.requiredFurniture ?? [],
    verification: space.verification ?? 'unverified',
    isConfigured: false,
  };
}

function polygonAreaMm2(polygon: Array<{ xMm: number; yMm: number }>) {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].xMm * polygon[j].yMm;
    area -= polygon[j].xMm * polygon[i].yMm;
  }
  return Math.abs(area / 2);
}

function formatDimensions(areaMm2: number) {
  if (!Number.isFinite(areaMm2) || areaMm2 <= 0) return '';
  const side = Math.sqrt(areaMm2);
  const widthMm = Math.round(side);
  const lengthMm = Math.round(areaMm2 / (widthMm || 1));
  const metres = (v: number) => `${(v / 1000).toFixed(2)}m`;
  return `${metres(widthMm)} × ${metres(lengthMm)}`;
}

export function categoryRequirementsFor(roomType: string) {
  const base = {
    roomType,
    required_furniture: [] as string[],
  } as Record<string, unknown>;

  if (roomType === 'living') {
    base.living = { tv_size_inch: undefined, seating_count: undefined, pooja_unit: undefined, display: false, study: false, partition: false, crockery: false };
  }
  if (roomType === 'bedroom') {
    base.bedroom = { bed_size: undefined, wardrobe: undefined, dresser: false, study: false, tv: false, side_tables: undefined, storage: undefined };
  }
  if (roomType === 'kitchen') {
    base.kitchen = { shape: undefined, appliances: [], sink: undefined, hob: undefined, chimney: undefined, fridge: undefined, pantry: false, dishwasher: false, utility: false };
  }
  return base;
}

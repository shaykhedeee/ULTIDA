import { generateCandidates } from '@ultida/layout-core';

/** Shared read-only candidate preparation for explicit review and atomic placement setup. */
export async function computeRoomLayoutCandidates(client: any, projectId: string, input: any): Promise<{status:number;body:any}> {
  const { spaceId, roomCategory, candidateTypes, requirements, shape } = input ?? {};
  if (typeof spaceId !== 'string' || typeof roomCategory !== 'string') {
    return { status: 400, body: { success: false, code: 'INVALID_LAYOUT_INPUT', message: 'spaceId and roomCategory are required.' } };
  }
  const project = await client.from('projects').select('active_floor_plan_version_id').eq('id', projectId).single();
  if (project.error || !project.data?.active_floor_plan_version_id) return { status: 409, body: { success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'An active approved floor plan is required.' } };
  const [spaceResult, planResult] = await Promise.all([
    client.from('spaces').select('*').eq('id', spaceId).eq('project_id', projectId).eq('floor_plan_version_id', project.data.active_floor_plan_version_id).single(),
    client.from('floor_plan_versions').select('id,canonical_model').eq('id', project.data.active_floor_plan_version_id).single(),
  ]);
  if (spaceResult.error || !spaceResult.data) return { status: 404, body: { success: false, code: 'SPACE_NOT_FOUND', message: 'The selected room is not part of the active approved plan.' } };
  if (spaceResult.data.requirements_json?.included === false) return { status: 409, body: { success: false, code: 'SPACE_OUT_OF_SCOPE', message: 'Include this room in Spaces before generating a layout.' } };
  if (spaceResult.data.status !== 'configured') return { status: 409, body: { success: false, code: 'SPACE_CONFIGURATION_REQUIRED', message: 'Save this room’s requirements and scene setup before generating layouts.' } };
  if (planResult.error || !planResult.data) return { status: 404, body: { success: false, code: 'PLAN_NOT_FOUND', message: 'The active approved plan could not be loaded.' } };
  const plan = (planResult.data.canonical_model ?? {}) as any;
  const rooms = Array.isArray(plan.rooms) ? plan.rooms : Array.isArray(plan.spaces) ? plan.spaces : [];
  const normalizeRoomLabel = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const plannedRoomName = spaceResult.data.name ?? spaceResult.data.room_type ?? spaceId;
  const plannedRoomWords = new Set(normalizeRoomLabel(`${plannedRoomName} ${spaceResult.data.room_type ?? ''}`).split(' ').filter(word => word.length > 2 && word !== 'room'));
  const matchingByName = rooms.filter((item: any) => normalizeRoomLabel(item.name ?? item.roomType ?? item.type) === normalizeRoomLabel(plannedRoomName));
  const matchingByType = rooms.filter((item: any) => normalizeRoomLabel(item.roomType ?? item.type) === normalizeRoomLabel(spaceResult.data.room_type));
  const matchingByDistinctWord = rooms.filter((item: any) => normalizeRoomLabel(`${item.id ?? ''} ${item.name ?? ''} ${item.roomType ?? item.type ?? ''}`).split(' ').some(word => plannedRoomWords.has(word)));
  const room = rooms.find((item: any) => item.id === spaceResult.data.space_id)
    ?? rooms.find((item: any) => item.id === spaceId)
    ?? (matchingByName.length === 1 ? matchingByName[0] : null)
    ?? (matchingByType.length === 1 ? matchingByType[0] : null)
    ?? (matchingByDistinctWord.length === 1 ? matchingByDistinctWord[0] : null);
  const polygon = room?.worldPolygon ?? room?.worldGeometry?.polygon ?? room?.polygon ?? spaceResult.data.geometry_json?.polygon ?? [];
  const points = Array.isArray(polygon) ? polygon.map((point: any) => ({ x: Number(point.xMm ?? point.x ?? point[0]), y: Number(point.yMm ?? point.y ?? point[1]) })).filter((point: any) => Number.isFinite(point.x) && Number.isFinite(point.y)) : [];
  if (points.length < 3) return { status: 422, body: { success: false, code: 'ROOM_GEOMETRY_UNAVAILABLE', message: 'The approved room has no valid canonical polygon.' } };
  const minX = Math.min(...points.map((point: any) => point.x));
  const maxX = Math.max(...points.map((point: any) => point.x));
  const minY = Math.min(...points.map((point: any) => point.y));
  const maxY = Math.max(...points.map((point: any) => point.y));
  const walls = Array.isArray(plan.walls) ? plan.walls : [];
  let usableWalls = walls.map((wall: any) => {
    const start = wall.worldStart ?? wall.worldGeometry?.start ?? wall.start;
    const end = wall.worldEnd ?? wall.worldGeometry?.end ?? wall.end;
    if (!start || !end) return null;
    return { id: String(wall.id), minX: Math.min(Number(start.xMm ?? start.x), Number(end.xMm ?? end.x)), minY: Math.min(Number(start.yMm ?? start.y), Number(end.yMm ?? end.y)), maxX: Math.max(Number(start.xMm ?? start.x), Number(end.xMm ?? end.x)), maxY: Math.max(Number(start.yMm ?? start.y), Number(end.yMm ?? end.y)), orientation: Math.abs(Number(end.xMm ?? end.x) - Number(start.xMm ?? start.x)) >= Math.abs(Number(end.yMm ?? end.y) - Number(start.yMm ?? start.y)) ? 'north' : 'east' };
  }).filter((wall: any) => wall && wall.maxX >= minX - 250 && wall.minX <= maxX + 250 && wall.maxY >= minY - 250 && wall.minY <= maxY + 250);
  // AI plans can contain valid room loops before every shared wall is fully
  // reconciled. Layout still needs stable, measured wall anchors, so derive
  // missing boundary edges from the accepted room polygon.
  if (usableWalls.length < 3) {
    usableWalls = points.map((point: any, index: number) => {
      const next = points[(index + 1) % points.length];
      const horizontal = Math.abs(next.x - point.x) >= Math.abs(next.y - point.y);
      return {
        id: `room-boundary-${spaceId}-${index + 1}`,
        minX: Math.min(point.x, next.x), minY: Math.min(point.y, next.y),
        maxX: Math.max(point.x, next.x), maxY: Math.max(point.y, next.y),
        orientation: horizontal ? (point.y <= (minY + maxY) / 2 ? 'north' : 'south') : (point.x <= (minX + maxX) / 2 ? 'west' : 'east'),
      };
    }).filter((wall: any) => Math.hypot(wall.maxX - wall.minX, wall.maxY - wall.minY) >= 300);
  }
  const usableWallIds = new Set(usableWalls.map((wall: any) => String(wall.id)));
  const openings = (Array.isArray(plan.openings) ? plan.openings : []).map((opening: any) => {
    const wall = walls.find((candidate: any) => String(candidate.id) === String(opening.wallId));
    const start = wall?.worldStart ?? wall?.worldGeometry?.start ?? wall?.start;
    const end = wall?.worldEnd ?? wall?.worldGeometry?.end ?? wall?.end;
    const offset = Number(opening.offsetMm ?? opening.offsetAlongWallMm ?? 0);
    const length = start && end ? Math.hypot(Number(end.xMm ?? end.x) - Number(start.xMm ?? start.x), Number(end.yMm ?? end.y) - Number(start.yMm ?? start.y)) : 0;
    const t = length > 0 ? Math.max(0, Math.min(1, offset / length)) : 0;
    const xMm = Number(opening.worldPosition?.xMm ?? opening.xMm ?? (start ? Number(start.xMm ?? start.x) + (Number(end.xMm ?? end.x) - Number(start.xMm ?? start.x)) * t : offset));
    const yMm = Number(opening.worldPosition?.yMm ?? opening.yMm ?? (start ? Number(start.yMm ?? start.y) + (Number(end.yMm ?? end.y) - Number(start.yMm ?? start.y)) * t : 0));
    return { id: String(opening.id), wallId: opening.wallId ? String(opening.wallId) : undefined, type: opening.kind === 'window' ? 'window' : 'door', xMm, yMm, widthMm: Math.max(300, Number(opening.widthMm ?? 900)), heightMm: Math.max(300, Number(opening.heightMm ?? (opening.kind === 'window' ? 1200 : 2100))), swingDeg: opening.swingDeg == null ? undefined : Number(opening.swingDeg) };
  }).filter((opening: any) => (opening.wallId && usableWallIds.has(opening.wallId)) || (opening.xMm >= minX - 250 && opening.xMm <= maxX + 250 && opening.yMm >= minY - 250 && opening.yMm <= maxY + 250));
  const servicePoints = (Array.isArray(plan.servicePoints) ? plan.servicePoints : []).map((point: any) => ({ id: String(point.id), xMm: Number(point.position?.xMm ?? point.xMm ?? 0), yMm: Number(point.position?.yMm ?? point.yMm ?? 0), type: String(point.kind ?? point.type ?? 'service') })).filter((point: any) => point.xMm >= minX && point.xMm <= maxX && point.yMm >= minY && point.yMm <= maxY);
  const structuralElements = [
    ...(Array.isArray(plan.columns) ? plan.columns : []),
    ...(Array.isArray(plan.beams) ? plan.beams : []),
  ].map((item: any) => ({ id: String(item.id), type: String(item.kind ?? item.type ?? 'structure'), xMm: Number(item.position?.xMm ?? item.start?.xMm ?? item.xMm ?? 0), yMm: Number(item.position?.yMm ?? item.start?.yMm ?? item.yMm ?? 0), widthMm: Math.max(1, Number(item.widthMm ?? item.sizeMm ?? 300)), depthMm: Math.max(1, Number(item.depthMm ?? item.sizeMm ?? 300)) })).filter((item: any) => item.xMm >= minX - 250 && item.xMm <= maxX + 250 && item.yMm >= minY - 250 && item.yMm <= maxY + 250);
  try {
    const savedRequirements = spaceResult.data.requirements_json && typeof spaceResult.data.requirements_json === 'object' ? spaceResult.data.requirements_json : {};
    const generated = generateCandidates({ projectId: projectId, spaceId, roomCategory, floorPlanVersionId: project.data.active_floor_plan_version_id, shape: String(shape ?? 'balanced'), candidateTypes: Array.isArray(candidateTypes) ? candidateTypes : ['maximum_storage', 'best_circulation', 'balanced', 'cost_efficient'], requirements: { ...savedRequirements, ...(requirements && typeof requirements === 'object' ? requirements : {}) }, roomBoundingBoxMm: { minX, minY, maxX, maxY }, usableWalls, openings, servicePoints, structuralElements, companyRules: {} } as any);
    const previewContext = { roomPolygon: points.map((point: any) => ({ xMm: point.x, yMm: point.y })), walls: usableWalls, openings, servicePoints, structuralElements };
    const candidates = generated.map((candidate) => ({ ...candidate, previewContext }));
    return { status: 200, body: { success: true, floorPlanVersionId: project.data.active_floor_plan_version_id, spaceId, previewContext, candidates } };
  } catch (error) {
    return { status: 422, body: { success: false, code: 'LAYOUT_CANDIDATE_GENERATION_FAILED', message: error instanceof Error ? error.message : 'The canonical room geometry could not generate candidates.' } };
  }
}

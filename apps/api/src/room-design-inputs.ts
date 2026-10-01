import { CompositionScheduleV1Schema, FloorSurfaceV1Schema } from '@ultida/contracts';

/** Room inputs are persisted drafts; confirmation remains a separate compiler gate. */
export function parseRoomDesignInputs(body: unknown, roomId: string, wallIds: Set<string>) {
  const payload = body as { compositionSchedules?: unknown; floorSurfaces?: unknown } | null;
  const schedules = CompositionScheduleV1Schema.array().parse(payload?.compositionSchedules);
  const floors = FloorSurfaceV1Schema.array().parse(payload?.floorSurfaces);
  if (schedules.some(schedule => !wallIds.has(schedule.wallId)) || floors.some(floor => floor.roomId !== roomId)) throw new Error('Save only floor layouts and wall bays belonging to this room.');
  if (new Set(schedules.map(schedule => schedule.wallId)).size !== schedules.length || new Set(floors.map(floor => floor.id)).size !== floors.length) throw new Error('Each wall schedule and floor surface must have a unique identity.');
  return { compositionSchedules: schedules, floorSurfaces: floors };
}

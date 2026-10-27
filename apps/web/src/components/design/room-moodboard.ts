/** Read-model only: builds a room moodboard from persisted material assignments.
 * Never fills empty slots with starter palettes or invented supplier SKUs.
 */
export interface RoomBoardModule { id: string; roomId: string; label: string }
export interface RoomBoardMaterial {
  id: string; name: string; code?: string | null; category?: string;
  supplier?: string | null; brand?: string | null;
  finish?: string | null; thickness_mm?: number | null;
  metadata?: Record<string, unknown> | null;
}
export interface RoomBoardAssignment {
  id: string; project_id: string; target_kind: string; target_id: string;
  module_instance_id?: string | null; material_id: string;
  semantic_slot: string; revision: number; status: string;
}
export interface RoomBoardItem {
  key: string; targetId: string; targetName: string; slot: string;
  materialId: string; name: string; code: string | null;
  brand: string | null; category: string; hex: string | null;
  finish: string | null; thicknessMm: number | null;
  revision: number; assignmentStatus: string; skuVerified: boolean;
  sourceUrl: string | null; sourceRecordId: string | null; fittingId: string | null;
}
export interface RoomBoard {
  schema: 'ultida.room-moodboard.v1'; projectId: string; roomId: string;
  items: RoomBoardItem[]; incompleteMaterialIds: string[]; moduleCount: number;
}
export function buildRoomMoodboard(input: {
  projectId: string; roomId: string; modules: RoomBoardModule[];
  materials: RoomBoardMaterial[]; assignments: RoomBoardAssignment[];
}): RoomBoard {
  const roomModules = input.modules.filter(m => m.roomId === input.roomId);
  const moduleNames = new Map(roomModules.map(m => [m.id, m.label]));
  const materialById = new Map(input.materials.map(m => [m.id, m]));
  const seen = new Set<string>();
  const missing = new Set<string>();
  const items: RoomBoardItem[] = [];
  for (const assignment of [...input.assignments].sort((a,b)=>b.revision-a.revision)) {
    if (assignment.project_id !== input.projectId) continue;
    const moduleId = assignment.module_instance_id || assignment.target_id;
    const isRoom = assignment.target_kind === 'room' && assignment.target_id === input.roomId;
    if (!isRoom && !moduleNames.has(moduleId)) continue;
    const isPart = assignment.target_kind === 'part';
    const key = `${assignment.target_kind}:${isRoom ? input.roomId : isPart ? assignment.target_id : moduleId}:${assignment.semantic_slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // A newer rejection/revocation invalidates an older visible assignment.
    if (assignment.status === 'rejected' || assignment.status === 'superseded') continue;
    const material = materialById.get(assignment.material_id);
    if (!material) { missing.add(assignment.material_id); continue; }
    const metaHex = material.metadata?.hex ?? material.metadata?.colourHex ?? material.metadata?.colorHex;
    const hex = typeof metaHex === 'string' && /^#[\da-f]{6}$/i.test(metaHex) ? metaHex : null;
    const supplierCode = material.metadata?.supplierCode;
    const code = typeof supplierCode === 'string' && supplierCode.trim() ? supplierCode : typeof material.code === 'string' && material.code.trim() ? material.code : null;
    const source = material.metadata?.sourceUrl;
    const sourceUrl = typeof source === 'string' && /^https:\/\/[^\s]+$/i.test(source) ? source : null;
    items.push({key,targetId:isRoom ? input.roomId : isPart ? assignment.target_id : moduleId,targetName:isRoom ? 'Whole room' : `${moduleNames.get(moduleId) ?? 'Unknown module'}${isPart ? ` · ${assignment.target_id}` : ''}`,
      slot:assignment.semantic_slot,materialId:material.id,name:material.name,code,brand:material.brand || material.supplier || null,
      category:material.category || 'other',hex,finish:material.finish || null,
      thicknessMm:typeof material.thickness_mm === 'number' ? material.thickness_mm : null,
      revision:assignment.revision,assignmentStatus:assignment.status,skuVerified:Boolean(code && sourceUrl && (material.brand || material.supplier)),
      sourceUrl, sourceRecordId: typeof material.metadata?.sourceRecordId === 'string' ? material.metadata.sourceRecordId : null,
      fittingId: typeof material.metadata?.fittingId === 'string' ? material.metadata.fittingId : null,
    });
  }
  return {schema:'ultida.room-moodboard.v1',projectId:input.projectId,roomId:input.roomId,
    items:items.sort((a,b)=>a.targetName.localeCompare(b.targetName)||a.slot.localeCompare(b.slot)),
    incompleteMaterialIds:[...missing].sort(),moduleCount:roomModules.length};
}

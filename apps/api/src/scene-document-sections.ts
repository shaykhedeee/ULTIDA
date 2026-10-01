import type { SceneV1 } from '@ultida/scene-core';
import type { ProductionDossierSpecV1 } from '@ultida/drawing-core';
/** Document facts are sourced from the exact approved scene, never sample cabinetry. */
export function sceneDocumentSections(scene: SceneV1): Pick<ProductionDossierSpecV1, 'floorPlan' | 'elevations' | 'finishes'> {
  const points = scene.walls.flatMap(wall => [wall.start, wall.end]);
  const xs = points.map(point => point.xMm), ys = points.map(point => point.yMm);
  const material = (id?: string) => scene.materials.find(item => item.id === id);
  return {
    floorPlan: { extentsMm: { widthMm: xs.length ? Math.max(...xs) - Math.min(...xs) : 0, heightMm: ys.length ? Math.max(...ys) - Math.min(...ys) : 0 }, walls: scene.walls.map(wall => ({ id: wall.id, start: { x: wall.start.xMm, y: wall.start.yMm }, end: { x: wall.end.xMm, y: wall.end.yMm }, lengthMm: Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm), tag: wall.id })), openings: scene.openings.map(opening => ({ ...opening })), modules: scene.modules.map(module => ({ id: module.id, family: module.family, xMm: module.position.xMm, yMm: module.position.yMm, widthMm: module.widthMm, depthMm: module.depthMm, heightMm: module.heightMm, rotationDeg: module.rotationDeg })) },
    elevations: scene.modules.map(module => {
      const parts = scene.moduleParts.filter(part => part.moduleId === module.id);
      const local = (part: typeof parts[number]) => { const angle = -module.rotationDeg * Math.PI / 180; const dx = part.position.xMm - module.position.xMm, dy = part.position.yMm - module.position.yMm; return { xMm: dx * Math.cos(angle) + dy * Math.sin(angle), yMm: part.position.zMm - module.position.zMm, widthMm: part.widthMm, heightMm: part.heightMm }; };
      const external: Record<string, 'shutter' | 'loft' | 'profile-glass' | 'countertop'> = { shutter: 'shutter', loft: 'loft', drawer_front: 'shutter', profile_glass: 'profile-glass', countertop: 'countertop' };
      const internal: Record<string, 'carcass' | 'shelf' | 'drawer-box'> = { carcass: 'carcass', shelf: 'shelf', drawer: 'drawer-box' };
      const slots = Object.entries(module.materialSlots ?? {});
      return { roomId: module.roomId, roomName: scene.rooms.find(room => room.id === module.roomId)?.name ?? module.roomId, drawingCode: module.id, moduleName: module.family, family: module.family, overallWidthMm: module.widthMm, overallDepthMm: module.depthMm, overallHeightMm: module.heightMm,
        externalShutters: parts.filter(part => external[part.semanticType]).map(part => ({ id: part.id, ...local(part), kind: external[part.semanticType], label: part.name, finishNote: material(part.materialId)?.code ?? 'Finish to be confirmed' })),
        internalJoinery: parts.filter(part => internal[part.semanticType]).map(part => ({ id: part.id, ...local(part), kind: internal[part.semanticType], label: part.name, specNote: material(part.materialId)?.code ?? 'Internal finish to be confirmed' })),
        materialSchedule: slots.map(([slot, id]) => ({ component: slot, specification: material(id)?.name ?? 'Material to be confirmed', brandCode: material(id)?.code ?? 'Unconfirmed' })), hardwareSchedule: [], electricalNotes: parts.filter(part => /lighting/.test(part.semanticType)).map(part => `${part.name}: position ${part.position.zMm} mm above floor; electrical specification to be confirmed`) };
    }),
    finishes: { coreSubstrates: [], surfaceFinishes: scene.modules.flatMap(module => Object.entries(module.materialSlots ?? {}).map(([slot, id]) => ({ application: `${module.id} / ${slot}`, finishType: material(id)?.name ?? 'Finish to be confirmed', code: material(id)?.code ?? 'Unconfirmed', brand: 'Refer to approved material library' }))), edgeBanding: [], hardwareStandards: [] },
  };
}

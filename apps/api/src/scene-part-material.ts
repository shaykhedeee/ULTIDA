/** Face assignment never turns an internal shelf into an external shutter finish. */
export function resolvePartMaterial(part: { moduleId?: string; semanticType?: string; materialId?: string }, moduleSlots: Map<string, string>, standardSlots: Map<string, string>): string | undefined {
  const semantic = part.semanticType ?? '';
  const slot = ({ carcass: 'carcass', shelf: 'carcass', drawer: 'carcass', back_panel: 'backPanel', shutter: 'shutter', drawer_front: 'shutter', dummy_filler: 'shutter', filler: 'shutter', loft: 'shutter', profile_glass: 'glass', glass: 'glass', profile: 'metal', hardware: 'hardware', countertop: 'countertop', lighting_anchor: 'lighting', lighting_channel: 'lighting', lighting: 'lighting' } as Record<string, string>)[semantic];
  const read = (key: string) => moduleSlots.get(`${part.moduleId}:${key}`) ?? standardSlots.get(key);
  return moduleSlots.get(`${part.moduleId}:${semantic}`) ?? (slot ? read(slot) : undefined) ?? standardSlots.get(semantic) ?? part.materialId;
}

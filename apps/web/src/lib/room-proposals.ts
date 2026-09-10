export type RoomModuleProposal = { id: string; roomId: string; templateId?: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number; wallId?: string };
export function readRoomProposals(storage: Pick<Storage, 'getItem'>, projectId: string, roomId: string): RoomModuleProposal[] {
  try {
    const values = JSON.parse(storage.getItem(`ultida.room-proposals.${projectId}`) ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.filter((v) => v?.roomId === roomId && typeof v.id === 'string' && typeof v.label === 'string'
      && typeof v.family === 'string' && [v.widthMm, v.depthMm, v.heightMm].every((n) => Number.isFinite(n) && n > 0));
  } catch { return []; }
}

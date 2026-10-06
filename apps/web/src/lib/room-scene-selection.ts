type SavedModule = { id: string; space_id: string | null };

/** Select persisted identities without changing their room ownership. */
export function selectRoomSceneModules(saved: SavedModule[], requestedIds: string[], roomId?: string | null) {
  const requested = new Set(requestedIds);
  const candidates = requested.size ? saved.filter((module) => requested.has(module.id)) : saved;
  if (requested.size && candidates.length !== requested.size) {
    throw new Error('Some selected furniture is not saved in this project. Save it before preparing 3D.');
  }
  if (candidates.some((module) => !module.space_id)) {
    throw new Error('Assign the saved furniture to a room before preparing 3D.');
  }
  const rooms = new Set(candidates.map((module) => module.space_id));
  const selectedRoom = roomId || (rooms.size === 1 ? candidates[0]?.space_id : null);
  if (!selectedRoom) throw new Error('Choose one room to prepare in 3D. Furniture from different rooms cannot be combined.');
  if (requested.size && candidates.some((module) => module.space_id !== selectedRoom)) {
    throw new Error('The selected furniture belongs to different rooms. Choose furniture from one room.');
  }
  const modules = candidates.filter((module) => module.space_id === selectedRoom);
  if (!modules.length) throw new Error('Place and save furniture in this room before preparing 3D.');
  return { roomId: selectedRoom, moduleInstanceIds: modules.map((module) => module.id) };
}

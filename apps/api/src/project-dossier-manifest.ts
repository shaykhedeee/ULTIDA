type Row = { id: string; status: string; scene: any; floor_plan_version_id?: string; version_number?: number };
/** Input must be newest-first. Never silently fall back from a newer unapproved room. */
export function selectProjectDossierScenes(rows: Row[], expectedSpaceIds: string[]) {
  const covered = new Set<string>(), selected: Row[] = [];
  for (const row of rows) {
    const roomKeys: string[] = (row.scene?.rooms ?? []).map((r: any) => String(r.spaceId ?? r.id));
    if (!roomKeys.length || roomKeys.every(id => covered.has(id))) continue;
    if (roomKeys.some(id => covered.has(id))) throw new Error('DOSSIER_OVERLAPPING_SCENES: Compile a consistent project or disjoint room scenes.');
    if (!['approved', 'locked'].includes(row.status)) throw new Error(`DOSSIER_ROOM_NOT_APPROVED:${row.id}`);
    selected.push(row);roomKeys.forEach(id => covered.add(id));
  }
  const missing = expectedSpaceIds.filter(id => !covered.has(id));
  if (missing.length) throw new Error(`DOSSIER_ROOMS_MISSING:${missing.join(',')}`);
  if (!selected.length) throw new Error('APPROVED_SCENE_REQUIRED');
  return selected;
}

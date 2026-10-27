type Assignment = { target_kind: string; target_id: string; module_instance_id?: string | null; semantic_slot: string; material_id: string; revision: number; status: string };
export function sceneDefaultMaterialSlots(assignments: Assignment[]) {
  const result = new Map<string, string>();
  for (const kind of ['room', 'semantic_slot']) {
    for (const assignment of assignments) {
      if (assignment.target_kind !== kind) continue;
      const slot = assignment.semantic_slot === 'back_panel' ? 'backPanel' : assignment.semantic_slot === 'profile' ? 'metal' : assignment.semantic_slot;
      if (!result.has(slot)) result.set(slot, assignment.material_id);
    }
  }
  return result;
}
/** Input is newest first, including revoked revisions so old approvals never resurface. */
export function sceneMaterialAssignments<T extends Assignment>(assignments: T[], roomId: string, moduleIds: Set<string>, partOwners: Map<string, string>) {
  const latest = new Map<string, T>();
  for (const assignment of assignments) {
    const kind = assignment.target_kind;
    const moduleId = assignment.module_instance_id ?? (kind === 'module' ? assignment.target_id : '');
    const inScope = kind === 'room' ? assignment.target_id === roomId
      : kind === 'part' ? !!moduleId && moduleIds.has(moduleId) && partOwners.get(assignment.target_id) === moduleId
      : kind === 'module' ? moduleIds.has(moduleId) : kind === 'semantic_slot';
    if (!inScope) continue;
    const key = `${kind}:${assignment.target_id}:${moduleId}:${assignment.semantic_slot}`;
    if (!latest.has(key)) latest.set(key, assignment);
  }
  return [...latest.values()].filter(item => item.status === 'draft' || item.status === 'approved');
}

/** Fail closed before editing: an old approved output must never survive a saved module change. */
export async function invalidateModuleOutputs(client: any, projectId: string): Promise<string | null> {
  for (const [table, changes] of [
    ['scene_versions', { status: 'stale' }],
    ['artifacts', { stale: true }],
    ['quotes', { stale: true }],
  ] as const) {
    let query = client.from(table).update(changes).eq('project_id', projectId);
    query = table === 'scene_versions' ? query.in('status', ['draft', 'approved', 'locked']) : query.eq('stale', false);
    const result = await query;
    if (result.error) return `Could not invalidate previous ${table}. No module change was saved. Retry after the connection is restored.`;
  }
  return null;
}

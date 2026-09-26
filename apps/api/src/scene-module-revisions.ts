/** Compare the exact persisted revisions read by compilation, not two clocks. */
export function moduleRevisionsMatch(ids: string[], rows: { id: string; updated_at: string | null }[], snapshot: unknown, createdAt: string | null): boolean {
  if (new Set(ids).size !== ids.length || rows.length !== ids.length) return false;
  const versions = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown> : null;
  return ids.every(id => {
    const row = rows.find(candidate => candidate.id === id);
    if (!row?.updated_at || !Number.isFinite(Date.parse(row.updated_at))) return false;
    if (versions) return typeof versions[id] === 'string' && versions[id] === row.updated_at;
    // Older scenes have no snapshot: fail closed on later or unknown revisions.
    return !!createdAt && Number.isFinite(Date.parse(createdAt)) && Date.parse(row.updated_at) <= Date.parse(createdAt);
  });
}

/**
 * Deterministic content comparison for room saves so content-identical saves
 * do not mutate timestamps or invalidate approved layouts/scenes.
 */
function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record)
      .filter((key) => key !== 'updated_at' && key !== 'updatedAt' && key !== 'created_at' && key !== 'createdAt')
      .sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      if (record[key] !== undefined) {
        result[key] = canonicalizeValue(record[key]);
      }
    }
    return result;
  }
  return value;
}

export function isRoomSaveContentIdentical(existingRoom: unknown, incomingPatch: unknown): boolean {
  try {
    return JSON.stringify(canonicalizeValue(existingRoom)) === JSON.stringify(canonicalizeValue(incomingPatch));
  } catch {
    return false;
  }
}

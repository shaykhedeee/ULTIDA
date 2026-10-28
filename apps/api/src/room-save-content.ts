/**
 * Deterministic content comparison for room saves so content-identical saves
 * do not mutate timestamps or invalidate approved layouts/scenes.
 */
function canonicalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record)
      .filter((key) => key !== 'updated_at' && key !== 'updatedAt' && key !== 'created_at' && key !== 'createdAt' && key !== 'savedAt')
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
    if (
      existingRoom &&
      typeof existingRoom === 'object' &&
      incomingPatch &&
      typeof incomingPatch === 'object' &&
      !Array.isArray(existingRoom) &&
      !Array.isArray(incomingPatch)
    ) {
      const existingRecord = existingRoom as Record<string, unknown>;
      const patchRecord = incomingPatch as Record<string, unknown>;
      const patchKeys = Object.keys(patchRecord).filter(
        (key) => key !== 'updated_at' && key !== 'updatedAt' && key !== 'created_at' && key !== 'createdAt' && key !== 'savedAt',
      );
      const projectedExisting: Record<string, unknown> = {};
      const projectedPatch: Record<string, unknown> = {};
      for (const key of patchKeys) {
        projectedExisting[key] = existingRecord[key];
        projectedPatch[key] = patchRecord[key];
      }
      return JSON.stringify(canonicalizeValue(projectedExisting)) === JSON.stringify(canonicalizeValue(projectedPatch));
    }
    return JSON.stringify(canonicalizeValue(existingRoom)) === JSON.stringify(canonicalizeValue(incomingPatch));
  } catch {
    return false;
  }
}

export function areDesignInputsIdentical(existingInputs: unknown, incomingInputs: unknown): boolean {
  try {
    return JSON.stringify(canonicalizeValue(existingInputs ?? {})) === JSON.stringify(canonicalizeValue(incomingInputs ?? {}));
  } catch {
    return false;
  }
}

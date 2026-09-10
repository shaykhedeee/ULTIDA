export const PREPARED_MODULE_KEY = 'ultida.pendingModulePlan.v1';
export type PreparedModulePlan = {
  schema: 'ultida.module-plan.v1'; projectId?: string; templateId: string; family: string; name: string;
  dimensionsMm: { width: number; depth: number; height: number }; wallWidthMm: number; clearanceMm: number;
};

/** Read a proposal without consuming it. Only a successful persisted placement may clear it. */
export function readPreparedModule(storage: Pick<Storage, 'getItem'>, projectId?: string | null): PreparedModulePlan | null {
  try {
    const value = JSON.parse(storage.getItem(PREPARED_MODULE_KEY) ?? 'null');
    if (!value || value.schema !== 'ultida.module-plan.v1' || !['templateId', 'family', 'name'].every((key) => typeof value[key] === 'string' && value[key].length > 0)) return null;
    if (value.projectId !== undefined && (typeof value.projectId !== 'string' || (projectId && value.projectId !== projectId))) return null;
    if (![value.dimensionsMm?.width, value.dimensionsMm?.depth, value.dimensionsMm?.height, value.wallWidthMm].every((n) => Number.isFinite(n) && n > 0)) return null;
    if (!Number.isFinite(value.clearanceMm) || value.clearanceMm < 0) return null;
    return value;
  } catch { return null; }
}

export function bindPreparedModule(storage: Pick<Storage, 'getItem' | 'setItem'>, projectId: string): boolean {
  const prepared = readPreparedModule(storage);
  if (!prepared || !projectId) return false;
  storage.setItem(PREPARED_MODULE_KEY, JSON.stringify({ ...prepared, projectId }));
  return true;
}

export function completePreparedModule(storage: Pick<Storage, 'getItem' | 'removeItem'>, projectId: string, templateId: string): void {
  const prepared = readPreparedModule(storage, projectId);
  if (prepared?.templateId === templateId) storage.removeItem(PREPARED_MODULE_KEY);
}

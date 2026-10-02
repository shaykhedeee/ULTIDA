/** Preview selection only; geometry authority remains with the scene compiler. */
export function selectModulesWithinRun<T extends { widthMm: number }>(items: readonly T[], runWidthMm: number) {
  if (!Number.isFinite(runWidthMm) || runWidthMm <= 0) throw new Error('AURA_RUN_WIDTH_REQUIRED');
  let remaining = runWidthMm;
  const modules = items.filter((item) => {
    if (!Number.isFinite(item.widthMm) || item.widthMm <= 0 || item.widthMm > remaining) return false;
    remaining -= item.widthMm;
    return true;
  });
  return { modules, unfilledWidthMm: remaining };
}

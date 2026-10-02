/** Adapt persisted opening fields without inventing a classification or measurement. */
export function projectSpaceOpening(opening: Record<string, unknown>) {
  // Older canonical records encode their class by dimensions, not by mechanism.
  // A mechanism alone (e.g. "sliding") is shared by doors and windows.
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const sill = opening.sillHeightMm ?? opening.sillMm;
  const windowRange = typeof sill === 'number' && Number.isFinite(sill) && sill >= 0 && positive(opening.headMm) && opening.headMm > sill;
  const classification = opening.kind ?? (opening.type === 'door' || opening.type === 'window' ? opening.type : undefined)
    ?? (windowRange && !positive(opening.heightMm) ? 'window' : positive(opening.heightMm) ? 'door' : undefined);
  return {
    id: opening.id,
    wallId: opening.wallId,
    kind: classification === 'door' || classification === 'window' ? classification : 'unclassified',
    offsetAlongWallMm: opening.offsetMm ?? opening.offsetAlongWallMm,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm ?? (classification === 'window' && windowRange ? (opening.headMm as number) - (sill as number) : undefined),
    sillHeightMm: sill,
    headMm: opening.headMm,
    verification: opening.verification,
  };
}

/** Save only measured geometry. Missing values must not become standard-sized openings. */
export function persistSpaceOpening(opening: Record<string, unknown>) {
  const projected = projectSpaceOpening(opening);
  const measured = (value: unknown, name: string, allowZero = false): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
      throw new Error(`Opening ${String(opening.id ?? '')} requires a measured ${name}.`);
    }
    return value;
  };
  const offsetMm = measured(projected.offsetAlongWallMm, 'offset', true);
  const widthMm = measured(projected.widthMm, 'width');
  const shared = { id: String(opening.id), wallId: String(opening.wallId), offsetMm, widthMm, verification: 'unverified' as const };
  if (projected.kind === 'window') {
    const sillMm = measured(projected.sillHeightMm, 'sill height', true);
    const headMm = opening.headMm === undefined ? sillMm + measured(projected.heightMm, 'height') : measured(opening.headMm, 'head height');
    if (headMm <= sillMm) throw new Error(`Opening ${String(opening.id)} head height must exceed sill height.`);
    return { ...shared, kind: 'window' as const, sillMm, headMm, type: typeof opening.type === 'string' ? opening.type : undefined };
  }
  if (projected.kind !== 'door') throw new Error(`Opening ${String(opening.id)} requires a confirmed door/window classification.`);
  return { ...shared, kind: 'door' as const, heightMm: measured(projected.heightMm, 'height'), type: typeof opening.type === 'string' ? opening.type : undefined };
}

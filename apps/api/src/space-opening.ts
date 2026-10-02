/** Adapt persisted opening fields without inventing a classification or measurement. */
export function projectSpaceOpening(opening: Record<string, unknown>) {
  const classification = opening.kind ?? opening.type;
  return {
    id: opening.id,
    wallId: opening.wallId,
    kind: classification === 'door' || classification === 'window' ? classification : 'unclassified',
    offsetAlongWallMm: opening.offsetMm ?? opening.offsetAlongWallMm,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm,
    sillHeightMm: opening.sillHeightMm ?? opening.sillMm,
    headMm: opening.headMm,
    verification: opening.verification,
  };
}

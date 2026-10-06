import type { SceneV1 } from './scene-types.js';

const xml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));

/** Orthographic projection of world-space components, never inferred cabinet anatomy. */
export function projectComponentElevation(scene: SceneV1, wallId: string, internal = false) {
  const wall = scene.walls.find((item) => item.id === wallId);
  if (!wall) throw new Error(`Wall ${wallId} was not found in the saved scene.`);
  const lengthMm = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
  if (!lengthMm) throw new Error(`Wall ${wallId} has no measurable length.`);
  const ux = (wall.end.xMm - wall.start.xMm) / lengthMm;
  const uy = (wall.end.yMm - wall.start.yMm) / lengthMm;
  const moduleIds = new Set(scene.modules.filter((module) => {
    const explicit = (module as typeof module & { wallId?: string }).wallId;
    if (explicit) return explicit === wallId;
    const nearest = scene.walls.map((candidate) => {
      const dx = candidate.end.xMm - candidate.start.xMm, dy = candidate.end.yMm - candidate.start.yMm;
      const length2 = dx * dx + dy * dy;
      const t = length2 ? Math.max(0, Math.min(1, ((module.position.xMm - candidate.start.xMm) * dx + (module.position.yMm - candidate.start.yMm) * dy) / length2)) : 0;
      return { id: candidate.id, distance: Math.hypot(module.position.xMm - candidate.start.xMm - t * dx, module.position.yMm - candidate.start.yMm - t * dy) };
    }).sort((a, b) => a.distance - b.distance)[0];
    return nearest?.id === wallId;
  }).map((module) => module.id));
  const parts = (scene.moduleParts ?? []).filter((part) => moduleIds.has(part.moduleId))
    .filter((part) => part.semanticType !== 'lighting_anchor')
    .filter((part) => !internal || !['shutter', 'glass', 'profile'].includes(part.semanticType ?? ''))
    .map((part) => {
      const angle = (part.rotationDeg ?? 0) * Math.PI / 180;
      const along = [[0, 0], [part.widthMm, 0], [0, part.depthMm], [part.widthMm, part.depthMm]].map(([x, y]) => {
        const px = part.position.xMm + x * Math.cos(angle) - y * Math.sin(angle);
        const py = part.position.yMm + x * Math.sin(angle) + y * Math.cos(angle);
        return (px - wall.start.xMm) * ux + (py - wall.start.yMm) * uy;
      });
      const xMm = Math.min(...along), widthMm = Math.max(...along) - xMm;
      const zMm = (part.position.zMm ?? 0) - (wall.baseElevationMm ?? 0);
      if (![xMm, widthMm, zMm, part.heightMm].every(Number.isFinite) || widthMm <= 0 || part.heightMm <= 0) throw new Error(`Component ${part.id} has invalid elevation geometry.`);
      return { ...part, xMm, zMm, projectedWidthMm: widthMm };
    });
  const materialIds = [...new Set(parts.map((part) => part.materialId).filter((id): id is string => Boolean(id)))];
  const materials = materialIds.map((id) => {
    const record = scene.materials?.find((material) => material.id === id);
    return { id, label: record ? `${record.code} · ${record.name}${record.finish ? ` · ${record.finish}` : ''}` : `${id} · material specification unresolved` };
  });
  if (parts.some((part) => !part.materialId)) materials.push({ id: '', label: 'Unassigned component finish — specification required' });
  return { wall, lengthMm, parts, materials };
}

export function generateComponentElevationSvg(scene: SceneV1, wallId: string, internal = false, settings: { title?: string; studioName?: string } = {}): string {
  const { wall, lengthMm, parts, materials } = projectComponentElevation(scene, wallId, internal);
  const heightMm = wall.heightMm ?? 2700;
  const legend = materials.map((material, index) => `<text x="0" y="${heightMm + 220 + index * 65}" font-size="38">M${index + 1}: ${xml(material.label)}</text>`).join('');
  const components = parts.map((part) => {
    const material = materials.findIndex((item) => item.id === part.materialId);
    return `<g data-part-id="${xml(part.id)}" data-module-id="${xml(part.moduleId)}" data-semantic-type="${xml(part.semanticType ?? 'component')}"><rect x="${part.xMm}" y="${heightMm - part.zMm - part.heightMm}" width="${part.projectedWidthMm}" height="${part.heightMm}" fill="none" stroke="#38291f" stroke-width="3"/><title>${xml(part.name)} · ${part.widthMm} × ${part.depthMm} × ${part.heightMm} mm · mounting ${part.zMm} mm${material >= 0 ? ` · M${material + 1}` : ' · finish unassigned'}</title></g>`;
  }).join('');
  const openings = (scene.openings ?? []).filter((opening) => opening.wallId === wallId).map((opening) => `<rect data-opening-id="${xml(opening.id)}" x="${opening.offsetMm}" y="${heightMm - (opening.sillHeightMm ?? opening.sillMm ?? 0) - opening.heightMm}" width="${opening.widthMm}" height="${opening.heightMm}" fill="#fff" stroke="#39758b" stroke-width="4"/>`).join('');
  const reviewLabel = ['approved', 'locked'].includes(scene.metadata.status) ? '' : ' · NOT FOR CONSTRUCTION';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -250 ${lengthMm + 300} ${heightMm + 550 + materials.length * 65}" width="100%"><g font-family="Arial" fill="#38291f"><text x="0" y="-130" font-size="48">${xml(settings.title ?? `${internal ? 'INTERNAL' : 'COMPONENT'} ELEVATION`)} · ${xml(wallId)}</text><text x="0" y="-65" font-size="32">${xml(settings.studioName ?? 'ULTIDA')} · ${xml(scene.projectId)} · revision ${xml(scene.metadata.designVersion ?? 'unassigned')} · ${xml(scene.metadata.status)} · mm${reviewLabel}</text><rect width="${lengthMm}" height="${heightMm}" fill="#faf8f3" stroke="#38291f" stroke-width="8"/>${openings}${components}<text x="0" y="${heightMm + 100}" font-size="40">Overall ${lengthMm} × ${heightMm} mm · ${parts.length} saved components</text>${legend}${parts.length ? '' : `<text x="0" y="200" font-size="48">NO SAVED COMPONENTS — NOT FOR CONSTRUCTION</text>`}</g></svg>`;
}

export function exportComponentElevationDxf(scene: SceneV1, wallId: string): string {
  const { wall, lengthMm, parts, materials } = projectComponentElevation(scene, wallId);
  const entities: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, layer: string) => entities.push('0', 'LINE', '8', layer, '10', String(x1), '20', String(y1), '30', '0', '11', String(x2), '21', String(y2), '31', '0');
  const rect = (x: number, y: number, width: number, height: number, layer: string) => {
    line(x, y, x + width, y, layer); line(x + width, y, x + width, y + height, layer);
    line(x + width, y + height, x, y + height, layer); line(x, y + height, x, y, layer);
  };
  const text = (label: string, x: number, y: number) => entities.push('0', 'TEXT', '8', 'A-ANNO', '10', String(x), '20', String(y), '30', '0', '40', '30', '1', label.replace(/[\r\n]/g, ' '));
  rect(0, 0, lengthMm, wall.heightMm ?? 2700, 'A-WALL');
  for (const opening of scene.openings ?? []) if (opening.wallId === wallId) rect(opening.offsetMm, opening.sillHeightMm ?? opening.sillMm ?? 0, opening.widthMm, opening.heightMm, 'A-OPENING');
  for (const part of parts) {
    rect(part.xMm, part.zMm, part.projectedWidthMm, part.heightMm, `A-COMP-${(part.semanticType ?? 'COMPONENT').toUpperCase().replace(/[^A-Z0-9_-]/g, '-')}`);
    const material = materials.findIndex((item) => item.id === part.materialId);
    text(`${part.id}: ${part.name} ${part.widthMm}x${part.depthMm}x${part.heightMm}mm${material >= 0 ? ` M${material + 1}` : ' FINISH UNASSIGNED'}`, part.xMm, part.zMm + part.heightMm + 20);
  }
  text(`${scene.projectId} / ${wallId} / revision ${scene.metadata.designVersion ?? 'unassigned'} / ${scene.metadata.status} / mm`, 0, -100);
  materials.forEach((material, index) => text(`M${index + 1}: ${material.label}`, 0, -180 - index * 60));
  return ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC', '0', 'EOF', ''].join('\r\n');
}

import type { SceneV1 } from '@ultida/scene-core';
import { buildDrawingProjection, generateComponentElevationSvg, projectComponentElevation } from '@ultida/drawing-core';
import sharp from 'sharp';
import type { PresentationSheet } from './presentation-pdf.js';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
const mm = (value: number) => `${Math.round(value * 10) / 10}`;

export async function buildScenePresentationSheets(scene: SceneV1): Promise<PresentationSheet[]> {
  const sheets: PresentationSheet[] = [];
  const projection = buildDrawingProjection(scene);
  const lines = projection.lines;
  if (lines.length) {
    const xs = lines.flatMap(line => [line.x1, line.x2]), ys = lines.flatMap(line => [line.y1, line.y2]);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) throw new Error('The saved floor plan has invalid extents. Correct it before presenting.');
    const padding = Math.max(w, h) * .06;
    const plan = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="${x-padding} ${y-padding} ${w+padding*2} ${h+padding*2}"><rect x="${x-padding}" y="${y-padding}" width="${w+padding*2}" height="${h+padding*2}" fill="#faf8f3"/>${lines.map(line => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${line.layer === 'openings' ? '#39758b' : line.layer === 'modules' ? '#9a713f' : '#244039'}" stroke-width="${Math.max(w,h)/450}"/>`).join('')}<text x="${x}" y="${y-padding/3}" font-size="${Math.max(w,h)/65}" fill="#244039">${escape(scene.rooms.map(room => room.name || room.id).join(' / '))}</text></svg>`;
    sheets.push({ title: 'Room floor plan', subtitle: 'Saved walls, openings and furniture footprints · Blue: openings · Brown: furniture · Do not scale', image: await sharp(Buffer.from(plan)).png().toBuffer() });
  }
  const usedMaterials = new Set((scene.moduleParts ?? []).map(part => part.materialId).filter(Boolean));
  for (const module of scene.modules) {
    if (module.materialId) usedMaterials.add(module.materialId);
    Object.values(module.materialSlots ?? {}).forEach(id => { if (id) usedMaterials.add(id); });
  }
  const materials = scene.materials.filter(material => usedMaterials.has(material.id));
  for (let offset = 0; offset < materials.length; offset += 6) {
    sheets.push({ title: `Finish moodboard ${Math.floor(offset/6)+1}`, subtitle: 'Saved finish selections · Colour chips are indicative, not supplier texture samples · Confirm physical samples', layout: 'moodboard', rows: materials.slice(offset,offset+6).map(material => ({ label: material.name, detail: `${material.code} · ${material.finish || 'Finish specification required'} · ${[...new Set((scene.moduleParts ?? []).filter(part => part.materialId === material.id).map(part => part.semanticType || 'component'))].join(', ')}`, colorHex: material.colorHex })) });
  }
  const assignments = scene.modules.flatMap(module => Object.entries(module.materialSlots ?? {}).map(([slot, id]) => {
    const material = scene.materials.find(item => item.id === id);
    return { label: `${module.id} · ${slot}`, detail: material ? `${material.code} · ${material.name} · ${material.finish || 'Finish unconfirmed'}` : `${id} · Specification unresolved` };
  }));
  for (let offset = 0; offset < assignments.length; offset += 8) sheets.push({ title: `Furniture finish assignments ${Math.floor(offset/8)+1}`, subtitle: 'Saved material slots · Carcass slot does not independently specify inner and outer laminate faces · Confirm face-specific specifications for production', layout: 'schedule', rows: assignments.slice(offset,offset+8) });
  for (const wall of scene.walls) {
    const components = projectComponentElevation(scene, wall.id);
    const room = scene.rooms.find(item => wall.spaceIds?.includes(item.id) || components.parts.some(part => part.roomId === item.id));
    const title = `${room?.name || 'Room'} · ${wall.id}`;
    for (const internal of [false, true]) {
      const svg = generateComponentElevationSvg(scene, wall.id, internal);
      sheets.push({ title: `${title} · ${internal ? 'Internal' : 'External'} elevation`, subtitle: 'Saved physical components · Millimetres · See component schedule for exact W × D × H and mounting heights', image: await sharp(Buffer.from(svg)).resize({ width: 2400, height: 1400, fit: 'inside' }).png().toBuffer() });
    }
    const rows = components.parts.map(part => {
      const material = scene.materials.find(item => item.id === part.materialId);
      return { label: `${part.name} · ${part.id}`, detail: `${mm(part.widthMm)} × ${mm(part.depthMm)} × ${mm(part.heightMm)} mm · Z ${mm(part.zMm)} · ${material ? material.code : 'Finish unconfirmed'}` };
    });
    for (let offset = 0; offset < rows.length; offset += 8) sheets.push({ title: `${title} · Component schedule ${Math.floor(offset/8)+1}`, subtitle: 'Exact saved component sizes and mounting elevation · IDs shared with the scene · Fabrication release requires separate review', layout: 'schedule', rows: rows.slice(offset,offset+8) });
  }
  return sheets;
}

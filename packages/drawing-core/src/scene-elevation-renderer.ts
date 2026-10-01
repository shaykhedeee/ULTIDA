import type { SceneModulePartV1, SceneV1, SceneWallV1 } from './scene-types.js';

export type ElevationCutlistPart = {
  id: string;
  sourcePartId?: string;
  moduleId: string;
  partName: string;
  semanticType?: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialCode: string;
  quantity: number;
  status?: string;
  grainDirection?: string;
  edgeSchedule?: { l1Mm: number; l2Mm: number; w1Mm: number; w2Mm: number; tapeType: string };
};

type ElevationOptions = {
  viewMode?: 'external' | 'internal' | 'both' | 'shop-sheet' | 'fabrication';
  unitTitle?: string;
  projectName?: string;
  clientName?: string;
  designerName?: string;
  checkedBy?: string;
  sheetDate?: string;
  sheetCode?: string;
  sheetNumber?: string;
  provenance?: string;
  measurementStatus?: 'measured' | 'derived' | 'reference' | 'unverified';
  revision?: string;
  selectedModuleId?: string;
  studioName?: string;
  materialSwatches?: Record<string, string>;
  productionParts?: ElevationCutlistPart[];
};

const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

function corners(position: { xMm: number; yMm: number }, widthMm: number, depthMm: number, rotationDeg: number) {
  const angle = -rotationDeg * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[0, 0], [widthMm, 0], [widthMm, depthMm], [0, depthMm]].map(([x, y]) => ({
    xMm: position.xMm + x! * c - y! * s,
    yMm: position.yMm + x! * s + y! * c,
  }));
}

function wallFrame(wall: SceneWallV1) {
  const dx = wall.end.xMm - wall.start.xMm, dy = wall.end.yMm - wall.start.yMm;
  const length = Math.hypot(dx, dy);
  return { length, tx: dx / length, ty: dy / length, nx: -dy / length, ny: dx / length };
}

function partProjection(part: SceneModulePartV1, wall: SceneWallV1) {
  const frame = wallFrame(wall);
  const points = corners(part.position, part.widthMm, part.depthMm, part.rotationDeg ?? 0);
  const along = points.map((point) => (point.xMm - wall.start.xMm) * frame.tx + (point.yMm - wall.start.yMm) * frame.ty);
  const normal = points.map((point) => (point.xMm - wall.start.xMm) * frame.nx + (point.yMm - wall.start.yMm) * frame.ny);
  return {
    startMm: Math.min(...along), endMm: Math.max(...along),
    minNormalMm: Math.min(...normal), maxNormalMm: Math.max(...normal),
  };
}

function modulesOnWall(scene: SceneV1, wall: SceneWallV1, targetModuleId?: string) {
  if (targetModuleId) return (scene.modules ?? []).filter((module) => module.id === targetModuleId);
  const frame = wallFrame(wall);
  return (scene.modules ?? []).filter((module) => {
    const points = corners(module.position, module.widthMm, module.depthMm, module.rotationDeg ?? 0);
    const along = points.map((point) => (point.xMm - wall.start.xMm) * frame.tx + (point.yMm - wall.start.yMm) * frame.ty);
    const normal = points.map((point) => (point.xMm - wall.start.xMm) * frame.nx + (point.yMm - wall.start.yMm) * frame.ny);
    const overlapsWallRun = Math.max(...along) >= 0 && Math.min(...along) <= frame.length;
    const nearWall = Math.min(...normal) <= Math.max(250, (wall.thicknessMm ?? 0) + 100)
      && Math.max(...normal) >= -Math.max(250, (wall.thicknessMm ?? 0) + 100);
    return overlapsWallRun && nearWall;
  });
}

function warningSheet(title: string, message: string, scene: SceneV1, wallId: string, options: ElevationOptions, missing: string[]) {
  const status = 'NOT FOR CONSTRUCTION · REVIEW REQUIRED';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
<rect width="1200" height="750" fill="#fff"/><rect width="1200" height="42" fill="#263746"/>
<text x="24" y="27" fill="#fff" font-family="Arial,sans-serif" font-size="15" font-weight="700">${escapeXml(options.studioName ?? 'ULTIDA')} · ${escapeXml(title)}</text>
<rect x="120" y="190" width="960" height="330" rx="8" fill="#fff7ed" stroke="#c2410c" stroke-width="2"/>
<text x="600" y="250" text-anchor="middle" fill="#9a3412" font-family="Arial,sans-serif" font-size="24" font-weight="700">${escapeXml(message)}</text>
${missing.map((item, index) => `<text x="600" y="300" text-anchor="middle" fill="#431407" font-family="Arial,sans-serif" font-size="15">${escapeXml(item)}</text>`).join('')}
<text x="600" y="455" text-anchor="middle" fill="#334155" font-family="Arial,sans-serif" font-size="14">Wall ${escapeXml(wallId)} · Revision ${escapeXml(options.revision ?? scene.metadata.designVersion)} · Units mm</text>
<rect y="710" width="1200" height="40" fill="#f1f5f9"/><text x="600" y="735" text-anchor="middle" fill="#b91c1c" font-family="Arial,sans-serif" font-size="13" font-weight="700">${status}</text>
</svg>`;
}

/** Creates a fabrication elevation whose part references and schedule come from the same cutlist snapshot. */
export function generateSceneFabricationElevationSvg(
  scene: SceneV1,
  targetWallIdOrModuleId?: string,
  options: ElevationOptions = {},
): string {
  const targetModule = (scene.modules ?? []).find((module) => module.id === (options.selectedModuleId ?? targetWallIdOrModuleId));
  const wall = (scene.walls ?? []).find((candidate) => candidate.id === targetWallIdOrModuleId)
    ?? (targetModule ? (scene.walls ?? []).find((candidate) => candidate.spaceIds?.includes(targetModule.roomId ?? targetModule.spaceId ?? '')) : undefined)
    ?? scene.walls?.[0];
  if (!wall || !finitePositive(Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm)) || !finitePositive(wall.heightMm ?? 0)) {
    return warningSheet('FABRICATION ELEVATION', 'MEASURED WALL GEOMETRY REQUIRED', scene, targetWallIdOrModuleId ?? 'UNASSIGNED', options, ['A valid wall length and height must be saved before dimensioned elevations can be issued.']);
  }
  const frame = wallFrame(wall);
  const requestedModules = modulesOnWall(scene, wall, targetModule?.id);
  if (!requestedModules.length) {
    return warningSheet('FABRICATION ELEVATION', 'NO MODULES PLACED', scene, wall.id, options, [`Measured wall: ${Math.round(frame.length)} mm long × ${Math.round(wall.heightMm!)} mm high.`, 'Place a module on this wall and compile its component geometry before issuing a cutlist-linked elevation.']);
  }
  const cutlist = options.productionParts;
  const cutlistModuleIds = new Set((cutlist ?? []).map((part) => part.moduleId));
  const modules = cutlist ? requestedModules.filter((module) => cutlistModuleIds.has(module.id)) : requestedModules;
  const withheldModules = cutlist ? requestedModules.filter((module) => !cutlistModuleIds.has(module.id)) : [];
  if (cutlist && !modules.length) {
    return warningSheet('FABRICATION ELEVATION', 'NO CERTIFIED MODULES IN CUTLIST', scene, wall.id, options, [`${withheldModules.length} placed module(s) were withheld by production certification.`, 'Review the cutlist warnings and certify the selected module before issuing manufacturing drawings.']);
  }
  if (!scene.moduleParts?.length) {
    return warningSheet('FABRICATION ELEVATION', 'COMPILED COMPONENT GEOMETRY REQUIRED', scene, wall.id, options, ['This scene has module envelopes but no compiled module parts.', 'Compile the saved modules before creating a cutlist-linked elevation.']);
  }
  const moduleIds = new Set(modules.map((module) => module.id));
  const allParts = scene.moduleParts.filter((part) => moduleIds.has(part.moduleId));
  const sourceIds = new Set((cutlist ?? []).map((part) => part.sourcePartId ?? part.id));
  const mode = options.viewMode ?? 'fabrication';
  const externalSemantics = new Set(['shutter', 'filler', 'panel', 'glass', 'drawer_front', 'loft']);
  const internalSemantics = new Set(['carcass', 'shelf', 'back', 'back_panel', 'drawer', 'drawer_box', 'lighting_channel']);
  const visibleParts = allParts.map((part) => ({ part, projection: partProjection(part, wall) }))
    .filter(({ part, projection }) => finitePositive(part.widthMm) && finitePositive(part.depthMm) && finitePositive(part.heightMm)
      && Number.isFinite(part.position.zMm ?? 0)
      && projection.endMm >= 0 && projection.startMm <= frame.length
      && (mode !== 'external' || externalSemantics.has(String(part.semanticType ?? '').toLowerCase()))
      && (mode !== 'internal' || internalSemantics.has(String(part.semanticType ?? '').toLowerCase()))
      && (!cutlist || sourceIds.has(part.id)))
    .sort((a, b) => (a.part.position.zMm ?? 0) - (b.part.position.zMm ?? 0) || a.projection.startMm - b.projection.startMm);
  if (!visibleParts.length) {
    if (cutlist) {
      const unmatched = cutlist.filter((part) => moduleIds.has(part.moduleId)).length;
      return warningSheet('FABRICATION ELEVATION', 'CUTLIST / SCENE COMPONENT MISMATCH', scene, wall.id, options, [`${unmatched} cutlist row(s) do not map to a compiled component ID on this wall.`, 'Recompile the saved scene and regenerate the cutlist before using this elevation.']);
    }
    return warningSheet('FABRICATION ELEVATION', 'NO COMPONENTS ASSIGNED TO THIS WALL', scene, wall.id, options, ['No compiled component geometry intersects this wall.', 'Select a module on this wall or confirm the saved module placement.']);
  }

  const visibleIds = new Set(visibleParts.map(({ part }) => part.id));
  const wallCutlist = cutlist?.filter((part) => moduleIds.has(part.moduleId) && visibleIds.has(part.sourcePartId ?? part.id));
  const rows: ElevationCutlistPart[] = wallCutlist
    ? wallCutlist.filter((part) => sourceIds.has(part.sourcePartId ?? part.id))
    : visibleParts.filter(({ part }) => ['carcass', 'shutter', 'shelf', 'filler', 'back', 'back_panel', 'panel', 'glass'].includes(String(part.semanticType ?? '').toLowerCase()))
      .map(({ part }) => {
        const dims = [part.widthMm, part.depthMm, part.heightMm].sort((a, b) => b - a);
        const material = scene.materials?.find((candidate) => candidate.id === part.materialId);
        return { id: part.id, sourcePartId: part.id, moduleId: part.moduleId, partName: part.name, semanticType: part.semanticType, lengthMm: dims[0]!, widthMm: dims[1]!, thicknessMm: dims[2]!, materialCode: material?.code ?? part.materialId ?? 'TBC', quantity: 1, status: 'preview_only' };
      });
  const unmatchedCutlistRows = wallCutlist ? wallCutlist.length - rows.length : 0;
  const expectedPanelIds = new Set(allParts.filter((part) => ['carcass', 'shutter', 'shelf', 'filler', 'back', 'back_panel', 'panel', 'glass'].includes(String(part.semanticType ?? '').toLowerCase()) && Math.min(part.widthMm, part.depthMm, part.heightMm) <= 50).map((part) => part.id));
  const certifiedPanelIds = new Set((wallCutlist ?? []).map((part) => part.sourcePartId ?? part.id));
  const completeFabricationView = mode === 'fabrication' || mode === 'shop-sheet' || mode === 'both';
  const missingCutlistParts = cutlist && completeFabricationView ? [...expectedPanelIds].filter((id) => !certifiedPanelIds.has(id)).length : 0;
  const productionReady = completeFabricationView && Boolean(wallCutlist?.length)
    && ['approved', 'locked'].includes(scene.metadata.status)
    && options.measurementStatus === 'measured'
    && unmatchedCutlistRows === 0
    && missingCutlistParts === 0
    && rows.every((part) => ['approved', 'production_ready'].includes(String(part.status ?? '').toLowerCase()));

  const sheetW = 1200;
  const rowH = 28;
  const tableTop = 88;
  const tableRows = Math.max(rows.length, 1);
  const sheetH = Math.max(750, tableTop + 44 + tableRows * rowH + 155);
  const wallLengthMm = frame.length;
  const wallHeightMm = wall.heightMm!;
  const drawLeft = 72, drawTop = 95, drawW = 710, drawH = Math.min(490, sheetH - drawTop - 135);
  const scale = Math.min(drawW / wallLengthMm, drawH / wallHeightMm);
  const originX = drawLeft, originY = drawTop + drawH;
  const px = (alongMm: number) => originX + alongMm * scale;
  const py = (heightMm: number) => originY - heightMm * scale;
  const openingSvg = (scene.openings ?? []).filter((opening) => opening.wallId === wall.id).map((opening) => {
    const x = px(opening.offsetMm), y = py((opening.sillHeightMm ?? opening.sillMm ?? 0) + opening.heightMm);
    const w = opening.widthMm * scale, h = opening.heightMm * scale;
    return `<g data-opening-id="${escapeXml(opening.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bae6fd" fill-opacity=".48" stroke="#0369a1" stroke-width="1.3" stroke-dasharray="${opening.kind === 'door' ? 'none' : '5 3'}"/><text x="${x + w / 2}" y="${y + 12}" text-anchor="middle" font-size="7" font-family="Arial,sans-serif" fill="#0c4a6e">${escapeXml(opening.kind.toUpperCase())} ${Math.round(opening.widthMm)}×${Math.round(opening.heightMm)} · SILL ${Math.round(opening.sillHeightMm ?? opening.sillMm ?? 0)}</text></g>`;
  }).join('');
  const partColors: Record<string, string> = { carcass: '#dbeafe', shutter: '#fef3c7', shelf: '#dcfce7', filler: '#f3e8ff', back: '#e2e8f0', back_panel: '#e2e8f0', panel: '#fee2e2', glass: '#cffafe' };
  const componentSvg = visibleParts.map(({ part, projection }, index) => {
    const z = part.position.zMm ?? 0;
    const x = px(Math.max(0, projection.startMm));
    const width = Math.max(1, (Math.min(wallLengthMm, projection.endMm) - Math.max(0, projection.startMm)) * scale);
    const y = py(z + part.heightMm), height = Math.max(1, part.heightMm * scale);
    const centerX = x + width / 2, centerY = y + height / 2;
    const semantic = String(part.semanticType ?? 'component').toLowerCase();
    const material = scene.materials?.find((candidate) => candidate.id === part.materialId);
    const materialColor = options.materialSwatches?.[part.materialId ?? ''] ?? partColors[semantic] ?? '#f8fafc';
    return `<g data-part-id="${escapeXml(part.id)}" data-module-id="${escapeXml(part.moduleId)}" data-semantic-type="${escapeXml(semantic)}" data-material-id="${escapeXml(part.materialId ?? '')}"><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${escapeXml(materialColor)}" fill-opacity=".62" stroke="#334155" stroke-width="${semantic === 'shutter' ? 1.2 : .8}"/><circle cx="${centerX}" cy="${centerY}" r="7" fill="#fff" stroke="#1e293b" stroke-width=".8"/><text x="${centerX}" y="${centerY + 2.5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="6.5" font-weight="700" fill="#0f172a">${index + 1}</text><title>${escapeXml(part.id)} · ${escapeXml(part.name)} · ${part.widthMm}×${part.depthMm}×${part.heightMm} mm · ${escapeXml(material?.code ?? part.materialId ?? 'TBC')}</title></g>`;
  }).join('');
  const dimY = originY + 20;
  const tableX = 822, tableW = 354, firstRowY = tableTop + 38;
  const scheduleHeader = `<rect x="${tableX}" y="${tableTop}" width="${tableW}" height="24" fill="#263746"/><text x="${tableX + 8}" y="${tableTop + 16}" fill="#fff" font-family="Arial,sans-serif" font-size="10" font-weight="700">CUTLIST-LINKED COMPONENT SCHEDULE</text><text x="${tableX + 5}" y="${tableTop + 34}" font-family="Arial,sans-serif" font-size="6.3" font-weight="700" fill="#334155">PART ID / NAME · CUT SIZE L×W×T (mm)</text>`;
  const scheduleRows = rows.map((part, index) => {
    const y = firstRowY + index * rowH;
    const material = part.materialCode || 'TBC';
    const dims = `${part.lengthMm}×${part.widthMm}×${part.thicknessMm}`;
    const edge = part.edgeSchedule
      ? `${part.edgeSchedule.tapeType}: L ${part.edgeSchedule.l1Mm}/${part.edgeSchedule.l2Mm} · W ${part.edgeSchedule.w1Mm}/${part.edgeSchedule.w2Mm}`
      : 'EDGE TBC';
    const left = `${index + 1}. ${part.id} · ${part.partName}`;
    const right = `${dims} · QTY ${part.quantity}`;
    return `<rect x="${tableX}" y="${y - 10}" width="${tableW}" height="${rowH}" fill="${index % 2 ? '#f8fafc' : '#fff'}" stroke="#cbd5e1" stroke-width=".35"/><text x="${tableX + 5}" y="${y}" textLength="${tableW - 120}" lengthAdjust="spacingAndGlyphs" font-family="Arial,sans-serif" font-size="6.1" fill="#0f172a">${escapeXml(left)}</text><text x="${tableX + tableW - 5}" y="${y}" text-anchor="end" font-family="Arial,sans-serif" font-size="6.1" fill="#334155">${escapeXml(right)}</text><text x="${tableX + 5}" y="${y + 10}" font-family="Arial,sans-serif" font-size="5.7" fill="#475569">${escapeXml(material)} · GRAIN ${escapeXml(part.grainDirection ?? 'TBC')} · ${escapeXml(edge)}</text>`;
  }).join('');
  const overallLabel = `${Math.round(wallLengthMm)} mm`;
  const scaleLabel = `1:${(1 / scale).toFixed(1)}`;
  const status = productionReady ? 'PRODUCTION DATA VERIFIED' : mode === 'external' || mode === 'internal' ? 'VIEW ONLY · NOT FOR CONSTRUCTION' : 'NOT FOR CONSTRUCTION · REVIEW REQUIRED';
  const provenance = options.provenance ?? `scene.v1 ${scene.metadata.designVersion} · plan ${scene.floorPlanVersionId}`;
  const missingCutlist = !wallCutlist?.length ? 'Cutlist snapshot not attached for this wall: schedule is a geometry preview, not a certification result.' : '';
  const reviewRequired = wallCutlist?.some((part) => !['approved', 'production_ready'].includes(String(part.status ?? '').toLowerCase())) ? 'Cutlist panel rows still require production review.' : '';
  const warnings = [missingCutlist, withheldModules.length ? `${withheldModules.length} module(s) are withheld from this certified production elevation.` : '', unmatchedCutlistRows > 0 ? `${unmatchedCutlistRows} cutlist row(s) do not map to visible component IDs on this wall.` : '', missingCutlistParts > 0 ? `${missingCutlistParts} component panel(s) from scene geometry are absent from the cutlist snapshot.` : '', reviewRequired, options.measurementStatus !== 'measured' ? 'Measurement confirmation is missing.' : '', scene.metadata.status !== 'approved' && scene.metadata.status !== 'locked' ? 'Scene revision is not approved.' : ''].filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}">
<rect width="${sheetW}" height="${sheetH}" fill="#fff"/><rect width="${sheetW}" height="42" fill="#263746"/><text x="22" y="26" fill="#fff" font-family="Arial,sans-serif" font-size="14" font-weight="700">${escapeXml(options.studioName ?? 'ULTIDA')} · ${escapeXml(options.unitTitle ?? 'MEASURED COMPONENT ELEVATION')}</text><text x="1178" y="26" text-anchor="end" fill="#fff" font-family="Arial,sans-serif" font-size="9">${escapeXml(status)}</text>
<text x="${drawLeft}" y="72" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="#334155">WALL ${escapeXml(wall.id)} · FRONT ELEVATION · ${scaleLabel} · UNITS mm</text>
<rect x="${originX}" y="${py(wallHeightMm)}" width="${wallLengthMm * scale}" height="${wallHeightMm * scale}" fill="#fff" stroke="#334155" stroke-width="2"/>
${componentSvg}${openingSvg}
<line x1="${originX}" y1="${originY}" x2="${originX + wallLengthMm * scale}" y2="${originY}" stroke="#0f172a" stroke-width="2"/>
<line x1="${originX}" y1="${dimY}" x2="${originX + wallLengthMm * scale}" y2="${dimY}" stroke="#b91c1c" stroke-width=".8"/><path d="M${originX - 4} ${dimY - 4}l8 8m${wallLengthMm * scale - 4} -8l8 8" stroke="#b91c1c" stroke-width=".8"/><text x="${originX + wallLengthMm * scale / 2}" y="${dimY - 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#b91c1c">${overallLabel}</text>
<line x1="${originX - 18}" y1="${py(0)}" x2="${originX - 18}" y2="${py(wallHeightMm)}" stroke="#b91c1c" stroke-width=".8"/><text x="${originX - 24}" y="${py(wallHeightMm / 2)}" transform="rotate(-90 ${originX - 24} ${py(wallHeightMm / 2)})" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#b91c1c">${Math.round(wallHeightMm)} mm</text>
${scheduleHeader}${scheduleRows || `<text x="${tableX + 8}" y="${firstRowY}" font-family="Arial,sans-serif" font-size="8" fill="#b91c1c">No certified panel rows in cutlist snapshot.</text>`}
<text x="${tableX}" y="${firstRowY + tableRows * rowH + 12}" font-family="Arial,sans-serif" font-size="6.5" fill="#475569">Numbers on elevation map to schedule rows. IDs match the production workbook.</text>
${warnings.map((warning, index) => `<text x="${drawLeft}" y="${sheetH - 76 + index * 10}" font-family="Arial,sans-serif" font-size="7" font-weight="700" fill="#b91c1c">⚠ ${escapeXml(warning)}</text>`).join('')}
<rect y="${sheetH - 44}" width="${sheetW}" height="44" fill="#f1f5f9"/><text x="18" y="${sheetH - 27}" font-family="Arial,sans-serif" font-size="8" fill="#334155">PROJECT ${escapeXml(options.projectName ?? scene.projectId)} · REV ${escapeXml(options.revision ?? scene.metadata.designVersion)} · WALL ${escapeXml(wall.id)} · DATE ${escapeXml(options.sheetDate ?? 'TBC')}</text><text x="18" y="${sheetH - 12}" font-family="Arial,sans-serif" font-size="6.5" fill="#64748b">PROVENANCE: ${escapeXml(provenance)} · SCALE ${scaleLabel} · DO NOT SCALE · MATERIALS FROM SAVED SCENE PARTS</text><text x="1180" y="${sheetH - 18}" text-anchor="end" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${productionReady ? '#047857' : '#b91c1c'}">${escapeXml(status)}</text>
</svg>`;
}

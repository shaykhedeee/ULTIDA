import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { compileRenderBrief } from '@ultida/agent-core';
import type { VisualProposalRequest } from '@ultida/contracts';
import { renderScenePerspectiveArtifacts, runRenderQA, type BaseRenderArtifacts, type SceneExpectation, type MeasuredResult } from '@ultida/render-pipeline';
import { SceneV1Schema } from '@ultida/scene-core';
import { compileReferenceContext, retrieveReferences, type ReferenceVaultRecord } from './reference-retrieval.js';

type Gateway = {
  createVisualProposal(request: VisualProposalRequest): Promise<any>;
  pollTaskStatus(provider: string, taskId: string): Promise<any>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

export function renderInputFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function serverClient(environment: Record<string, string | undefined>, clientOverride?: SupabaseClient): SupabaseClient | null {
  if (clientOverride) return clientOverride;
  const secret = environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!environment.SUPABASE_URL || !secret) return null;
  return createClient(environment.SUPABASE_URL, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

function imageExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

export function buildSceneExpectation(scene: import('@ultida/scene-core').SceneV1, artifacts: BaseRenderArtifacts): SceneExpectation {
  const camera = scene.cameras[0];
  return {
    wallCount: scene.walls.length,
    doorCount: scene.openings.filter((opening) => opening.kind === 'door').length,
    windowCount: scene.openings.filter((opening) => opening.kind === 'window').length,
    moduleCount: scene.modules.length,
    cabinetDivisions: (scene.moduleParts ?? []).filter((part) => part.semanticType === 'shutter' || part.semanticType === 'drawer').length,
    skirtingCount: artifacts.skirtingMasks.length,
    camera: {
      positionMm: camera ? [camera.position.xMm, camera.position.yMm, camera.position.zMm] : [0, 0, 0],
      targetMm: camera ? [camera.target.xMm, camera.target.yMm, camera.target.zMm] : [0, 0, 0],
      fovDeg: 50,
    },
    expectedObjectIds: artifacts.objectMasks.map((mask) => mask.id),
    materialRegionIds: artifacts.materialRegions.map((region) => region.materialId),
  };
}

export type RenderGeometryContract = {
  valid: boolean;
  issues: string[];
  prompt: string;
  negativePrompt: string;
};

/**
 * Converts approved construction geometry into explicit image-provider
 * constraints. This rejects incomplete opening data before provider credits are
 * spent; AI never supplies a missing sill, door height, or skirting detail.
 */
export function compileRenderGeometryContract(scene: import('@ultida/scene-core').SceneV1, roomId: string): RenderGeometryContract {
  const issues: string[] = [];
  const room = scene.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return { valid: false, issues: [`Render room ${roomId} is missing from the approved scene.`], prompt: '', negativePrompt: '' };
  if (!scene.cameras.length) issues.push('A saved scene camera is required before generating a geometry-locked render.');
  const walls = scene.walls.filter((wall) => wall.spaceIds.includes(room.spaceId));
  if (!walls.length) issues.push(`Room ${room.id} has no measured wall geometry.`);
  const openings = scene.openings.filter((opening) => walls.some((wall) => wall.id === opening.wallId));
  for (const opening of openings) {
    const wall = walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall) { issues.push(`Opening ${opening.id} does not reference a measured room wall.`); continue; }
    const wallLengthMm = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
    if (opening.offsetMm < 0 || opening.widthMm <= 0 || opening.offsetMm + opening.widthMm > wallLengthMm + 0.5) issues.push(`Opening ${opening.id} exceeds its measured wall run.`);
    if (opening.sillHeightMm < 0 || opening.heightMm <= 0 || opening.sillHeightMm + opening.heightMm > wall.heightMm + 0.5) issues.push(`Opening ${opening.id} exceeds measured wall height; verify its sill and head dimensions.`);
    if (opening.kind === 'door' && Math.abs(opening.sillHeightMm) > 0.5) issues.push(`Door ${opening.id} must use a 0mm sill or be reclassified before rendering.`);
  }
  const floorSurfaces = scene.floors.flatMap((floor) => floor.surfaces ?? []).filter((surface) => surface.roomId === room.id);
  const openingLines = openings.length
    ? openings.map((opening) => `${opening.kind} ${opening.id}: wall ${opening.wallId}, offset ${opening.offsetMm}mm, clear width ${opening.widthMm}mm, height ${opening.heightMm}mm, sill ${opening.sillHeightMm}mm`).join('; ')
    : 'no openings recorded';
  const skirtingLines = floorSurfaces.filter((surface) => surface.skirting).map((surface) => `floor surface ${surface.id}: ${surface.skirting!.heightMm}mm ${surface.skirting!.profile} skirting, ${surface.skirting!.doorwayExclusions.length} doorway exclusion(s)`).join('; ') || 'no skirting specified';
  const prompt = `\nGEOMETRY LOCK — construction facts from approved scene.v1. Room ${room.name}: openings [${openingLines}]. Flooring and skirting [${skirtingLines}]. Preserve every opening offset, clear width, head height, sill height, wall thickness, floor build-up, skirting profile, saved camera, module envelope and cabinet division exactly.`;
  const negativePrompt = 'Do not move, resize, remove, cover, add, or reinterpret any door or window. Do not change a window sill height, opening head height, skirting height/profile, floor level, wall thickness, camera, module position, shutter count, drawer count, or cabinet division.';
  return { valid: issues.length === 0, issues, prompt, negativePrompt };
}

type Raster = { data: Buffer; width: number; height: number; channels: number };

function bytesFromDataUri(value: string): Buffer {
  const match = /^data:[^;]+;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error('Render QA expected a base64 image data URI.');
  return Buffer.from(match[1], 'base64');
}

async function rasterize(value: Buffer | string, width: number, height: number): Promise<Raster> {
  const source = typeof value === 'string' ? bytesFromDataUri(value) : value;
  const { data, info } = await sharp(source, { failOn: 'none' })
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function luminance(raster: Raster, pixel: number): number {
  const offset = pixel * raster.channels;
  return raster.data[offset]! * 0.2126 + raster.data[offset + 1]! * 0.7152 + raster.data[offset + 2]! * 0.0722;
}

function edgePixels(raster: Raster): Uint8Array {
  const result = new Uint8Array(raster.width * raster.height);
  for (let y = 1; y < raster.height - 1; y += 1) {
    for (let x = 1; x < raster.width - 1; x += 1) {
      const pixel = y * raster.width + x;
      const horizontal = Math.abs(luminance(raster, pixel + 1) - luminance(raster, pixel - 1));
      const vertical = Math.abs(luminance(raster, pixel + raster.width) - luminance(raster, pixel - raster.width));
      // The deterministic renderer uses intentionally subtle wall colours,
      // while provider imagery normally has stronger contrast.  A low but
      // non-zero gradient captures both and still rejects a flat image.
      result[pixel] = horizontal + vertical >= 12 ? 1 : 0;
    }
  }
  return result;
}

function maskPixels(mask: Raster): Uint8Array {
  const result = new Uint8Array(mask.width * mask.height);
  for (let pixel = 0; pixel < result.length; pixel += 1) {
    const offset = pixel * mask.channels;
    result[pixel] = mask.data[offset + 3]! > 127 ? 1 : 0;
  }
  return result;
}

function fractionInside(region: Uint8Array, evidence: Uint8Array): number {
  let covered = 0;
  let matches = 0;
  for (let pixel = 0; pixel < region.length; pixel += 1) {
    if (!region[pixel]) continue;
    covered += 1;
    if (evidence[pixel]) matches += 1;
  }
  return covered ? matches / covered : 0;
}

function edgeAlignment(reference: Raster, observedEdges: Uint8Array): number {
  let referenceEdges = 0;
  let matched = 0;
  for (let pixel = 0; pixel < observedEdges.length; pixel += 1) {
    if (luminance(reference, pixel) > 100) continue;
    referenceEdges += 1;
    const x = pixel % reference.width;
    const y = Math.floor(pixel / reference.width);
    let found = false;
    for (let dy = -2; dy <= 2 && !found; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const sampleX = x + dx;
        const sampleY = y + dy;
        if (sampleX >= 0 && sampleY >= 0 && sampleX < reference.width && sampleY < reference.height && observedEdges[sampleY * reference.width + sampleX]) {
          found = true;
          break;
        }
      }
    }
    if (found) matched += 1;
  }
  return referenceEdges ? matched / referenceEdges : 0;
}

/**
 * Measures raster evidence along the boundary of a projected construction
 * mask.  Unlike a simple object count, this detects a moved window, a changed
 * sill/head line, or skirting drawn away from its approved perimeter.
 */
function maskBoundaryAlignment(region: Uint8Array, width: number, height: number, observedEdges: Uint8Array): number {
  let boundaryCount = 0;
  let matched = 0;
  for (let pixel = 0; pixel < region.length; pixel += 1) {
    if (!region[pixel]) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const isBoundary = x === 0 || y === 0 || x === width - 1 || y === height - 1
      || !region[pixel - 1] || !region[pixel + 1] || !region[pixel - width] || !region[pixel + width];
    if (!isBoundary) continue;
    boundaryCount += 1;
    let found = false;
    for (let dy = -2; dy <= 2 && !found; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const sampleX = x + dx;
        const sampleY = y + dy;
        if (sampleX >= 0 && sampleY >= 0 && sampleX < width && sampleY < height && observedEdges[sampleY * width + sampleX]) {
          found = true;
          break;
        }
      }
    }
    if (found) matched += 1;
  }
  return boundaryCount ? matched / boundaryCount : 0;
}

/**
 * Measure the actual raster delivered by the deterministic pass or image
 * provider.  This deliberately derives counts from projected masks and image
 * edges; it never copies counts, object IDs, or camera values from the scene.
 */
export async function measureRenderImage(scene: import('@ultida/scene-core').SceneV1, artifacts: BaseRenderArtifacts, image: Buffer | string): Promise<MeasuredResult> {
  const reference = await rasterize(artifacts.edgeMap.url, 512, 384);
  const observed = await rasterize(image, reference.width, reference.height);
  const observedEdges = edgePixels(observed);
  const alignment = edgeAlignment(reference, observedEdges);

  const openingEvidence = await Promise.all(artifacts.openingMasks.map(async (opening) => {
    const region = maskPixels(await rasterize(opening.url, reference.width, reference.height));
    const boundaryAlignment = maskBoundaryAlignment(region, reference.width, reference.height, observedEdges);
    return { opening, visible: boundaryAlignment >= 0.18, boundaryAlignment };
  }));
  const objectEvidence = await Promise.all(artifacts.objectMasks.map(async (mask) => ({
    id: mask.id,
    visible: fractionInside(maskPixels(await rasterize(mask.url, reference.width, reference.height)), observedEdges) >= 0.003,
  })));
  const materialEvidence = await Promise.all(artifacts.materialRegions.map(async (region) => ({
    id: region.materialId,
    visible: fractionInside(maskPixels(await rasterize(region.url, reference.width, reference.height)), observedEdges) >= 0.003,
  })));
  const skirtingEvidence = await Promise.all(artifacts.skirtingMasks.map(async (skirting) => {
    const region = maskPixels(await rasterize(skirting.url, reference.width, reference.height));
    const boundaryAlignment = maskBoundaryAlignment(region, reference.width, reference.height, observedEdges);
    // A skirting band is deliberately thin at room scale. This still requires
    // observed edges on its projected perimeter instead of accepting metadata.
    return { id: skirting.id, visible: boundaryAlignment >= 0.12, boundaryAlignment };
  }));
  const measuredDoorCount = openingEvidence.filter(({ opening, visible }) => opening.kind === 'door' && visible).length;
  const measuredWindowCount = openingEvidence.filter(({ opening, visible }) => opening.kind === 'window' && visible).length;
  const expectedOpeningCount = scene.openings.length;
  return {
    wallEdgesAligned: alignment >= 0.55,
    openingCountMatches: measuredDoorCount + measuredWindowCount === expectedOpeningCount,
    measuredDoorCount,
    measuredWindowCount,
    openingGeometryAligned: openingEvidence.every(({ boundaryAlignment }) => boundaryAlignment >= 0.18),
    measuredSkirtingCount: skirtingEvidence.filter(({ visible }) => visible).length,
    skirtingGeometryAligned: skirtingEvidence.every(({ boundaryAlignment }) => boundaryAlignment >= 0.12),
    focalModuleVisible: scene.modules.length === 0 || objectEvidence.some(({ visible }) => visible),
    // A calibrated camera estimate needs a pose solver.  Until one is enabled,
    // edge alignment produces a conservative pixel-derived deviation instead
    // of claiming the locked camera matched exactly.
    cameraSimilarityMm: Math.round((1 - alignment) * 1000),
    measuredObjectIds: objectEvidence.filter(({ visible }) => visible).map(({ id }) => id),
    measuredMaterialRegionIds: materialEvidence.filter(({ visible }) => visible).map(({ id }) => id),
    // Cabinet divisions require a dedicated semantic detector.  Leaving this
    // undefined prevents a fabricated count from being treated as evidence.
    inventedObjectLabels: [],
  };
}

export async function evaluateRenderImageQA(scene: import('@ultida/scene-core').SceneV1, artifacts: BaseRenderArtifacts, image: Buffer | string): Promise<ReturnType<typeof runRenderQA>> {
  return runRenderQA(buildSceneExpectation(scene, artifacts), await measureRenderImage(scene, artifacts, image), 'strict');
}

/* Legacy synthetic preview removed from the production path.
export function generateTechnicalPreviewSvg(request: VisualProposalRequest): string {
  const style = request.style || 'Japandi Minimal';
  const width = 1200;
  const height = 800;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FAF7F2"/>
        <stop offset="100%" stop-color="#E8E2D7"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#D7A15C"/>
        <stop offset="100%" stop-color="#8C5A28"/>
      </linearGradient>
      <linearGradient id="cabinetGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#5C4033"/>
        <stop offset="50%" stop-color="#705243"/>
        <stop offset="100%" stop-color="#4D3428"/>
      </linearGradient>
      <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#wallGrad)"/>
    <polygon points="0,520 ${width},520 ${width},${height} 0,${height}" fill="url(#floorGrad)"/>
    <line x1="0" y1="520" x2="${width}" y2="520" stroke="#73471C" stroke-width="2"/>
    <g filter="url(#dropShadow)">
      <rect x="220" y="340" width="760" height="220" rx="6" fill="url(#cabinetGrad)" stroke="#3D291F" stroke-width="2"/>
      <line x1="410" y1="340" x2="410" y2="560" stroke="#3D291F" stroke-width="2"/>
      <line x1="600" y1="340" x2="600" y2="560" stroke="#3D291F" stroke-width="2"/>
      <line x1="790" y1="340" x2="790" y2="560" stroke="#3D291F" stroke-width="2"/>
      <rect x="240" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="430" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="620" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="810" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="220" y="160" width="760" height="160" rx="4" fill="#E5D8C5" opacity="0.9"/>
      <rect x="360" y="180" width="480" height="270" rx="8" fill="#1A1A1A" stroke="#333" stroke-width="4"/>
      <rect x="375" y="195" width="450" height="240" rx="4" fill="#0D0D0D"/>
    </g>
    <rect x="40" y="40" width="380" height="46" rx="23" fill="#1E1E1E" opacity="0.9"/>
    <text x="60" y="68" font-family="sans-serif" font-size="14" font-weight="700" fill="#00E5FF">TECHNICAL 3D SCENE PREVIEW</text>
    <text x="310" y="68" font-family="sans-serif" font-size="12" font-weight="400" fill="#E0E0E0">· ${style}</text>
  </svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
*/

function dataUriToBytes(dataUri: string): Buffer {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
  if (!match) throw new Error('Technical render artifact is not a valid base64 data URI.');
  return Buffer.from(match[2], 'base64');
}

async function providerImageBytes(result: any): Promise<{ bytes: Buffer; mimeType: string }> {
  let bytes: Buffer;
  let mimeType = 'image/png';
  if (result.image?.encoding === 'base64') {
    mimeType = result.image.mimeType || mimeType;
    bytes = Buffer.from(result.image.data, 'base64');
  } else if (result.resultUrl) {
    const remote = await fetch(result.resultUrl);
    if (!remote.ok) throw new Error(`Image provider result could not be downloaded (${remote.status}).`);
    mimeType = remote.headers.get('content-type')?.split(';')[0] || mimeType;
    bytes = Buffer.from(await remote.arrayBuffer());
  } else {
    throw new Error('Provider returned no persistable image output.');
  }
  if (!mimeType.startsWith('image/') || bytes.byteLength < 1024) throw new Error('Provider output is not a valid non-empty image.');
  return { bytes, mimeType };
}

async function persistTechnicalArtifacts(
  client: SupabaseClient,
  context: { organizationId: string; projectId: string; sceneVersionId: string; jobId: string; actorId: string },
  artifacts: BaseRenderArtifacts,
) {
  const entries = [
    { kind: 'technical_preview', label: 'rgb', value: artifacts.rgb },
    { kind: 'render_depth', label: 'depth', value: artifacts.depth },
    { kind: 'render_edge_map', label: 'edge', value: artifacts.edgeMap },
    ...artifacts.objectMasks.map((value) => ({ kind: 'render_object_mask', label: `object-${value.id}`, value })),
    ...artifacts.openingMasks.map((value) => ({ kind: 'render_opening_mask', label: `opening-${value.id}`, value })),
    ...artifacts.skirtingMasks.map((value) => ({ kind: 'render_skirting_mask', label: `skirting-${value.id}`, value })),
    ...artifacts.materialRegions.map((value) => ({ kind: 'render_material_mask', label: `material-${value.materialId}`, value })),
  ];
  const stored = await Promise.all(entries.map(async (entry) => {
    const path = `${context.organizationId}/${context.projectId}/renders/${context.sceneVersionId}/technical/${context.jobId}-${entry.label}.png`;
    const upload = await client.storage.from('project-assets').upload(path, dataUriToBytes(entry.value.url), { contentType: 'image/png', upsert: false });
    if (upload.error) throw new Error(`Technical render upload failed: ${upload.error.message}`);
    const artifact = await client.from('artifacts').insert({
      organization_id: context.organizationId,
      project_id: context.projectId,
      scene_version_id: context.sceneVersionId,
      job_id: context.jobId,
      kind: entry.kind,
      status: 'ready',
      storage_path: path,
      provenance: { baseHash: artifacts.baseHash, label: entry.label, synthetic: false },
      created_by: context.actorId,
    }).select('id').single();
    if (artifact.error || !artifact.data) {
      await client.storage.from('project-assets').remove([path]);
      throw new Error(`Technical render artifact registration failed: ${artifact.error?.message ?? 'unknown error'}`);
    }
    return { id: artifact.data.id, path, label: entry.label };
  }));
  const byLabel = new Map(stored.map((entry) => [entry.label, entry]));
  return {
    baseHash: artifacts.baseHash,
    rgb: byLabel.get('rgb')!,
    depth: byLabel.get('depth')!,
    edge: byLabel.get('edge')!,
    objectMasks: stored.filter((entry) => entry.label.startsWith('object-')),
    openingMasks: stored.filter((entry) => entry.label.startsWith('opening-')),
    skirtingMasks: stored.filter((entry) => entry.label.startsWith('skirting-')),
    materialMasks: stored.filter((entry) => entry.label.startsWith('material-')),
  };
}

async function storeImage(client: SupabaseClient, context: { organizationId: string; projectId: string; sceneVersionId: string; actorId?: string; jobId?: string; technicalArtifacts?: Record<string, unknown>; inputFingerprint?: string; revision?: Record<string, unknown>; renderQa: ReturnType<typeof runRenderQA> }, result: any, prompt: Record<string, unknown>, image?: { bytes: Buffer; mimeType: string }) {
  const persistedImage = image ?? await providerImageBytes(result);
  const { bytes, mimeType } = persistedImage;
  const path = `${context.organizationId}/${context.projectId}/renders/${context.sceneVersionId}/${crypto.randomUUID()}.${imageExtension(mimeType)}`;
  const upload = await client.storage.from('project-assets').upload(path, bytes, { contentType: mimeType, upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  const metadata = {
    provider: result.provider,
    model: result.model,
    operation: result.operation,
    sourceSceneVersionId: context.sceneVersionId,
    inputFingerprint: context.inputFingerprint,
    schemaVersion: 'render-artifact.v1',
    lockedElements: ['room shell', 'wall positions', 'door positions', 'window positions', 'opening sill and head heights', 'ceiling height', 'floor level and build-up', 'skirting geometry', 'camera pose', 'module bounds', 'shutter count'],
    materialRevision: context.revision ?? null,
    prompt,
    technicalArtifacts: context.technicalArtifacts,
    synthetic: false,
    reviewStatus: 'pending',
    qaStatus: 'measured_passed',
    renderQa: context.renderQa,
  };
  const assetPayload: any = { organization_id: context.organizationId, project_id: context.projectId, kind: 'render', storage_path: path, mime_type: mimeType, metadata, created_by: context.actorId ?? null };
  const asset = await client.from('project_assets').insert(assetPayload).select('id,created_at').single();
  if (asset.error) {
    await client.storage.from('project-assets').remove([path]);
    throw new Error(asset.error.message);
  }
  const artifact = await client.from('artifacts').insert({ organization_id: context.organizationId, project_id: context.projectId, scene_version_id: context.sceneVersionId, job_id: context.jobId ?? null, kind: 'photoreal_render', status: 'ready', storage_path: path, provenance: metadata, created_by: context.actorId ?? null }).select('id').single();
  if (artifact.error) throw new Error(artifact.error.message);
  const reference = await client.from('reference_library_items').insert({ organization_id: context.organizationId, project_id: context.projectId, asset_id: asset.data.id, title: `AI render ${new Date().toLocaleDateString('en-IN')}`, kind: 'render', tags: ['ai-render', result.provider], source: 'ultida-visual-studio', metadata, created_by: context.actorId ?? null });
  if (reference.error) throw new Error(reference.error.message);
  const signed = await client.storage.from('project-assets').createSignedUrl(path, 3600);
  if (signed.error) throw new Error(signed.error.message);
  return { assetId: asset.data.id, artifactId: artifact.data.id, storagePath: path, signedUrl: signed.data.signedUrl, mimeType, createdAt: asset.data.created_at, reviewStatus: 'pending' };
}

async function jobContext(client: SupabaseClient, request: VisualProposalRequest) {
  const project = await client.from('projects').select('id,organization_id').eq('id', request.projectId).single();
  if (project.error || !project.data) throw new Error('Project context was not found.');
  const sceneRow = await client.from('scene_versions').select('id,project_id,status,scene').eq('id', request.sceneVersionId).eq('project_id', request.projectId).single();
  if (sceneRow.error || !sceneRow.data) throw new Error('Scene context was not found.');
  if (!['approved', 'locked', 'draft'].includes(String(sceneRow.data.status))) throw new Error('Only approved, locked or active draft scenes can generate visuals.');
  const scene = SceneV1Schema.parse(sceneRow.data.scene);
  return { project: project.data, scene };
}

async function renderReferenceGuidance(
  client: SupabaseClient,
  organizationId: string,
  scene: import('@ultida/scene-core').SceneV1,
  roomId: string,
  style: string,
) {
  const room = scene.rooms.find((candidate) => candidate.id === roomId || candidate.type === roomId);
  const roomModules = scene.modules.filter((module) => module.roomId === roomId || module.roomId === room?.id);
  const moduleFamily = roomModules.length === 1 ? roomModules[0].family : undefined;
  const result = await client.from('reference_vault_entries')
    .select('id,title,source_path,room,module_family,style,material_tags,viewpoint,review_state,metadata')
    .eq('organization_id', organizationId)
    .eq('review_state', 'approved')
    .limit(180);
  if (result.error) return { prompt: '', ids: [] as string[] };
  const references = retrieveReferences((result.data ?? []) as ReferenceVaultRecord[], {
    text: `${style} ${room?.name ?? ''} ${roomModules.map((module) => module.family).join(' ')}`,
    room: room?.type,
    moduleFamily,
    limit: 6,
  });
  const context = compileReferenceContext(references);
  return {
    prompt: references.length ? `\nStudio reference guidance (visual only; never override scene geometry):\n${context.summary}\n${context.rules.join(' ')}` : '',
    ids: references.map((reference) => reference.id),
  };
}

export async function createVisualJob(environment: Record<string, string | undefined>, gateway: Gateway, request: VisualProposalRequest, actorId?: string, clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  const jobId = crypto.randomUUID();
  let persistedJobId: string | null = null;
  if (!actorId) {
    return { status: 'failed' as const, jobId, code: 'AUTHENTICATED_ACTOR_REQUIRED', message: 'An authenticated designer is required to start a render.', retryable: false };
  }

  // Validate the immutable source before spending provider credits.
  let preflight: Awaited<ReturnType<typeof jobContext>> | null = null;
  if (client) {
    try {
      preflight = await jobContext(client, request);
    } catch (error) {
      return { status: 'failed' as const, jobId, code: 'SCENE_NOT_RENDERABLE', message: error instanceof Error ? error.message : 'Scene validation failed.', retryable: false };
    }
  }

  if (!client) {
    return { status: 'failed' as const, jobId, code: 'PERSISTENCE_UNAVAILABLE', message: 'Server Supabase credentials are required before a render can start.', retryable: false };
  }

  try {
    const context = preflight ?? await jobContext(client, request);
    const geometryContract = compileRenderGeometryContract(context.scene, request.roomId);
    if (!geometryContract.valid) {
      return { status: 'failed' as const, jobId, code: 'RENDER_GEOMETRY_INCOMPLETE', message: geometryContract.issues.join(' '), retryable: false };
    }
    const brief = compileRenderBrief({ scene: context.scene, sceneVersionId: request.sceneVersionId, roomId: request.roomId, style: request.style, quality: request.quality, camera: request.camera });
    const referenceGuidance = await renderReferenceGuidance(client, context.project.organization_id, context.scene, brief.roomId, brief.style);
    const materialSwapInstruction = request.operation === 'material-swap'
      ? `\nMATERIAL REVISION LOCK: edit only the pixels inside the supplied mask for module ${request.targetModuleId} (${request.targetSemanticSlot ?? 'selected finish'}). Apply material ${request.targetMaterialId ?? 'selected by the studio'}. Do not alter any pixels outside that mask. Preserve the room shell, openings, ceiling, camera, module footprint, shutter count, hardware, lighting, and every unaffected finish.`
      : '';
    const structuredPrompt = `${brief.positivePrompt}${geometryContract.prompt}${referenceGuidance.prompt}${materialSwapInstruction}`;
    const negativePrompt = request.operation === 'material-swap'
      ? `${brief.negativePrompt}, ${geometryContract.negativePrompt}, changed architecture, moved door, moved window, changed room proportions, changed ceiling, changed camera, changed module layout, changed shutters, changed hardware, changed lighting, change outside selected mask`
      : `${brief.negativePrompt}, ${geometryContract.negativePrompt}`;
    const normalizedRequest: VisualProposalRequest = { ...request, roomId: brief.roomId, structuredPrompt, negativePrompt, promptVersion: brief.version };
    const inputFingerprint = renderInputFingerprint({ sceneVersionId: request.sceneVersionId, roomId: brief.roomId, operation: request.operation, targetModuleId: request.targetModuleId, targetComponentId: request.targetComponentId, targetMaterialId: request.targetMaterialId, targetSemanticSlot: request.targetSemanticSlot, style: brief.style, quality: brief.quality, camera: request.camera, references: referenceGuidance.ids, geometryContract, structuredPrompt, negativePrompt, promptVersion: brief.version });
    const idempotencyKey = request.idempotencyKey ?? `render:${inputFingerprint}`;
    
    const job = await client.from('jobs').insert({ organization_id: context.project.organization_id, project_id: request.projectId, kind: 'visual_proposal', status: 'queued', idempotency_key: idempotencyKey, input: { ...normalizedRequest, renderBrief: brief }, output: { reviewStatus: 'pending' }, attempts: 1, created_by: actorId ?? null }).select('id').single();
    if (job.error || !job.data) {
      if (job.error?.code === '23505' || /duplicate|unique/i.test(job.error?.message ?? '')) {
        const existing = await client.from('jobs').select('id,status,output,error').eq('idempotency_key', idempotencyKey).maybeSingle();
        if (existing.data) return { status: existing.data.status === 'succeeded' ? 'succeeded' as const : existing.data.status === 'failed' ? 'failed' as const : 'queued' as const, jobId: existing.data.id, output: existing.data.output, error: existing.data.error, deduplicated: true };
      }
      return { status: 'failed' as const, code: 'JOB_CREATE_FAILED', reason: job.error?.message ?? 'Visual job could not be created.', retryable: true };
    }
    persistedJobId = job.data.id;

    const baseArtifacts = renderScenePerspectiveArtifacts(context.scene, { cameraId: request.camera?.view === 'elevation' ? undefined : context.scene.cameras[0]?.id });
    const technicalArtifacts = await persistTechnicalArtifacts(client, {
      organizationId: context.project.organization_id,
      projectId: request.projectId,
      sceneVersionId: request.sceneVersionId,
      jobId: job.data.id,
      actorId,
    }, baseArtifacts);
    // The deterministic edge map is the base pass's measurable output.  It
    // has no photoreal styling noise, so it is the canonical geometry evidence
    // used to validate the scene before a provider is invoked.
    const deterministicQa = await evaluateRenderImageQA(context.scene, baseArtifacts, baseArtifacts.edgeMap.url);
    const blockingQa = deterministicQa.issues.filter((issue) => issue.severity === 'blocking');
    if (blockingQa.length) {
      const message = `Geometry-locked render QA blocked this job: ${blockingQa.map((issue) => issue.message).join(' ')}`;
      await client.from('jobs').update({ status: 'failed', error: message, output: { reviewStatus: 'rejected', renderQa: deterministicQa, technicalArtifacts, baseHash: baseArtifacts.baseHash } }).eq('id', job.data.id);
      return { status: 'failed' as const, jobId: job.data.id, code: 'RENDER_QA_BLOCKED', message, retryable: false };
    }
    const selectedObjectMask = request.operation === 'material-swap'
      ? baseArtifacts.objectMasks.find((mask) => mask.id === request.targetModuleId)
      : undefined;
    if (request.operation === 'material-swap' && !selectedObjectMask) {
      await client.from('jobs').update({ status: 'failed', error: 'The selected module has no deterministic scene mask. Recompile the scene before requesting a laminate revision.' }).eq('id', job.data.id);
      return { status: 'failed' as const, jobId: job.data.id, code: 'RENDER_TARGET_MASK_UNAVAILABLE', message: 'The selected module has no deterministic scene mask. Recompile the scene before requesting a laminate revision.', retryable: false };
    }
    const providerRequest: VisualProposalRequest = {
      ...normalizedRequest,
      sourceAssets: [baseArtifacts.rgb.url],
      masks: request.operation === 'material-swap'
        ? [baseArtifacts.edgeMap.url, selectedObjectMask!.url]
        : [],
      conditioningIntent: request.operation === 'material-swap' ? 'control' : 'reference',
      conditioningMaps: {
        depthMapUrl: baseArtifacts.depth.url,
        cannyEdgeMapUrl: baseArtifacts.edgeMap.url,
        materialKeyMapUrl: baseArtifacts.materialRegions[0]?.url,
        objectMaskUrl: selectedObjectMask?.url,
      },
      // FLUX.2 receives ordinary image references, not typed depth/mask controls.
      // Precision edits fail closed at the gateway until a verified adapter exists.
      providerPreference: ['cloudflare'],
    };
    await client.from('jobs').update({
      status: 'running',
      started_at: new Date().toISOString(),
      input: { ...providerRequest, renderBrief: brief, technicalArtifacts, referenceIds: referenceGuidance.ids },
      output: { reviewStatus: 'pending', renderQa: deterministicQa, technicalArtifacts, baseHash: baseArtifacts.baseHash, inputFingerprint, referenceIds: referenceGuidance.ids, materialRevision: request.operation === 'material-swap' ? { targetModuleId: request.targetModuleId, targetComponentId: request.targetComponentId, targetMaterialId: request.targetMaterialId, targetSemanticSlot: request.targetSemanticSlot, maskId: selectedObjectMask?.id } : null },
    }).eq('id', job.data.id);
    const result = await gateway.createVisualProposal(providerRequest);

    if (result.status === 'provider_not_configured') {
      await client.from('jobs').update({ status: 'failed', error: result.message }).eq('id', job.data.id);
      return { status: 'failed' as const, jobId: job.data.id, code: 'IMAGE_PROVIDER_NOT_CONFIGURED', message: result.message, retryable: false };
    }

    if (result.status === 'failed') {
      await client.from('jobs').update({ status: 'failed', error: result.message }).eq('id', job.data.id);
      return { status: 'failed' as const, jobId: job.data.id, code: result.code || 'IMAGE_GENERATION_FAILED', message: result.message || 'Image generation failed.', retryable: result.retryable ?? true };
    }
    
    if (result.status === 'succeeded') {
      const image = await providerImageBytes(result);
      const renderQa = await evaluateRenderImageQA(context.scene, baseArtifacts, image.bytes);
      const blockingQa = renderQa.issues.filter((issue) => issue.severity === 'blocking');
      if (blockingQa.length) {
        const message = `Rendered image QA blocked this job: ${blockingQa.map((issue) => issue.message).join(' ')}`;
        await client.from('jobs').update({ status: 'failed', error: message, output: { reviewStatus: 'rejected', renderQa, technicalArtifacts, baseHash: baseArtifacts.baseHash } }).eq('id', job.data.id);
        return { status: 'failed' as const, jobId: job.data.id, code: 'RENDER_QA_BLOCKED', message, retryable: false };
      }
      const stored = await storeImage(client, { organizationId: context.project.organization_id, projectId: request.projectId, sceneVersionId: request.sceneVersionId, actorId, jobId: job.data.id, technicalArtifacts, inputFingerprint, renderQa, revision: request.operation === 'material-swap' ? { targetModuleId: request.targetModuleId, targetComponentId: request.targetComponentId, targetMaterialId: request.targetMaterialId, targetSemanticSlot: request.targetSemanticSlot, maskId: selectedObjectMask?.id } : undefined }, result, brief, image);
      const output = { ...result, ...stored, promptVersion: brief.version, technicalArtifacts, baseHash: baseArtifacts.baseHash, inputFingerprint, renderQa, renderStatus: 'completed' };
      await client.from('jobs').update({ status: 'succeeded', output }).eq('id', job.data.id);
      return { status: 'succeeded' as const, jobId: job.data.id, ...output };
    }

    const output = { ...result, promptVersion: brief.version, reviewStatus: 'pending', synthetic: false };
    await client.from('jobs').update({ status: 'running', output }).eq('id', job.data.id);
    return { status: 'queued' as const, jobId: job.data.id, ...output };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Visual job processing failed.';
    // A persisted job must always reach a terminal state. Without this update a
    // storage or provider exception leaves the browser polling "Rendering..." forever.
    if (persistedJobId) {
      await client.from('jobs').update({
        status: 'failed',
        error: message,
      }).eq('id', persistedJobId);
    }
    return {
      status: 'failed' as const,
      jobId: persistedJobId ?? jobId,
      code: 'VISUAL_JOB_ERROR',
      message,
      retryable: true
    };
  }
}

export async function getVisualJob(environment: Record<string, string | undefined>, gateway: Gateway, jobId: string, projectId: string, clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  if (!client) return { status: 'failed' as const, jobId, code: 'PERSISTENCE_UNAVAILABLE', message: 'Job persistence requires Supabase service credentials.' };
  
  const job = await client.from('jobs').select('*').eq('id', jobId).eq('project_id', projectId).single();
  if (job.error || !job.data) return { status: 'not_found' as const };
  if (job.data.status === 'running' && job.data.output?.provider && job.data.output?.promptId) {
    const polled = await gateway.pollTaskStatus(job.data.output.provider, job.data.output.promptId);
    if (polled.status === 'failed') {
      await client.from('jobs').update({ status: 'failed', error: polled.reason ?? 'Provider failed.' }).eq('id', jobId);
      return { status: 'failed' as const, jobId, reason: polled.reason ?? 'Provider failed.' };
    }
    if (polled.status === 'succeeded') {
      try {
        const project = await client.from('projects').select('organization_id').eq('id', job.data.project_id).single();
        if (project.error || !project.data) throw new Error('Project organization context was not found.');
        const sceneRow = await client.from('scene_versions').select('scene').eq('id', job.data.input.sceneVersionId).eq('project_id', job.data.project_id).single();
        if (sceneRow.error || !sceneRow.data) throw new Error('The approved scene for this render could not be reloaded for image QA.');
        const scene = SceneV1Schema.parse(sceneRow.data.scene);
        const baseArtifacts = renderScenePerspectiveArtifacts(scene, { cameraId: job.data.input?.camera?.view === 'elevation' ? undefined : scene.cameras[0]?.id });
        const image = await providerImageBytes({ ...job.data.output, ...polled });
        const renderQa = await evaluateRenderImageQA(scene, baseArtifacts, image.bytes);
        const blockingQa = renderQa.issues.filter((issue) => issue.severity === 'blocking');
        if (blockingQa.length) {
          const reason = `Rendered image QA blocked this job: ${blockingQa.map((issue) => issue.message).join(' ')}`;
          await client.from('jobs').update({ status: 'failed', error: reason, output: { ...job.data.output, ...polled, reviewStatus: 'rejected', renderQa } }).eq('id', jobId);
          return { status: 'failed' as const, jobId, reason };
        }
        const stored = await storeImage(client, {
          organizationId: project.data.organization_id,
          projectId: job.data.project_id,
          sceneVersionId: job.data.input.sceneVersionId,
          actorId: job.data.created_by,
          jobId,
          technicalArtifacts: job.data.output?.technicalArtifacts,
          inputFingerprint: job.data.output?.inputFingerprint,
          renderQa,
          revision: job.data.input?.operation === 'material-swap' ? {
            targetModuleId: job.data.input?.targetModuleId,
            targetComponentId: job.data.input?.targetComponentId,
            targetMaterialId: job.data.input?.targetMaterialId,
            targetSemanticSlot: job.data.input?.targetSemanticSlot,
          } : undefined,
        }, { ...job.data.output, ...polled }, job.data.input?.renderBrief ?? {}, image);
        const output = { ...job.data.output, ...polled, ...stored, renderQa, renderStatus: 'completed' };
        await client.from('jobs').update({ status: 'succeeded', output }).eq('id', jobId);
        return { status: 'succeeded' as const, jobId, ...output };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Render persistence failed.';
        await client.from('jobs').update({ status: 'failed', error: reason }).eq('id', jobId);
        return { status: 'failed' as const, jobId, reason };
      }
    }
  }
  return { status: job.data.status, jobId, output: job.data.output, error: job.data.error };
}

export async function listProjectRenders(environment: Record<string, string | undefined>, projectId: string, clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  if (!client) return { status: 'succeeded' as const, renders: [] };
  const { data, error } = await client.from('artifacts').select('id,scene_version_id,status,storage_path,provenance,created_at,updated_at').eq('project_id', projectId).eq('kind', 'photoreal_render').order('created_at', { ascending: false });
  if (error) return { status: 'failed' as const, reason: error.message };
  const renders = await Promise.all((data ?? []).map(async (artifact) => {
    const signed = artifact.storage_path ? await client.storage.from('project-assets').createSignedUrl(artifact.storage_path, 3600) : null;
    return { ...artifact, signedUrl: signed && !signed.error ? signed.data.signedUrl : null };
  }));
  return { status: 'succeeded' as const, renders };
}

export async function reviewVisualJob(environment: Record<string, string | undefined>, jobId: string, projectId: string, decision: 'approved' | 'rejected' | 'cancelled', note = '', clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  if (!client) return { status: 'succeeded' as const, jobId, reviewStatus: decision };
  const { data: job, error } = await client.from('jobs').select('id,status,output').eq('id', jobId).eq('project_id', projectId).single();
  if (error || !job) return { status: 'not_found' as const };
  if (decision === 'cancelled') {
    if (!['queued', 'running'].includes(job.status)) return { status: 'conflict' as const, reason: 'Only active jobs can be cancelled.' };
    await client.from('jobs').update({ status: 'cancelled', output: { ...(job.output ?? {}), reviewStatus: 'cancelled', reviewNote: note } }).eq('id', jobId);
    return { status: 'cancelled' as const, jobId };
  }
  if (job.status !== 'succeeded') return { status: 'conflict' as const, reason: 'Only completed renders can be reviewed.' };
  const output = { ...(job.output ?? {}), reviewStatus: decision, reviewNote: note, reviewedAt: new Date().toISOString() };
  await client.from('jobs').update({ output }).eq('id', jobId);
  if (output.artifactId) await client.from('artifacts').update({ provenance: { ...(output as Record<string, unknown>), signedUrl: undefined } }).eq('id', output.artifactId);
  return { status: 'succeeded' as const, jobId, reviewStatus: decision };
}

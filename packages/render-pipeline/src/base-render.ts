/**
 * render-pipeline — deterministic base render + conditioning artifacts.
 *
 * Produces REAL raster PNGs from the scene graph (no GPU, no native deps):
 *   - rgb:           shaded plan/axonometric projection of rooms + modules
 *   - edge_map:      wall/opening outlines
 *   - object_masks:  one grayscale mask per module id
 *   - material_regions: one region mask per material id
 *   - depth:         orthographic depth (brighter = closer to camera)
 *
 * This is the deterministic, geometry-locked substrate the image model is asked
 * to ENHANCE — never a placeholder SVG returned as a successful photoreal render.
 */

import { createHash } from 'node:crypto';
import type { SceneV1 } from '@ultida/scene-core';

export interface SceneBox {
  id: string;
  kind: 'room' | 'module' | 'opening';
  // axis-aligned bounding box in millimetres (world X, Z plan axes)
  x1: number; y1: number; x2: number; y2: number;
  materialId?: string;
  category?: string;
}

export interface BaseRenderInput {
  boxes: SceneBox[];
  width?: number; // output pixels
  height?: number;
  cameraHeightMm?: number; // for depth shading
}

export interface BaseRenderArtifacts {
  rgb: { url: string; bytes: number };
  edgeMap: { url: string; bytes: number };
  objectMasks: Array<{ id: string; url: string; bytes: number }>;
  materialRegions: Array<{ materialId: string; url: string; bytes: number }>;
  depth: { url: string; bytes: number };
  baseHash: string;
}

type Vec3 = { x: number; y: number; z: number };
type ProjectedPoint = { x: number; y: number; depth: number };
type ScenePrimitive = {
  id: string;
  kind: 'floor' | 'wall' | 'module';
  materialId?: string;
  faces: Vec3[][];
  color: [number, number, number, number];
};

/**
 * Render a perspective technical base from the approved scene.v1 geometry.
 * This intentionally lives beside the legacy plan renderer while callers
 * migrate. It projects real room/wall/module geometry, including wall openings,
 * instead of recreating the room from top-down rectangles.
 */
export function renderScenePerspectiveArtifacts(scene: SceneV1, options: { width?: number; height?: number; cameraId?: string } = {}): BaseRenderArtifacts {
  const width = options.width ?? 1024;
  const height = options.height ?? 768;
  const camera = scene.cameras.find((item) => item.id === options.cameraId) ?? scene.cameras[0];
  if (!camera) throw new Error('A scene camera is required for a perspective technical preview.');

  const primitives = scenePrimitives(scene);
  const rgb = createBackground(width, height, [239, 237, 231, 255]);
  const edge = createBackground(width, height, [255, 255, 255, 255]);
  const depth = createBackground(width, height, [245, 245, 245, 255]);
  const projection = createProjector(camera.position, camera.target, camera.lensMm, width, height);
  const rendered = primitives
    .map((primitive) => ({ primitive, projected: primitive.faces.map((face) => projectFace(face, projection)) }))
    .filter((item) => item.projected.some((face) => face.length >= 3))
    .sort((a, b) => averageDepth(b.projected) - averageDepth(a.projected));

  for (const item of rendered) {
    for (const face of item.projected) {
      if (face.length < 3) continue;
      fillPolygon(rgb, width, height, face, shadeForFace(item.primitive.color, face));
      strokePolygon(edge, width, height, face, [45, 45, 45, 255]);
      const shade = depthShade(face);
      fillPolygon(depth, width, height, face, [shade, shade, shade, 255]);
    }
  }

  const rgbPng = encodePng(width, height, rgb);
  const edgePng = encodePng(width, height, edge);
  const depthPng = encodePng(width, height, depth);
  const modules = rendered.filter((item) => item.primitive.kind === 'module');
  const objectMasks = modules.map((item) => ({ id: item.primitive.id, ...renderMask(width, height, item.projected) }));
  const materialGroups = new Map<string, ProjectedPoint[][]>();
  for (const item of modules) {
    if (!item.primitive.materialId) continue;
    const faces = materialGroups.get(item.primitive.materialId) ?? [];
    faces.push(...item.projected);
    materialGroups.set(item.primitive.materialId, faces);
  }
  const materialRegions = Array.from(materialGroups.entries()).map(([materialId, faces]) => ({ materialId, ...renderMask(width, height, faces) }));

  return {
    rgb: { url: dataUri(rgbPng), bytes: rgbPng.length },
    edgeMap: { url: dataUri(edgePng), bytes: edgePng.length },
    depth: { url: dataUri(depthPng), bytes: depthPng.length },
    objectMasks,
    materialRegions,
    baseHash: createHash('sha256').update(rgbPng).digest('hex'),
  };
}

function createBackground(width: number, height: number, color: [number, number, number, number]) {
  const buffer = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    buffer[offset] = color[0]; buffer[offset + 1] = color[1]; buffer[offset + 2] = color[2]; buffer[offset + 3] = color[3];
  }
  return buffer;
}

function scenePrimitives(scene: SceneV1): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  for (const room of scene.rooms) {
    const boundary = room.boundary.slice(0, -1).map((point) => ({ x: point.xMm, y: 0, z: point.yMm }));
    if (boundary.length >= 3) primitives.push({ id: `floor:${room.id}`, kind: 'floor', faces: [boundary], color: [213, 205, 193, 255] });
  }
  for (const wall of scene.walls) {
    const dx = wall.end.xMm - wall.start.xMm;
    const dz = wall.end.yMm - wall.start.yMm;
    const length = Math.hypot(dx, dz);
    if (!length) continue;
    const openings = scene.openings.filter((opening) => opening.wallId === wall.id).sort((a, b) => a.offsetMm - b.offsetMm);
    let cursor = 0;
    const addSegment = (startMm: number, endMm: number, bottomMm: number, heightMm: number, suffix: string) => {
      if (endMm - startMm <= 1 || heightMm <= 1) return;
      const ux = dx / length; const uz = dz / length;
      const nx = -uz * wall.thicknessMm / 2; const nz = ux * wall.thicknessMm / 2;
      const point = (offset: number, y: number, side: -1 | 1): Vec3 => ({
        x: wall.start.xMm + ux * offset + nx * side,
        y: wall.baseElevationMm + bottomMm + y,
        z: wall.start.yMm + uz * offset + nz * side,
      });
      primitives.push({
        id: `wall:${wall.id}:${suffix}`,
        kind: 'wall',
        color: [228, 224, 216, 255],
        faces: boxFaces(point(startMm, 0, -1), point(endMm, 0, -1), point(endMm, heightMm, -1), point(startMm, heightMm, -1), point(startMm, 0, 1), point(endMm, 0, 1), point(endMm, heightMm, 1), point(startMm, heightMm, 1)),
      });
    };
    for (const opening of openings) {
      const openingStart = Math.max(cursor, opening.offsetMm);
      const openingEnd = Math.min(length, opening.offsetMm + opening.widthMm);
      addSegment(cursor, openingStart, 0, wall.heightMm, 'solid');
      addSegment(openingStart, openingEnd, 0, opening.sillHeightMm, `${opening.id}:sill`);
      addSegment(openingStart, openingEnd, opening.sillHeightMm + opening.heightMm, wall.heightMm - opening.sillHeightMm - opening.heightMm, `${opening.id}:head`);
      cursor = Math.max(cursor, openingEnd);
    }
    addSegment(cursor, length, 0, wall.heightMm, 'solid');
  }
  // Old persisted scenes predate exact part geometry. They remain previewable
  // as envelopes; new scene.v1 compilations provide parts and take precedence.
  const exactParts = scene.moduleParts ?? [];
  const modulesWithParts = new Set(exactParts.map((part) => part.moduleId));
  const renderableModules = scene.modules.filter((module) => !modulesWithParts.has(module.id));
  const renderBox = (entity: { id: string; widthMm: number; depthMm: number; heightMm: number; position: { xMm: number; yMm: number }; rotationDeg: number; materialId?: string; family: string }) => {
    const theta = -entity.rotationDeg * Math.PI / 180;
    const local = (x: number, z: number, y: number): Vec3 => ({
      x: entity.position.xMm + x * Math.cos(theta) - z * Math.sin(theta),
      y,
      z: entity.position.yMm + x * Math.sin(theta) + z * Math.cos(theta),
    });
    primitives.push({
      id: entity.id,
      kind: 'module',
      materialId: entity.materialId,
      color: colorForId(entity.materialId ?? entity.family),
      faces: boxFaces(local(0, 0, 0), local(entity.widthMm, 0, 0), local(entity.widthMm, entity.depthMm, 0), local(0, entity.depthMm, 0), local(0, 0, entity.heightMm), local(entity.widthMm, 0, entity.heightMm), local(entity.widthMm, entity.depthMm, entity.heightMm), local(0, entity.depthMm, entity.heightMm)),
    });
  };
  for (const module of renderableModules) renderBox(module);
  for (const part of exactParts) {
    renderBox({
      id: part.id,
      family: part.semanticType,
      widthMm: part.widthMm,
      depthMm: part.depthMm,
      heightMm: part.heightMm,
      position: { xMm: part.position.xMm, yMm: part.position.yMm },
      rotationDeg: part.rotationDeg,
      materialId: part.materialId,
    });
  }
  return primitives;
}

function boxFaces(a: Vec3, b: Vec3, c: Vec3, d: Vec3, e: Vec3, f: Vec3, g: Vec3, h: Vec3): Vec3[][] {
  return [[a, b, c, d], [e, h, g, f], [a, e, f, b], [b, f, g, c], [c, g, h, d], [d, h, e, a]];
}

function createProjector(position: { xMm: number; yMm: number; zMm: number }, target: { xMm: number; yMm: number; zMm: number }, lensMm: number, width: number, height: number) {
  const eye: Vec3 = { x: position.xMm, y: position.yMm, z: position.zMm };
  const forward = normalize({ x: target.xMm - eye.x, y: target.yMm - eye.y, z: target.zMm - eye.z });
  let right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  if (!isFinite(right.x)) right = { x: 1, y: 0, z: 0 };
  const up = normalize(cross(right, forward));
  const focal = Math.max(width, height) * Math.max(0.7, lensMm / 35);
  return { eye, forward, right, up, focal, width, height };
}

function projectFace(face: Vec3[], projector: ReturnType<typeof createProjector>): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];
  for (const point of face) {
    const relative = { x: point.x - projector.eye.x, y: point.y - projector.eye.y, z: point.z - projector.eye.z };
    const depth = dot(relative, projector.forward);
    if (depth <= 20) return [];
    points.push({
      x: projector.width / 2 + dot(relative, projector.right) * projector.focal / depth,
      y: projector.height / 2 - dot(relative, projector.up) * projector.focal / depth,
      depth,
    });
  }
  return points;
}

function renderMask(width: number, height: number, faces: ProjectedPoint[][]) {
  const mask = Buffer.alloc(width * height * 4);
  for (const face of faces) if (face.length >= 3) fillPolygon(mask, width, height, face, [255, 255, 255, 255]);
  const png = encodePng(width, height, mask);
  return { url: dataUri(png), bytes: png.length };
}

function colorForId(value: string): [number, number, number, number] {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return [110 + (hash & 31), 82 + ((hash >> 5) & 31), 58 + ((hash >> 10) & 31), 255];
}

function shadeForFace(color: [number, number, number, number], face: ProjectedPoint[]): [number, number, number, number] {
  const shade = 0.72 + Math.min(0.28, Math.max(0, averageDepth([face]) / 12000));
  return [Math.round(color[0] * shade), Math.round(color[1] * shade), Math.round(color[2] * shade), color[3]];
}

function depthShade(face: ProjectedPoint[]) { return Math.max(20, Math.min(240, Math.round(255 - averageDepth([face]) / 70))); }
function averageDepth(faces: ProjectedPoint[][]) { const values = faces.flat().map((point) => point.depth); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function dot(a: Vec3, b: Vec3) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: Vec3, b: Vec3): Vec3 { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function normalize(vector: Vec3): Vec3 { const length = Math.hypot(vector.x, vector.y, vector.z); return length ? { x: vector.x / length, y: vector.y / length, z: vector.z / length } : { x: NaN, y: NaN, z: NaN }; }

// ---------------------------------------------------------------------------
// Minimal dependency-free PNG encoder (truecolor 8-bit, no compression filter).
// ---------------------------------------------------------------------------
function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6 = RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Add filter byte (0) per scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  // PNG IDAT carries a zlib stream (RFC 1950), not a bare DEFLATE stream.
  // A raw stream passes signature/hash checks but strict decoders reject it.
  const idat = zlibDeflate(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Tiny raw-DEFLATE using Node's zlib (deflateRawSync) — still no extra deps.
import { deflateSync } from 'node:zlib';
function zlibDeflate(buf: Buffer): Buffer {
  return deflateSync(buf, { level: 6 });
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

function dataUri(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Deterministic projection (top-down plan) -> RGBA buffers.
// ---------------------------------------------------------------------------
export function renderBaseArtifacts(input: BaseRenderInput): BaseRenderArtifacts {
  const W = input.width ?? 1024;
  const H = input.height ?? 768;
  const boxes = input.boxes;

  // World bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x1, b.x2); minY = Math.min(minY, b.y1, b.y2);
    maxX = Math.max(maxX, b.x1, b.x2); maxY = Math.max(maxY, b.y1, b.y2);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 4000; maxY = 3000; }
  const pad = 80;
  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const scale = Math.min((W - 2 * pad) / worldW, (H - 2 * pad) / worldH);
  const offX = (W - worldW * scale) / 2;
  const offY = (H - worldH * scale) / 2;
  const sx = (x: number) => offX + (x - minX) * scale;
  const sy = (y: number) => offY + (y - minY) * scale;

  const rgb = Buffer.alloc(W * H * 4);
  const edge = Buffer.alloc(W * H * 4);
  const depth = Buffer.alloc(W * H * 4);
  // fill backgrounds
  for (let i = 0; i < W * H; i++) {
    rgb[i * 4] = 244; rgb[i * 4 + 1] = 242; rgb[i * 4 + 2] = 237; rgb[i * 4 + 3] = 255;
    edge[i * 4] = 255; edge[i * 4 + 1] = 255; edge[i * 4 + 2] = 255; edge[i * 4 + 3] = 255;
    depth[i * 4] = 240; depth[i * 4 + 1] = 240; depth[i * 4 + 2] = 240; depth[i * 4 + 3] = 255;
  }

  const rooms = boxes.filter((b) => b.kind === 'room');
  const modules = boxes.filter((b) => b.kind === 'module');
  const openings = boxes.filter((b) => b.kind === 'opening');

  // Draw rooms (soft fill)
  for (const r of rooms) {
    fillRect(rgb, W, H, sx(r.x1), sy(r.y1), sx(r.x2), sy(r.y2), [226, 214, 196, 255]);
    strokeRect(edge, W, H, sx(r.x1), sy(r.y1), sx(r.x2), sy(r.y2), [60, 60, 60, 255]);
  }
  // Draw modules (darker boxes)
  for (const m of modules) {
    fillRect(rgb, W, H, sx(m.x1), sy(m.y1), sx(m.x2), sy(m.y2), [120, 92, 64, 255]);
    strokeRect(edge, W, H, sx(m.x1), sy(m.y1), sx(m.x2), sy(m.y2), [20, 20, 20, 255]);
  }
  // Draw openings as gaps (thin lighter lines)
  for (const o of openings) {
    fillRect(rgb, W, H, sx(o.x1), sy(o.y1), sx(o.x2), sy(o.y2), [250, 250, 250, 255]);
    strokeRect(edge, W, H, sx(o.x1), sy(o.y1), sx(o.x2), sy(o.y2), [0, 0, 0, 255]);
  }

  // Depth: normalize module distance from a virtual camera above scene center.
  const camX = (minX + maxX) / 2;
  const camY = (minY + maxY) / 2;
  const maxDist = Math.hypot(worldW, worldH) || 1;
  for (const m of modules) {
    const cx = (m.x1 + m.x2) / 2;
    const cy = (m.y1 + m.y2) / 2;
    const d = Math.hypot(cx - camX, cy - camY) / maxDist; // 0 center .. 1 far
    const shade = Math.round(255 * (1 - d));
    fillRect(depth, W, H, sx(m.x1), sy(m.y1), sx(m.x2), sy(m.y2), [shade, shade, shade, 255]);
  }

  const rgbPng = encodePng(W, H, rgb);
  const edgePng = encodePng(W, H, edge);
  const depthPng = encodePng(W, H, depth);

  // Per-module object masks
  const objectMasks = modules.map((m) => {
    const mask = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) { mask[i * 4 + 3] = 0; }
    fillRect(mask, W, H, sx(m.x1), sy(m.y1), sx(m.x2), sy(m.y2), [255, 255, 255, 255]);
    const png = encodePng(W, H, mask);
    return { id: m.id, url: dataUri(png), bytes: png.length };
  });

  // Per-material regions
  const byMaterial = new Map<string, SceneBox[]>();
  for (const m of modules) {
    if (!m.materialId) continue;
    if (!byMaterial.has(m.materialId)) byMaterial.set(m.materialId, []);
    byMaterial.get(m.materialId)!.push(m);
  }
  const materialRegions = Array.from(byMaterial.entries()).map(([materialId, ms]) => {
    const mask = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) { mask[i * 4 + 3] = 0; }
    for (const m of ms) fillRect(mask, W, H, sx(m.x1), sy(m.y1), sx(m.x2), sy(m.y2), [255, 255, 255, 255]);
    const png = encodePng(W, H, mask);
    return { materialId, url: dataUri(png), bytes: png.length };
  });

  const baseHash = createHash('sha256').update(rgbPng).digest('hex');
  return {
    rgb: { url: dataUri(rgbPng), bytes: rgbPng.length },
    edgeMap: { url: dataUri(edgePng), bytes: edgePng.length },
    objectMasks,
    materialRegions,
    depth: { url: dataUri(depthPng), bytes: depthPng.length },
    baseHash,
  };
}

function setPx(buf: Buffer, W: number, x: number, y: number, rgba: number[]) {
  if (x < 0 || y < 0 || x >= W || y >= buf.length / (W * 4)) return;
  const i = (y * W + x) * 4;
  buf[i] = rgba[0]; buf[i + 1] = rgba[1]; buf[i + 2] = rgba[2]; buf[i + 3] = rgba[3];
}

function fillRect(buf: Buffer, W: number, H: number, x1: number, y1: number, x2: number, y2: number, rgba: number[]) {
  const ix1 = Math.max(0, Math.floor(Math.min(x1, x2)));
  const iy1 = Math.max(0, Math.floor(Math.min(y1, y2)));
  const ix2 = Math.min(W - 1, Math.ceil(Math.max(x1, x2)));
  const iy2 = Math.min(H - 1, Math.ceil(Math.max(y1, y2)));
  for (let y = iy1; y <= iy2; y++) for (let x = ix1; x <= ix2; x++) setPx(buf, W, x, y, rgba);
}

function fillPolygon(buf: Buffer, W: number, H: number, points: readonly ProjectedPoint[], rgba: number[]) {
  if (points.length < 3) return;
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x))));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(...points.map((point) => point.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map((point) => point.y))));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointIsInsidePolygon(x + 0.5, y + 0.5, points)) setPx(buf, W, x, y, rgba);
    }
  }
}

function strokePolygon(buf: Buffer, W: number, H: number, points: readonly ProjectedPoint[], rgba: number[]) {
  for (let index = 0; index < points.length; index++) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (start && end) drawLine(buf, W, start, end, rgba);
  }
}

function drawLine(buf: Buffer, W: number, start: ProjectedPoint, end: ProjectedPoint, rgba: number[]) {
  const steps = Math.ceil(Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y), 1));
  for (let step = 0; step <= steps; step++) {
    const progress = step / steps;
    setPx(buf, W, Math.round(start.x + (end.x - start.x) * progress), Math.round(start.y + (end.y - start.y) * progress), rgba);
  }
}

function pointIsInsidePolygon(x: number, y: number, points: readonly ProjectedPoint[]): boolean {
  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
    const a = points[current];
    const b = points[previous];
    if (!a || !b) continue;
    const intersects = (a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function strokeRect(buf: Buffer, W: number, H: number, x1: number, y1: number, x2: number, y2: number, rgba: number[]) {
  const ix1 = Math.max(0, Math.floor(Math.min(x1, x2)));
  const iy1 = Math.max(0, Math.floor(Math.min(y1, y2)));
  const ix2 = Math.min(W - 1, Math.ceil(Math.max(x1, x2)));
  const iy2 = Math.min(H - 1, Math.ceil(Math.max(y1, y2)));
  for (let x = ix1; x <= ix2; x++) { setPx(buf, W, x, iy1, rgba); setPx(buf, W, x, iy2, rgba); }
  for (let y = iy1; y <= iy2; y++) { setPx(buf, W, ix1, y, rgba); setPx(buf, W, ix2, y, rgba); }
}

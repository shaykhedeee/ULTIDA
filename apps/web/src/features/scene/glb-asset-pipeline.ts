/**
 * @file glb-asset-pipeline.ts
 * Authoritative GLB / Digital-Twin asset validation, loading, dimensional scaling,
 * material slot binding, and caching engine for ULTIDA 3D scenes.
 */

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─── Constants & Guardrails ──────────────────────────────────────────────────
export const GLB_MAGIC_NUMBER = 0x46546c67; // "glTF" in little-endian
export const MAX_SAFE_POLYGONS = 65000;      // Hard upper threshold for WebGL performance
export const TARGET_LOD1_POLYGONS = 15000;   // Threshold between LOD0 (detailed) and LOD1 (optimized)
export const DIMENSION_TOLERANCE_MM = 5;     // ±5mm allowable discrepancy before flag
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

export type MaterialSlotName =
  | 'carcass'
  | 'shutter'
  | 'hardware'
  | 'countertop'
  | 'back-panel'
  | 'glass'
  | 'metal'
  | 'cushion'
  | 'lighting'
  | 'default';

export interface GlbValidationResult {
  valid: boolean;
  magicValid: boolean;
  version: number;
  byteLength: number;
  polyCount: number;
  meshCount: number;
  nodeCount: number;
  lodTier: 'lod0' | 'lod1' | 'exceeded';
  boundingBoxMm: {
    width: number;
    depth: number;
    height: number;
  };
  materialSlotNames: string[];
  recognizedSlots: MaterialSlotName[];
  warnings: string[];
  errors: string[];
}

export interface GlbInstantiationOptions {
  targetWidthMm: number;
  targetDepthMm: number;
  targetHeightMm: number;
  materialSlotOverrides?: Partial<Record<MaterialSlotName, THREE.Material>>;
  castShadow?: boolean;
  receiveShadow?: boolean;
  lodLevel?: 'lod0' | 'lod1';
}

export interface InstantiatedDigitalTwin {
  root: THREE.Group;
  metadata: GlbValidationResult;
  scaleFactors: { x: number; y: number; z: number };
  appliedSlots: MaterialSlotName[];
  isFallback: boolean;
}

// ─── Certified Catalog Digital Twin Map ─────────────────────────────────────
export interface DigitalTwinReferenceProfile {
  catalogId: string;
  family: string;
  displayName: string;
  nominalDimensionsMm: { width: number; depth: number; height: number };
  assetUrl?: string;
  modelSource: 'verified-glb' | 'parametric-reference';
  materialSlots: MaterialSlotName[];
}

// These are visualization profiles; current records intentionally do not claim
// that a GLB asset or a fabrication certification has been attached.
export const DIGITAL_TWIN_REFERENCE_PROFILES: Record<string, DigitalTwinReferenceProfile> = {
  'wardrobe-2door-1000': {
    catalogId: 'wardrobe-2door-1000',
    family: 'wardrobe',
    displayName: '1000mm 2-Door Hinged Master Wardrobe',
    nominalDimensionsMm: { width: 1000, depth: 600, height: 2400 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'hardware', 'back-panel'],
  },
  'wardrobe-3door-1500': {
    catalogId: 'wardrobe-3door-1500',
    family: 'wardrobe',
    displayName: '1500mm 3-Door Hinged Master Wardrobe with Drawers',
    nominalDimensionsMm: { width: 1500, depth: 600, height: 2400 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'hardware', 'back-panel'],
  },
  'kit-base-600': {
    catalogId: 'kit-base-600',
    family: 'kitchen-base',
    displayName: '600mm Kitchen Base Shutter Cabinet',
    nominalDimensionsMm: { width: 600, depth: 600, height: 750 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'],
  },
  'kit-base-tandem-2pot-600': {
    catalogId: 'kit-base-tandem-2pot-600',
    family: 'kitchen-base',
    displayName: '600mm Kitchen 2-Pot Deep Tandem Base',
    nominalDimensionsMm: { width: 600, depth: 600, height: 750 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'],
  },
  'kit-wall-600': {
    catalogId: 'kit-wall-600',
    family: 'kitchen-wall',
    displayName: '600mm Kitchen Overhead Wall Unit',
    nominalDimensionsMm: { width: 600, depth: 350, height: 720 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'hardware', 'glass'],
  },
  'tv-unit-floating-1800': {
    catalogId: 'tv-unit-floating-1800',
    family: 'tv-unit',
    displayName: '1800mm Floating Media Console & Fluted Backing',
    nominalDimensionsMm: { width: 1800, depth: 400, height: 450 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'back-panel', 'lighting'],
  },
  'pooja-mandir-mandapa-1500': {
    catalogId: 'pooja-mandir-mandapa-1500',
    family: 'pooja',
    displayName: '1500mm Teak Mandir with CNC Backlit Jaali',
    nominalDimensionsMm: { width: 1500, depth: 450, height: 2300 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'back-panel', 'metal', 'lighting'],
  },
  'study-1500': {
    catalogId: 'study-1500',
    family: 'study',
    displayName: '1500mm Study Desk with Overhead Storage',
    nominalDimensionsMm: { width: 1500, depth: 600, height: 2400 },
    modelSource: 'parametric-reference',
    materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware'],
  },
};

const MATERIAL_SLOT_KEYWORDS: Record<MaterialSlotName, RegExp> = {
  carcass: /carcass|gable|body|cabinet|inner|liner/i,
  shutter: /shutter|door|front|fascia|drawer/i,
  hardware: /handle|hinge|runner|channel|knob|profile|gola/i,
  countertop: /counter|top|slab|granite|quartz/i,
  'back-panel': /back|rear|jaali/i,
  glass: /glass|fluted|mirror/i,
  metal: /metal|steel|brass|gold|frame/i,
  cushion: /fabric|cushion|leather|boucle/i,
  lighting: /led|light|strip|neon/i,
  default: /default|mat/i,
};

export function inferMaterialSlot(name: string): MaterialSlotName | undefined {
  // Prefer specific surface slots before broad labels like "metal" or "default".
  const order: MaterialSlotName[] = ['countertop', 'back-panel', 'shutter', 'carcass', 'hardware', 'glass', 'cushion', 'lighting', 'metal', 'default'];
  return order.find((slot) => MATERIAL_SLOT_KEYWORDS[slot].test(name));
}

// ─── Binary GLB Header & Chunk Inspector ────────────────────────────────────
export function inspectGlbBuffer(buffer: ArrayBuffer): GlbValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (buffer.byteLength < 12) {
    return {
      valid: false,
      magicValid: false,
      version: 0,
      byteLength: buffer.byteLength,
      polyCount: 0,
      meshCount: 0,
      nodeCount: 0,
      lodTier: 'lod1',
      boundingBoxMm: { width: 0, depth: 0, height: 0 },
      materialSlotNames: [],
      recognizedSlots: [],
      warnings: [],
      errors: ['File is too small to be a valid GLB container (< 12 bytes).'],
    };
  }

  const dataView = new DataView(buffer);
  const magic = dataView.getUint32(0, true);
  const version = dataView.getUint32(4, true);
  const byteLength = dataView.getUint32(8, true);

  const magicValid = magic === GLB_MAGIC_NUMBER;
  if (!magicValid) {
    errors.push(`Invalid GLB magic header 0x${magic.toString(16).toUpperCase()} (expected 0x46546C67 "glTF").`);
  }
  if (version !== 2) errors.push(`Unsupported GLB container version ${version}; glTF 2 is required.`);
  if (byteLength !== buffer.byteLength) {
    errors.push(`Declared GLB byteLength (${byteLength}) does not match actual buffer size (${buffer.byteLength}).`);
  }

  let polyCount = 0;
  let meshCount = 0;
  let nodeCount = 0;
  let boundingBoxMm = { width: 0, depth: 0, height: 0 };
  const materialSlotNames: string[] = [];

  try {
    let offset = 12;
    let gltf: any;
    let chunkIndex = 0;
    let binChunkSeen = false;
    while (offset < buffer.byteLength) {
      if (offset + 8 > buffer.byteLength) throw new Error('GLB contains a truncated chunk header.');
      const chunkLength = dataView.getUint32(offset, true);
      const chunkType = dataView.getUint32(offset + 4, true);
      offset += 8;
      if (chunkLength === 0 || chunkLength % 4 !== 0 || offset + chunkLength > buffer.byteLength) {
        throw new Error('GLB contains an invalid or out-of-bounds chunk length.');
      }
      if (chunkIndex === 0 && chunkType !== JSON_CHUNK_TYPE) throw new Error('The first GLB chunk must contain JSON.');
      if (chunkType === JSON_CHUNK_TYPE) {
        if (chunkIndex !== 0 || gltf) throw new Error('GLB must contain exactly one JSON chunk in the first position.');
        const jsonBytes = new Uint8Array(buffer, offset, chunkLength);
        const jsonText = new TextDecoder('utf-8').decode(jsonBytes).trim().replace(/\0+$/, '');
        gltf = JSON.parse(jsonText);
      } else if (chunkType === BIN_CHUNK_TYPE) {
        if (chunkIndex !== 1 || binChunkSeen) throw new Error('GLB may contain at most one BIN chunk, immediately after JSON.');
        binChunkSeen = true;
      } else {
        throw new Error(`GLB contains unsupported chunk type 0x${chunkType.toString(16)}.`);
      }
      offset += chunkLength;
      chunkIndex += 1;
    }
    if (!gltf) throw new Error('GLB JSON chunk is missing.');
    if (gltf.asset?.version !== '2.0') throw new Error('GLB JSON must declare asset.version "2.0".');

    nodeCount = Array.isArray(gltf.nodes) ? gltf.nodes.length : 0;
    meshCount = Array.isArray(gltf.meshes) ? gltf.meshes.length : 0;

        // Discover material names and slot candidates
    if (Array.isArray(gltf.materials)) {
      for (const mat of gltf.materials) {
        if (mat?.name) materialSlotNames.push(String(mat.name));
      }
    }

    if (Array.isArray(gltf.meshes)) {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const mesh of gltf.meshes) {
        if (!Array.isArray(mesh.primitives) || mesh.primitives.length === 0) throw new Error('GLB mesh has no primitives.');
        for (const prim of mesh.primitives) {
          const positionIndex = prim.attributes?.POSITION;
          if (!Number.isInteger(positionIndex) || !gltf.accessors?.[positionIndex]) throw new Error('GLB primitive is missing a valid POSITION accessor.');
          const countAccessorIndex = prim.indices ?? positionIndex;
          const countAccessor = gltf.accessors?.[countAccessorIndex];
          if (!Number.isInteger(countAccessorIndex) || !countAccessor || !Number.isInteger(countAccessor.count) || countAccessor.count < 0) {
            throw new Error('GLB mesh references an invalid index or position accessor.');
          }
          const vertexCount = countAccessor.count;
          const mode = prim.mode ?? 4;
          if (mode === 4) polyCount += Math.floor(vertexCount / 3); // TRIANGLES
          else if (mode === 5 || mode === 6) polyCount += Math.max(0, vertexCount - 2); // strip/fan
          else if (![0, 1, 2, 3].includes(mode)) throw new Error(`GLB primitive has unsupported draw mode ${mode}.`);

          const positionAccessor = gltf.accessors[positionIndex];
          if (Array.isArray(positionAccessor?.min) && Array.isArray(positionAccessor?.max)
            && positionAccessor.min.length >= 3 && positionAccessor.max.length >= 3
            && [...positionAccessor.min.slice(0, 3), ...positionAccessor.max.slice(0, 3)].every(Number.isFinite)) {
            minX = Math.min(minX, positionAccessor.min[0]);
            minY = Math.min(minY, positionAccessor.min[1]);
            minZ = Math.min(minZ, positionAccessor.min[2]);
            maxX = Math.max(maxX, positionAccessor.max[0]);
            maxY = Math.max(maxY, positionAccessor.max[1]);
            maxZ = Math.max(maxZ, positionAccessor.max[2]);
          }
        }
      }

      if (Number.isFinite(minX) && Number.isFinite(maxX)) {
        const rawW = maxX - minX;
        const rawH = maxY - minY;
        const rawD = maxZ - minZ;
        const scaleToMm = rawW < 25 && rawH < 25 && rawD < 25 ? 1000 : 1;
        boundingBoxMm = {
          width: Math.round(rawW * scaleToMm),
          depth: Math.round(rawD * scaleToMm),
          height: Math.round(rawH * scaleToMm),
        };
        if ([rawW, rawH, rawD].some((dimension) => !Number.isFinite(dimension) || dimension <= 0)) {
          throw new Error('GLB position bounds must describe a non-zero three-dimensional asset.');
        }
      } else if (meshCount > 0) {
        throw new Error('GLB mesh POSITION accessors must include finite min/max bounds for dimensional validation.');
      }
    }
  } catch (err: any) {
    errors.push(`GLB validation failed: ${err?.message || 'unknown error'}`);
  }

  // Polygon guardrails
  if (polyCount > MAX_SAFE_POLYGONS) {
    errors.push(`Polygon count (${polyCount.toLocaleString()} triangles) exceeds the ${MAX_SAFE_POLYGONS.toLocaleString()}-triangle asset limit.`);
  }

  const lodTier: 'lod0' | 'lod1' | 'exceeded' =
    polyCount > MAX_SAFE_POLYGONS ? 'exceeded' : polyCount > TARGET_LOD1_POLYGONS ? 'lod0' : 'lod1';

  // Recognize semantic material slots
  const recognizedSlots: MaterialSlotName[] = [];
  for (const name of materialSlotNames) {
    const slot = inferMaterialSlot(name);
    if (slot && !recognizedSlots.includes(slot)) recognizedSlots.push(slot);
  }

  return {
    valid: errors.length === 0,
    magicValid,
    version,
    byteLength: buffer.byteLength,
    polyCount,
    meshCount,
    nodeCount,
    lodTier,
    boundingBoxMm,
    materialSlotNames,
    recognizedSlots,
    warnings,
    errors,
  };
}

// ─── GLB Asset Loader & Pipeline Service ─────────────────────────────────────
class GlbAssetPipelineService {
  private loader: GLTFLoader;
  private cache = new Map<string, { gltf: GLTF; metadata: GlbValidationResult; timestamp: number }>();
  private pendingRequests = new Map<string, Promise<{ gltf: GLTF; metadata: GlbValidationResult }>>();

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Fetches, inspects, and parses a GLB asset with memory caching.
   */
  async loadAsset(url: string): Promise<{ gltf: GLTF; metadata: GlbValidationResult }> {
    // 1. Check in-memory cache
    const cached = this.cache.get(url);
    if (cached) {
      return { gltf: cached.gltf, metadata: cached.metadata };
    }

    // 2. Deduplicate concurrent requests
    const pending = this.pendingRequests.get(url);
    if (pending) return pending;

    const requestPromise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch GLB from ${url}: HTTP ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // 3. Inspect binary metadata & validate guardrails
        const metadata = inspectGlbBuffer(arrayBuffer);
        if (!metadata.valid) {
          throw new Error(`GLB asset validation failed: ${metadata.errors.join('; ')}`);
        }

        // 4. Parse GLTF scene via Three.js loader
        const gltf = await new Promise<GLTF>((resolve, reject) => {
          this.loader.parse(
            arrayBuffer,
            url,
            (parsedGltf) => resolve(parsedGltf),
            (err) => reject(err)
          );
        });

        // 5. Store in cache
        const result = { gltf, metadata, timestamp: Date.now() };
        this.cache.set(url, result);
        return result;
      } finally {
        this.pendingRequests.delete(url);
      }
    })();

    this.pendingRequests.set(url, requestPromise);
    return requestPromise;
  }

  /**
   * Instantiates a calibrated digital twin object from a loaded GLB,
   * scaling it to match the precise parametric module dimensions (mm)
   * and dynamically binding material slot overrides.
   */
  instantiateModel(
    gltf: GLTF,
    metadata: GlbValidationResult,
    options: GlbInstantiationOptions
  ): InstantiatedDigitalTwin {
    // Clone scene to allow multiple independent instances
    const root = gltf.scene.clone(true);

    // Compute bounding box
    root.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(root);
    const size = bbox.getSize(new THREE.Vector3());

    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;

    if (size.x > 0 && size.y > 0 && size.z > 0) {
      scaleX = options.targetWidthMm / size.x;
      scaleY = options.targetHeightMm / size.y;
      scaleZ = options.targetDepthMm / size.z;
      root.scale.set(scaleX, scaleY, scaleZ);

      // Re-center so origin is at bottom-center of the module
      const center = bbox.getCenter(new THREE.Vector3());
      root.position.set(-center.x * scaleX, -bbox.min.y * scaleY, -center.z * scaleZ);
    }

    const appliedSlots: MaterialSlotName[] = [];

    // Traverse and apply shadows, material slot bindings
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = options.castShadow ?? true;
        mesh.receiveShadow = options.receiveShadow ?? true;

        if (options.materialSlotOverrides) {
          const meshSlot = inferMaterialSlot(mesh.name);
          const replaceMaterial = (original: THREE.Material) => {
            const slot = inferMaterialSlot(original.name) ?? meshSlot;
            const override = slot ? options.materialSlotOverrides?.[slot] : undefined;
            if (!slot || !override) return original;
            if (!appliedSlots.includes(slot)) appliedSlots.push(slot);
            return override;
          };
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(replaceMaterial)
            : replaceMaterial(mesh.material);
        }
      }
    });

    return {
      root,
      metadata,
      scaleFactors: { x: scaleX, y: scaleY, z: scaleZ },
      appliedSlots,
      isFallback: false,
    };
  }

  /**
   * Generates a high-precision parametric manufactured proxy box as safe fallback
   * whenever a GLB model fails to load or is unassigned.
   */
  createParametricProxy(
    options: GlbInstantiationOptions,
    family = 'carcass'
  ): InstantiatedDigitalTwin {
    const group = new THREE.Group();
    const w = options.targetWidthMm;
    const h = options.targetHeightMm;
    const d = options.targetDepthMm;

    const baseColor =
      family.includes('kitchen') ? '#2e3a4e' :
      family.includes('wardrobe') ? '#3a2e26' :
      family.includes('tv') ? '#1e2430' : '#475569';

    const mat = options.materialSlotOverrides?.carcass ??
      new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.5,
        metalness: 0.1,
      });

    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const boxMesh = new THREE.Mesh(boxGeo, mat);
    boxMesh.castShadow = options.castShadow ?? true;
    boxMesh.receiveShadow = options.receiveShadow ?? true;
    boxMesh.position.set(0, h / 2, 0);
    group.add(boxMesh);

    // Subtle edge highlight to show manufacturing precision
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 });
    const edgeLines = new THREE.LineSegments(edges, lineMat);
    edgeLines.position.set(0, h / 2, 0);
    group.add(edgeLines);

    return {
      root: group,
      metadata: {
        valid: true,
        magicValid: true,
        version: 2,
        byteLength: 0,
        polyCount: 12,
        meshCount: 1,
        nodeCount: 1,
        lodTier: 'lod1',
        boundingBoxMm: { width: w, depth: d, height: h },
        materialSlotNames: ['carcass'],
        recognizedSlots: ['carcass'],
        warnings: ['Using parametric manufacturing proxy fallback; real GLB geometry not loaded.'],
        errors: [],
      },
      scaleFactors: { x: 1, y: 1, z: 1 },
      appliedSlots: ['carcass'],
      isFallback: true,
    };
  }

  /**
   * High-level helper: Loads and instantiates a digital twin or falls back smoothly.
   */
  async loadOrFallback(
    glbUrl: string | undefined,
    options: GlbInstantiationOptions,
    family = 'carcass'
  ): Promise<InstantiatedDigitalTwin> {
    if (!glbUrl) {
      return this.createParametricProxy(options, family);
    }
    try {
      const { gltf, metadata } = await this.loadAsset(glbUrl);
      return this.instantiateModel(gltf, metadata, options);
    } catch (err: any) {
      console.warn(`[GlbAssetPipeline] Could not instantiate GLB for ${glbUrl}. Retaining parametric proxy:`, err);
      return this.createParametricProxy(options, family);
    }
  }

  /**
   * Clears the asset cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton export
export const glbAssetPipeline = new GlbAssetPipelineService();

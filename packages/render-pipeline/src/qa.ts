/**
 * render-pipeline — deterministic render QA rules.
 *
 * QA compares the GEOMETRY-LOCKED expectations (from the approved scene + base
 * render) against what was actually produced. Every rule is deterministic and
 * inspectable; a photoreal render may NEVER be returned if blocking QA fails.
 */

import { RenderQAResultSchema } from './schema.js';
import type { RenderQAResult } from './schema.js';

export interface SceneExpectation {
  wallCount: number;
  doorCount: number;
  windowCount: number;
  moduleCount: number;
  cabinetDivisions: number; // expected shutter/drawer divisions across cabinetry
  skirtingCount: number;
  camera: { positionMm: [number, number, number]; targetMm: [number, number, number]; fovDeg: number };
  expectedObjectIds: string[]; // modules + fixtures that MUST appear
  materialRegionIds: string[]; // material ids that must have a region
}

export interface MeasuredResult {
  // What the QA vision/measurement pass actually found in the enhanced image.
  wallEdgesAligned: boolean; // walls align to base render within tolerance
  openingCountMatches: boolean; // doors+windows count equals expectation
  measuredDoorCount?: number;
  measuredWindowCount?: number;
  /** Projected opening outlines (including sill and head) align with the approved scene. */
  openingGeometryAligned?: boolean;
  focalModuleVisible: boolean;
  cameraSimilarityMm: number; // how far the rendered camera deviates from expected (mm)
  measuredObjectIds: string[]; // objects detected in the output
  measuredMaterialRegionIds: string[];
  cabinetDivisionCount?: number;
  measuredSkirtingCount?: number;
  /** Projected skirting bands align with the approved floor surface perimeter. */
  skirtingGeometryAligned?: boolean;
  inventedObjectLabels?: string[]; // labels the model added that were not in the scene
}

export interface QAIssue {
  kind: string;
  message: string;
  severity: 'blocking' | 'warning';
}

/**
 * Run the QA rule set. Returns a validated RenderQAResult. `geometryLock` tightens
 * tolerances: 'strict' turns deviations into blocking issues; 'creative' allows warnings.
 */
export function runRenderQA(
  expectation: SceneExpectation,
  measured: MeasuredResult,
  geometryLock: 'strict' | 'moderate' | 'creative' = 'strict'
): RenderQAResult {
  const issues: QAIssue[] = [];
  const sev = (blocking: boolean): 'blocking' | 'warning' => (blocking && geometryLock === 'strict' ? 'blocking' : 'warning');

  // 1. Wall boundaries
  if (!measured.wallEdgesAligned) {
    issues.push({ kind: 'wall_boundaries', message: 'Wall boundaries in the render do not align with the locked base geometry.', severity: sev(true) });
  }
  // 2. Doors
  if (measured.measuredDoorCount != null && measured.measuredDoorCount !== expectation.doorCount) {
    issues.push({ kind: 'doors', message: `Door count mismatch: expected ${expectation.doorCount}, found ${measured.measuredDoorCount}.`, severity: sev(true) });
  }
  // 3. Windows
  if (measured.measuredWindowCount != null && measured.measuredWindowCount !== expectation.windowCount) {
    issues.push({ kind: 'windows', message: `Window count mismatch: expected ${expectation.windowCount}, found ${measured.measuredWindowCount}.`, severity: sev(true) });
  }
  // 4. Module boxes
  if (measured.measuredObjectIds.length < expectation.expectedObjectIds.length) {
    issues.push({ kind: 'module_boxes', message: `Module count low: expected ${expectation.expectedObjectIds.length}, found ${measured.measuredObjectIds.length}.`, severity: sev(true) });
  }
  // 5. Cabinet divisions
  if (measured.cabinetDivisionCount != null && measured.cabinetDivisionCount !== expectation.cabinetDivisions) {
    issues.push({ kind: 'cabinet_divisions', message: `Cabinet divisions mismatch: expected ${expectation.cabinetDivisions}, found ${measured.cabinetDivisionCount}.`, severity: sev(false) });
  }
  if (measured.openingGeometryAligned === false) {
    issues.push({ kind: 'opening_geometry', message: 'Opening position, sill height, or head height does not align with the approved scene geometry.', severity: sev(true) });
  }
  if (measured.measuredSkirtingCount != null && measured.measuredSkirtingCount !== expectation.skirtingCount) {
    issues.push({ kind: 'skirting', message: `Skirting count mismatch: expected ${expectation.skirtingCount}, found ${measured.measuredSkirtingCount}.`, severity: sev(true) });
  }
  if (measured.skirtingGeometryAligned === false) {
    issues.push({ kind: 'skirting_geometry', message: 'Skirting geometry does not align with the approved floor perimeter and doorway exclusions.', severity: sev(true) });
  }
  // 6. Camera
  if (measured.cameraSimilarityMm > (geometryLock === 'strict' ? 50 : 300)) {
    issues.push({ kind: 'camera', message: `Camera deviates ${measured.cameraSimilarityMm.toFixed(0)}mm from the locked camera.`, severity: sev(true) });
  }
  // 7. Missing objects
  const missing = expectation.expectedObjectIds.filter((id) => !measured.measuredObjectIds.includes(id));
  if (missing.length) {
    issues.push({ kind: 'missing_objects', message: `Missing objects: ${missing.join(', ')}.`, severity: sev(true) });
  }
  // 8. Invented objects
  const invented = (measured.inventedObjectLabels ?? []).filter(Boolean);
  if (invented.length) {
    issues.push({ kind: 'invented_objects', message: `Model invented unrequested objects: ${invented.join(', ')}.`, severity: sev(true) });
  }
  // 9. Material regions
  const missingMat = expectation.materialRegionIds.filter((id) => !measured.measuredMaterialRegionIds.includes(id));
  if (missingMat.length) {
    issues.push({ kind: 'material_regions', message: `Missing material regions: ${missingMat.join(', ')}.`, severity: sev(false) });
  }

  const result: RenderQAResult = {
    issues: issues.map((i) => ({ kind: i.kind, message: i.message, severity: i.severity })),
    wallEdgesAligned: measured.wallEdgesAligned,
    openingCountMatches: measured.openingCountMatches,
    focalModuleVisible: measured.focalModuleVisible,
    cameraSimilarityMm: measured.cameraSimilarityMm,
    inventedObjectsDetected: (measured.inventedObjectLabels ?? []).length > 0,
    missingObjects: missing,
  };
  return RenderQAResultSchema.parse(result);
}


/**
 * Approximate CIEDE2000 Delta E calculation between two RGB colors (0-255).
 * Research implementation based on Mervecaliskann/interior-render-preservation.
 * Ensures material preservation (floor/laminate) during inpainting and AI rendering.
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rL = r / 255, gL = g / 255, bL = b / 255;
  rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
  gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
  bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

  const x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) * 100;
  const y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) * 100;
  const z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) * 100;

  const xr = x / 95.047, yr = y / 100.0, zr = z / 108.883;
  const fx = xr > 0.008856 ? Math.cbrt(xr) : (7.787 * xr) + 16 / 116;
  const fy = yr > 0.008856 ? Math.cbrt(yr) : (7.787 * yr) + 16 / 116;
  const fz = zr > 0.008856 ? Math.cbrt(zr) : (7.787 * zr) + 16 / 116;

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE00(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const dL = L2 - L1;
  const c1 = Math.sqrt(a1 * a1 + b1 * b1);
  const c2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.sqrt(a1p * a1p + b1 * b1);
  const c2p = Math.sqrt(a2p * a2p + b2 * b2);
  const dCp = c2p - c1p;
  return Math.sqrt(dL * dL + dCp * dCp);
}

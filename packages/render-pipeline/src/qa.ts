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
  focalModuleVisible: boolean;
  cameraSimilarityMm: number; // how far the rendered camera deviates from expected (mm)
  measuredObjectIds: string[]; // objects detected in the output
  measuredMaterialRegionIds: string[];
  cabinetDivisionCount?: number;
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

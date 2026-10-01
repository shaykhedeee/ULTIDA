import type { SceneV1 } from './scene-types.js';
import { generateSceneFabricationElevationSvg, type ElevationCutlistPart } from './scene-elevation-renderer.js';

export interface ShopDrawingOptions {
  viewMode?: 'external' | 'internal' | 'both' | 'shop-sheet' | 'fabrication';
  unitTitle?: string;
  clientName?: string;
  projectName?: string;
  designerName?: string;
  checkedBy?: string;
  sheetDate?: string;
  sheetCode?: string;
  sheetNumber?: string;
  carcassCoreMaterial?: string;
  baseDepthMm?: number;
  wallDepthMm?: number;
  loftDepthMm?: number;
  laminateA?: string;
  laminateB?: string;
  internalFinish?: string;
  includeTopView?: boolean;
  provenance?: string;
  measurementStatus?: 'measured' | 'derived' | 'reference' | 'unverified';
  revision?: string;
  selectedModuleId?: string;
  materialSwatches?: Record<string, string>;
  activeWallName?: string;
  studioName?: string;
  /** Exact certified panel rows from the same production snapshot as nesting/workbook output. */
  productionParts?: ElevationCutlistPart[];
}

/**
 * Shared elevation entry point. Every mode is drawn from persisted scene parts;
 * unsupported dimensions are never inferred from the module family.
 */
export function generateArchitecturalShopSheetSvg(
  scene: SceneV1,
  targetWallIdOrModuleId?: string,
  options: ShopDrawingOptions = {},
): string {
  return generateSceneFabricationElevationSvg(scene, targetWallIdOrModuleId, options);
}

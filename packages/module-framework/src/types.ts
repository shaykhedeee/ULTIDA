import { z } from 'zod';

export type SemanticType =
  | 'carcass'
  | 'shutter'
  | 'drawer'
  | 'shelf'
  | 'filler'
  | 'back_panel'
  | 'profile'
  | 'glass'
  | 'lighting_channel'
  | 'hardware';

export type CategoryType =
  | 'tv_unit'
  | 'wardrobe'
  | 'crockery_unit'
  | 'study_unit'
  | 'pooja_unit'
  | 'kitchen'
  | 'bed'
  | 'utility';

export type TvUnitFamily =
  | 'minimal_floating'
  | 'full_wall_storage'
  | 'asymmetric_profile_glass'
  | 'tv_plus_partition'
  | 'tv_plus_study'
  | 'tv_plus_crockery'
  | 'curved_contemporary'
  | 'french_beading_panel';

export type LayoutShape = 'straight' | 'l-shape' | 'u-shape' | 'island';
export type AnchorFace = 'left' | 'right' | 'top' | 'bottom' | 'back' | 'front' | 'center';

export interface Point2D { xMm: number; yMm: number; }
export interface Size2D { widthMm: number; depthMm: number; heightMm: number; }
export interface Transform { xMm: number; yMm: number; zMm: number; rotationDeg: number; }

export interface MaterialSlot { id: string; code: string; name: string; }
export interface PartDrawing { layer: string; sortOrder: number; }
export interface PartBom { sku: string; qty: number; unit: string; lengthMm?: number; widthMm?: number; heightMm?: number; thicknessMm?: number; }
export interface PartMeta { semanticType: SemanticType; parentId: string | null; materialSlot: MaterialSlot; drawing: PartDrawing; bom: PartBom; }

export interface Part {
  id: string;
  templateVersionId: string;
  instanceId?: string;
  name: string;
  transform: Transform;
  size: Size2D;
  anchor: { wallId?: string; face: AnchorFace; offsetMm?: number };
  meta: PartMeta;
}

export interface HardRule { code: string; severity: 'blocking' | 'warning'; description: string; }
export interface SoftRule { code: string; severity: 'suggestion'; description: string; }

export interface ModuleTemplateVersion {
  id: string;
  templateId: string;
  category: CategoryType;
  family: TvUnitFamily | string;
  name: string;
  version: string;
  applicableSpaceTypes: string[];
  applicableLayoutShapes: LayoutShape[];
  minDimensions: Size2D;
  maxDimensions: Size2D;
  defaultParameters: Record<string, unknown>;
  componentHierarchy: string[];
  anchors: Record<string, unknown>;
  hardRules: HardRule[];
  softRules: SoftRule[];
  compatibleMaterials: MaterialSlot[];
  drawingInstructions: string[];
  bomFormulas: string[];
}

export interface TvUnitParameters {
  wallWidthMm: number;
  wallHeightMm: number;
  tvSizeInches?: number;
  layoutShape?: LayoutShape;
  totalWidthMm: number;
  totalDepthMm: number;
  totalHeightMm: number;
  baseType?: 'floating' | 'floor_standing' | 'legs';
  floorClearanceMm?: number;
  backPanelSize?: { widthMm: number; heightMm: number };
  tallUnitSide?: 'none' | 'left' | 'right';
  tallUnitWidthMm?: number;
  overheadStorage?: boolean;
  profileGlassOption?: boolean;
  shelfOption?: boolean;
  lighting?: 'none' | 'profile_led' | 'spotlight' | 'both';
  materialZones?: { carcass?: string; shutters?: string; backPanel?: string };
  deviceStorage?: boolean;
  wiringRoute?: boolean;
  carcassThicknessMm?: number;
  shutterThicknessMm?: number;
  backPanelThicknessMm?: number;
  fingerGrooveGapMm?: number;
  shutterCount?: number;
  loftFillerMm?: number;
}

export interface TemplateCompileInput {
  templateVersionId: string;
  parameters: TvUnitParameters | Record<string, unknown>;
  wall: { widthMm: number; heightMm: number; depthMm: number; id?: string };
  instanceId?: string;
}

export interface TemplateCompileResult {
  templateVersionId: string;
  instanceId: string;
  valid: boolean;
  blockingViolations: string[];
  warningViolations: string[];
  parts: Part[];
}

export interface ModuleTemplateRecord { id: string; name: string; category: CategoryType; versions: ModuleTemplateVersion[]; }
export interface ModuleInstanceRecord { id: string; projectId: string; spaceId: string; templateId: string; templateVersionId: string; parameters: Record<string, unknown>; position: Transform; status: 'draft'|'configured'|'validated'|'approved'; validationResult?: TemplateCompileResult; createdBy: string; }
export interface ModuleRuleRecord { id: string; category: CategoryType; name: string; code: string; severity: 'blocking'|'warning'|'suggestion'; expression: string; }
export interface ModuleViolationRecord { id: string; instanceId: string; ruleCode: string; severity: 'blocking'|'warning'; message: string; suggestion: string; }

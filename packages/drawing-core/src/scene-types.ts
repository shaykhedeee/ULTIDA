export type ScenePointMm = { xMm: number; yMm: number };

export type SceneWallV1 = {
  id: string;
  floorId?: string;
  start: ScenePointMm;
  end: ScenePointMm;
  thicknessMm?: number;
  heightMm?: number;
  baseElevationMm?: number;
  spaceIds?: string[];
  confidence?: number;
};

export type SceneOpeningV1 = {
  id: string;
  wallId: string;
  kind: 'door' | 'window' | 'passage' | string;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  sillHeightMm?: number;
  sillMm?: number;
  confidence?: number;
};

export type SceneModuleV1 = {
  id: string;
  roomId?: string;
  spaceId?: string;
  family: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  position: ScenePointMm & { zMm?: number };
  rotationDeg?: number;
  anchor?: 'floor' | 'wall' | 'ceiling' | 'free' | string;
  materialId?: string;
  confidence?: number;
};

export type SceneModulePartV1 = {
  id: string;
  moduleId: string;
  roomId?: string;
  semanticType?: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  position: { xMm: number; yMm: number; zMm?: number };
  rotationDeg?: number;
  materialId?: string;
  confidence?: number;
};

export type SceneRoomV1 = {
  id: string;
  spaceId?: string;
  name?: string;
  type?: string;
  boundary: ScenePointMm[];
  confidence?: number;
};

export type SceneMetadataV1 = {
  branch?: string;
  status: 'draft' | 'review' | 'approved' | 'locked' | 'superseded' | string;
  changeReason?: string;
  schemaVersion?: string;
  designVersion: string;
};

export type SceneV1 = {
  schema?: 'scene.v1' | string;
  units?: 'mm' | string;
  coordinateSystem?: string;
  projectId: string;
  floorPlanVersionId: string;
  floors?: Array<{ id: string; name: string; elevationMm?: number; heightMm?: number }>;
  spaces?: Array<{ id: string; floorId?: string; name: string; type: string }>;
  rooms?: SceneRoomV1[];
  walls: SceneWallV1[];
  openings?: SceneOpeningV1[];
  fixedFixtures?: Array<{ id: string; spaceId?: string; kind: string; anchor: ScenePointMm; widthMm: number; depthMm: number }>;
  modules: SceneModuleV1[];
  moduleParts?: SceneModulePartV1[];
  compositions?: any[];
  materials?: Array<{ id: string; name: string; code: string; unitCost?: number; finish?: string }>;
  lighting?: any[];
  cameras?: any[];
  constraints?: any[];
  unresolvedDetections?: any[];
  metadata: SceneMetadataV1;
};

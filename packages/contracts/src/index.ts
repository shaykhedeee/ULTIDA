import { z } from 'zod';

export const VisualOperationSchema = z.enum(['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance']);
export const VisualProposalRequestSchema = z.object({
  projectId: z.string().min(1),
  sceneVersionId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(160).optional(),
  roomId: z.string().min(1),
  sourceAssets: z.array(z.string()).min(1),
  referenceAssets: z.array(z.string()).default([]),
  masks: z.array(z.string()).default([]),
  operation: VisualOperationSchema,
  style: z.string().min(1).max(120),
  structuredPrompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional(),
  promptVersion: z.string().min(1).max(80).optional(),
  quality: z.enum(['draft', 'review', 'final']).default('review'),
  camera: z.object({ view: z.enum(['eye-level', 'wide-corner', 'elevation', 'detail']), lensMm: z.number().min(12).max(100), eyeHeightMm: z.number().min(600).max(2400) }).optional(),
  conditioningMaps: z.object({
    depthMapUrl: z.string().optional(),
    cannyEdgeMapUrl: z.string().optional(),
    materialKeyMapUrl: z.string().optional(),
    normalMapUrl: z.string().optional()
  }).optional(),
  providerPreference: z.array(z.string()).default([])
});

export type VisualProposalRequest = z.infer<typeof VisualProposalRequestSchema>;

export const JobStatusSchema = z.enum(['queued', 'validating', 'running', 'persisting', 'succeeded', 'failed', 'cancelled']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const ProviderRunSchema = z.object({
  provider: z.string(),
  model: z.string(),
  status: z.enum(['succeeded', 'failed']),
  latencyMs: z.number(),
  error: z.string().optional()
});
export type ProviderRun = z.infer<typeof ProviderRunSchema>;

export const PlanAnalysisJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceAssetId: z.string(),
  idempotencyKey: z.string().optional(),
  status: JobStatusSchema,
  stage: z.string(),
  actorId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.string().optional()
});
export type PlanAnalysisJob = z.infer<typeof PlanAnalysisJobSchema>;

export const ReviewedPlanInterpretationSchema = z.object({
  version: z.number().int().positive(),
  approvedAt: z.string(),
  trustedDimensionMm: z.number().positive().nullable(),
  proposals: z.array(z.record(z.unknown())),
  calibratedSpace: z.object({
    widthMm: z.number().positive(),
    depthMm: z.number().positive(),
    heightMm: z.number().positive()
  })
});
export type ReviewedPlanInterpretation = z.infer<typeof ReviewedPlanInterpretationSchema>;

export const RenderBriefSchema = z.object({
  sceneVersionId: z.string(),
  roomId: z.string(),
  roomType: z.string(),
  style: z.string(),
  dimensionsMm: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive()
  }),
  camera: z.object({
    view: z.enum(['eye-level', 'wide-corner', 'elevation', 'detail']),
    lensMm: z.number(),
    eyeHeightMm: z.number()
  }),
  materials: z.array(z.object({ key: z.string(), label: z.string() })),
  structuredPrompt: z.string(),
  negativePrompt: z.string(),
  quality: z.enum(['draft', 'review', 'final'])
});
export type RenderBrief = z.infer<typeof RenderBriefSchema>;

export const StoredRenderArtifactSchema = z.object({
  artifactId: z.string(),
  assetId: z.string(),
  storagePath: z.string(),
  signedUrl: z.string(),
  mimeType: z.string(),
  createdAt: z.string(),
  reviewStatus: z.enum(['pending', 'approved', 'rejected'])
});
export type StoredRenderArtifact = z.infer<typeof StoredRenderArtifactSchema>;

export const ProviderCapabilityStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  configured: z.boolean(),
  operations: z.array(VisualOperationSchema),
  details: z.string().optional()
});
export type ProviderCapabilityStatus = z.infer<typeof ProviderCapabilityStatusSchema>;

export const FloorPlanInitiateRequestSchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().positive()
});
export type FloorPlanInitiateRequest = z.infer<typeof FloorPlanInitiateRequestSchema>;

export const FloorPlanCompleteRequestSchema = z.object({
  projectId: z.string().min(1),
  assetId: z.string().min(1),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1)
});
export type FloorPlanCompleteRequest = z.infer<typeof FloorPlanCompleteRequestSchema>;

export const FloorPlanApproveRequestSchema = z.object({
  projectId: z.string().min(1),
  floorPlanVersionId: z.string().optional(),
  canonicalModel: z.record(z.unknown()),
  reviewerNotes: z.string().optional()
});
export type FloorPlanApproveRequest = z.infer<typeof FloorPlanApproveRequestSchema>;

export const AiRunAuditSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  assetHash: z.string(),
  latencyMs: z.number(),
  tokenUsage: z.object({ promptTokens: z.number().optional(), completionTokens: z.number().optional() }).optional(),
  status: z.enum(['succeeded', 'failed']),
  outputHash: z.string(),
  createdAt: z.string()
});
export type AiRunAudit = z.infer<typeof AiRunAuditSchema>;

export const JobV1Schema = z.object({
  id: z.string().uuid(),
  kind: z.string().min(1),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  availableAt: z.string(),
  lockedAt: z.string().nullable(),
  lockedBy: z.string().nullable(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean().optional() }).nullable()
});
export type JobV1 = z.infer<typeof JobV1Schema>;

const SourcePointSchema = z.object({ x: z.number(), y: z.number() });
const WorldPointSchema = z.object({ xMm: z.number(), yMm: z.number() });

export const PlanAnalysisResultV1Schema = z.object({
  analysisVersion: z.string(),
  provider: z.string(),
  source: z.object({ fileName: z.string(), mimeType: z.string(), checksumSha256: z.string() }),
  proposals: z.array(z.object({
    id: z.string(), kind: z.string(), confidence: z.number().min(0).max(1),
    status: z.enum(['proposed', 'needs_review', 'accepted', 'rejected']),
    geometry: z.record(z.unknown()), note: z.string()
  })),
  providerRuns: z.array(ProviderRunSchema),
  topologyIssues: z.array(z.object({ code: z.string(), severity: z.enum(['warning', 'critical']), message: z.string(), entityId: z.string().optional() }))
});
export type PlanAnalysisResultV1 = z.infer<typeof PlanAnalysisResultV1Schema>;

export const CanonicalPlanV1Schema = z.object({
  schemaVersion: z.literal('plan.v1'),
  units: z.literal('mm'),
  coordinateSystem: z.string(),
  scale: z.object({ pointA: SourcePointSchema, pointB: SourcePointSchema, pixelDistance: z.number().positive(), realDistanceMm: z.number().positive(), mmPerPixel: z.number().positive() }),
  ceilingHeightMm: z.number().positive(),
  walls: z.array(z.object({ id: z.string(), sourceGeometry: z.record(z.unknown()), worldGeometry: z.object({ start: WorldPointSchema, end: WorldPointSchema }) }).passthrough()),
  rooms: z.array(z.object({ id: z.string(), sourceGeometry: z.record(z.unknown()), worldGeometry: z.object({ polygon: z.array(WorldPointSchema).min(3) }), areaSqm: z.number().nonnegative() }).passthrough()),
  openings: z.array(z.object({ id: z.string(), wallId: z.string(), offsetAlongWallMm: z.number().nonnegative() }).passthrough()),
  unresolvedItems: z.array(z.unknown())
}).passthrough();
export type CanonicalPlanV1 = z.infer<typeof CanonicalPlanV1Schema>;

// ─── Phase 3: Space Requirement sub-schemas by room type ──────────────────────

export const LivingRequirementsV1Schema = z.object({
  seatingCount: z.number().int().positive().optional(),
  tvSizeInch: z.number().int().positive().optional(),
  poojaUnit: z.boolean().default(false),
  displayCabinet: z.boolean().default(false),
  studyNook: z.boolean().default(false),
  partition: z.boolean().default(false),
  crockeryUnit: z.boolean().default(false),
}).partial();

export const BedroomRequirementsV1Schema = z.object({
  bedSize: z.enum(['single', 'double', 'queen', 'king']).optional(),
  wardrobeType: z.enum(['sliding', 'hinged', 'walk_in', 'none']).optional(),
  dresser: z.boolean().default(false),
  studyTable: z.boolean().default(false),
  tv: z.boolean().default(false),
  sideTables: z.enum(['none', 'one', 'two']).default('two'),
  overheadStorage: z.boolean().default(false),
}).partial();

export const KitchenRequirementsV1Schema = z.object({
  shape: z.enum(['single_wall', 'parallel', 'l_shaped', 'u_shaped', 'island', 'peninsula']).optional(),
  hob: z.enum(['2_burner', '3_burner', '4_burner', '5_burner', 'induction']).optional(),
  chimney: z.boolean().default(true),
  fridge: z.enum(['none', 'top_mount', 'bottom_mount', 'side_by_side']).optional(),
  microwave: z.boolean().default(false),
  dishwasher: z.boolean().default(false),
  sinkType: z.enum(['single', 'double', 'undermount']).optional(),
  pantryUnit: z.boolean().default(false),
  utilityArea: z.boolean().default(false),
}).partial();

export const StudyRequirementsV1Schema = z.object({
  seatingCount: z.number().int().min(1).max(6).default(1),
  bookshelves: z.boolean().default(false),
  printer: z.boolean().default(false),
  monitor: z.enum(['none', 'single', 'dual']).default('single'),
  fileStorage: z.boolean().default(false),
}).partial();

export const PoojaRequirementsV1Schema = z.object({
  mandapType: z.enum(['wall_niche', 'freestanding', 'cabinet', 'full_unit']).optional(),
  idolCount: z.number().int().min(1).max(20).optional(),
  divyaSthan: z.boolean().default(false),
  storageBelow: z.boolean().default(true),
}).partial();

export const UtilityRequirementsV1Schema = z.object({
  washingMachine: z.boolean().default(false),
  dryer: z.boolean().default(false),
  ironingStation: z.boolean().default(false),
  mopSink: z.boolean().default(false),
  storageCabinet: z.boolean().default(false),
}).partial();

export const DiningRequirementsV1Schema = z.object({
  seatingCount: z.number().int().min(2).max(12).default(4),
  crockeryUnit: z.boolean().default(false),
  barUnit: z.boolean().default(false),
  buffetCounter: z.boolean().default(false),
}).partial();

export const SpaceRequirementsV1Schema = z.object({
  projectId: z.string().min(1),
  spaceId: z.string().min(1),
  floorPlanVersionId: z.string().min(1),
  roomType: z.enum(['living', 'master_bedroom', 'bedroom', 'kitchen', 'study', 'pooja', 'utility', 'dining', 'bathroom', 'balcony', 'other']),
  name: z.string().max(80).optional(),
  ceilingHeightMm: z.number().int().positive().optional(),
  falseCeilingType: z.string().max(60).default(''),
  floorFinish: z.string().max(60).default(''),
  wallFinish: z.string().max(60).default(''),
  existingFixedItems: z.array(z.string()).default([]),
  designPriority: z.enum(['basic', 'standard', 'premium', 'luxury']).default('standard'),
  stylePreference: z.string().max(120).default(''),
  budgetAllocationInr: z.number().nonnegative().default(0),
  requiredModularCategories: z.array(z.string()).default([]),
  // Room-type specific sub-requirements
  living: LivingRequirementsV1Schema.optional(),
  bedroom: BedroomRequirementsV1Schema.optional(),
  kitchen: KitchenRequirementsV1Schema.optional(),
  study: StudyRequirementsV1Schema.optional(),
  pooja: PoojaRequirementsV1Schema.optional(),
  utility: UtilityRequirementsV1Schema.optional(),
  dining: DiningRequirementsV1Schema.optional(),
  savedAt: z.string().optional(),
});
export type SpaceRequirementsV1 = z.infer<typeof SpaceRequirementsV1Schema>;

// ─── Space Geometry (derived from canonical plan.v1) ──────────────────────────
export const SpaceGeometryV1Schema = z.object({
  spaceId: z.string().min(1),
  floorPlanVersionId: z.string().min(1),
  areaSqm: z.number().nonnegative(),
  perimeterMm: z.number().nonnegative(),
  boundingBox: z.object({ widthMm: z.number(), depthMm: z.number() }),
  ceilingHeightMm: z.number().positive(),
  usableWalls: z.array(z.object({
    id: z.string(),
    lengthMm: z.number().positive(),
    openings: z.array(z.object({ id: z.string(), kind: z.enum(['door', 'window']), widthMm: z.number() })),
    isExterior: z.boolean(),
  })),
  obstacles: z.array(z.object({ id: z.string(), kind: z.string(), positionMm: z.object({ xMm: z.number(), yMm: z.number() }) })),
  services: z.array(z.object({ id: z.string(), kind: z.enum(['plumbing', 'electrical', 'gas', 'drain']), positionMm: z.object({ xMm: z.number(), yMm: z.number() }) })),
  derivedAt: z.string(),
});
export type SpaceGeometryV1 = z.infer<typeof SpaceGeometryV1Schema>;

// ─── Space Readiness Gate ────────────────────────────────────────────────────
export const SpaceReadinessV1Schema = z.object({
  spaceId: z.string().min(1),
  geometryVerified: z.boolean(),
  heightKnown: z.boolean(),
  requirementsSaved: z.boolean(),
  noBlockingPlanIssues: z.boolean(),
  ready: z.boolean(),
  blockingReasons: z.array(z.string()),
});
export type SpaceReadinessV1 = z.infer<typeof SpaceReadinessV1Schema>;

// ─── Workflow Status V1 ────────────────────────────────────────────────────────
export const WorkflowStatusV1Schema = z.object({
  projectId: z.string().min(1),
  stage: z.enum(['brief', 'floor_plan', 'spaces', 'layout', 'modules', '3d_scene', 'render', 'production']),
  status: z.enum(['not_started', 'in_progress', 'blocked', 'complete', 'locked']),
  lockReason: z.string().nullable(),
  issueCount: z.number().int().nonnegative(),
  activeVersionId: z.string().nullable(),
  isStale: z.boolean(),
  unlocksStage: z.string().nullable(),
  updatedAt: z.string(),
});
export type WorkflowStatusV1 = z.infer<typeof WorkflowStatusV1Schema>;

// ─── Provider Capability V1 ────────────────────────────────────────────────────
export const ProviderCapabilityV1Schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  configured: z.boolean(),
  // Operations must reflect ACTUAL model capability — text-to-image ≠ image editing
  operations: z.array(z.enum(['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance', 'vision-analysis'])),
  supportsImageInput: z.boolean(),
  supportsImageOutput: z.boolean(),
  modelId: z.string().optional(),
});
export type ProviderCapabilityV1 = z.infer<typeof ProviderCapabilityV1Schema>;

export { StageNameSchema, StageStatusSchema, type StageName, type StageStatus, StageStateSchema, type StageState, WorkflowStatusResponseSchema, type WorkflowStatusResponse } from './stage-types.js';
export { StageNameSchema as ProjectStageNameSchema, StageStatusSchema as ProjectStageStatusSchema, StageStateSchema as ProjectStageStateSchema, type StageName as ProjectStageName, type StageStatus as ProjectStageStatus, type StageState as ProjectStageState, WorkflowStatusResponseSchema as ProjectWorkflowStatusResponseSchema, type WorkflowStatusResponse as ProjectWorkflowStatusResponse } from './stage-types.js';


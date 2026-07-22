import { z } from 'zod';

export const CandidateTypeSchema = z.enum(['maximum_storage', 'best_circulation', 'balanced', 'cost_efficient']);
export const RenderTypeSchema = z.enum(['technical_preview', 'material_preview', 'concept_render', 'photoreal_render']);
export const GeometryLockSchema = z.enum(['strict', 'moderate', 'creative']).default('strict');
export const RoomCategorySchema = z.enum(['kitchen', 'tv_unit', 'wardrobe', 'living', 'bedroom', 'other']);
export const KitchenShapeSchema = z.enum(['single_wall', 'parallel', 'l_shaped', 'u_shaped', 'peninsula', 'island', 'g_shaped']);
export const TvUnitShapeSchema = z.enum(['linear', 'floating', 'full_wall', 'asymmetrical', 'l_shaped', 'partition', 'tv_plus_study', 'tv_plus_crockery']);
export const WardrobeShapeSchema = z.enum(['linear', 'l_shaped', 'walk_in', 'wardrobe_plus_dresser', 'wardrobe_plus_study', 'wardrobe_plus_tv']);
export const LivingShapeSchema = z.enum(['tv_opposite_sofa', 'tv_adjacent_entrance', 'l_seating', 'parallel_seating', 'open_living_dining', 'partition_layout']);
export const BedroomShapeSchema = z.enum(['bed_centred', 'side_wall_bed', 'wardrobe_opposite_bed', 'wardrobe_near_entrance', 'study_near_window']);
export const PlacementAnchorSchema = z.enum(['wall', 'room', 'corner']);

export const PlacementSchema = z.object({
  id: z.string().min(1),
  category: RoomCategorySchema,
  templateFamily: z.string().min(1),
  anchor: PlacementAnchorSchema.default('wall'),
  wallRef: z.string().optional(),
  positionMm: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotationYawDeg: z.number().default(0),
  widthMm: z.number().positive(),
  depthMm: z.number().positive(),
  heightMm: z.number().positive(),
  clearanceMm: z.number().nonnegative().default(0),
  requiredServicePoints: z.array(z.string()).default([]),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const ValidationIssueSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['blocking', 'warning']),
  message: z.string().min(1),
  entityIds: z.array(z.string()).default([]),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(ValidationIssueSchema),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const CandidateScoreSchema = z.object({
  validity: z.number().min(0).max(1),
  storage: z.number().min(0).max(1),
  circulation: z.number().min(0).max(1),
  symmetry: z.number().min(0).max(1),
  manufacturingSimplicity: z.number().min(0).max(1),
  cost: z.number().min(0).max(1),
  userPriority: z.number().min(0).max(1),
  weighted: z.number().min(0).max(1),
});
export type CandidateScore = z.infer<typeof CandidateScoreSchema>;

export const LayoutCandidateSchema = z.object({
  id: z.string().min(1),
  category: RoomCategorySchema,
  shape: z.string().min(1),
  candidateType: CandidateTypeSchema,
  placements: z.array(PlacementSchema).min(1),
  validation: ValidationResultSchema,
  score: CandidateScoreSchema,
});
export type LayoutCandidate = z.infer<typeof LayoutCandidateSchema>;

export const LayoutVersionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  spaceId: z.string().min(1),
  floorPlanVersionId: z.string().min(1),
  shape: z.string().min(1),
  candidateType: CandidateTypeSchema,
  placements: z.array(PlacementSchema),
  validation: ValidationResultSchema,
  score: CandidateScoreSchema,
  active: z.boolean().default(false),
  approvedAt: z.string().optional(),
  invalidatedBy: z.string().optional(),
  parentVersionId: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().default(new Date().toISOString()),
  updatedAt: z.string().default(new Date().toISOString()),
});
export type LayoutVersion = z.infer<typeof LayoutVersionSchema>;

export const InvalidationTargetSchema = z.enum(['modules', 'scene', 'render', 'drawing', 'estimate']);
export const InvalidationEventSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sourceLayoutVersionId: z.string().min(1),
  targets: z.array(InvalidationTargetSchema).min(1),
  reason: z.string().min(1),
  invalidatedAt: z.string().default(new Date().toISOString()),
});
export type InvalidationEvent = z.infer<typeof InvalidationEventSchema>;

export const LayoutInputSchema = z.object({
  projectId: z.string().min(1),
  spaceId: z.string().min(1),
  roomCategory: RoomCategorySchema,
  floorPlanVersionId: z.string().min(1),
  shape: z.string().min(1),
  candidateTypes: z.array(CandidateTypeSchema).default(['balanced']),
  requirements: z.record(z.unknown()),
  roomBoundingBoxMm: z.object({ minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number() }),
  usableWalls: z.array(z.object({ id: z.string(), minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number(), orientation: z.enum(['north','south','east','west']).optional() })).default([]),
  openings: z.array(z.object({ id: z.string(), type: z.enum(['door','window']), xMm: z.number(), yMm: z.number(), widthMm: z.number(), heightMm: z.number(), swingDeg: z.number().optional() })).default([]),
  servicePoints: z.array(z.object({ id: z.string(), xMm: z.number(), yMm: z.number(), type: z.string() })).default([]),
  structuralElements: z.array(z.object({ id: z.string(), type: z.string(), xMm: z.number(), yMm: z.number(), widthMm: z.number(), depthMm: z.number() })).default([]),
  companyRules: z.record(z.unknown()).default({}),
});
export type LayoutInput = z.infer<typeof LayoutInputSchema>;

export const LayoutApprovalSchema = z.object({
  projectId: z.string().min(1),
  spaceId: z.string().min(1),
  candidateId: z.string().min(1),
  floorPlanVersionId: z.string().min(1),
  invalidateDownstream: z.array(InvalidationTargetSchema).default(['modules', 'scene', 'render', 'drawing', 'estimate']),
  userId: z.string().optional(),
});
export type LayoutApproval = z.infer<typeof LayoutApprovalSchema>;

export type ShapeCatalog = Record<string, Array<{ id: string; label: string; sub?: string }>>;

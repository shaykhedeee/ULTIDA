import { z } from 'zod';

export const SourceTypeSchema = z.enum(['raster_image','pdf_raster','pdf_vector','dxf','svg','manual']);
export const ScaleResolutionSchema = z.enum(['native_vector_units','verified_dimension','multiple_dimensions','scale_annotation','two_point_calibration','inferred_manual']);
export const PlanStateSchema = z.enum(['uploaded','queued','extracting','interpreting','validation_required','designer_review','approved','failed']);
export const VerificationStateSchema = z.enum(['unverified','partial','verified','assumed']);
export const WallTypeSchema = z.enum(['load_bearing','partition','curtain','retaining','shaft','stair']);
export const OpeningKindSchema = z.enum(['door','window','passage','louver','curtain_wall','shaft']);
export const HingeSideSchema = z.enum(['left','right','top','bottom','pivot']);
export const DoorSwingSchema = z.enum(['single_inward','single_outward','double_inward','double_outward','sliding','folding','recessed']);
export const WindowTypeSchema = z.enum(['sliding','casement','fixed','louvered','curtain_wall','skylight']);
export const RoomTypeSchema = z.enum(['living','bedroom','kitchen','utility','toilet','bath','balcony','pooja','study','dining','foyer','store','parking','staircase','lift','lobby','courtyard','servant','other']);
export const IssueCodeSchema = z.enum(['invalid_scale','open_room_boundary','overlapping_rooms','invalid_wall_intersections','opening_outside_wall','zero_length_wall','missing_wall_height','dimension_conflict','unsupported_geometry','uncertain_room_type']);

export const ScaleObservationSchema = z.object({
  id: z.string().uuid(),
  label: z.string().optional(),
  pointA: z.object({ xMm: z.number(), yMm: z.number() }),
  pointB: z.object({ xMm: z.number(), yMm: z.number() }),
  realMm: z.number().positive(),
  inferredMm: z.number().nonnegative(),
  verifiedDimensionMm: z.number().positive().optional(),
  scaleObservedMm: z.number().positive().optional(),
  observation: z.string().optional(),
  method: ScaleResolutionSchema,
  verified: z.boolean().default(false),
});

export const IssueActionSchema = z.object({
  id: z.string().uuid(),
  code: IssueCodeSchema,
  message: z.string().min(1),
  severity: z.enum(['warning','critical']),
  entityIds: z.array(z.string()).default([]),
  suggestionA: z.string().optional(),
  suggestionB: z.string().optional(),
  dismissedReason: z.string().optional(),
  resolved: z.boolean().default(false),
  selectedOption: z.enum(['auto','A','B','manual']).optional(),
  manualValue: z.unknown().optional(),
});

export const PlanSourceSchema = z.object({
  schemaVersion: z.literal('plan.v1'),
  sourceAssetId: z.string().uuid(),
  sourceType: SourceTypeSchema,
  sourceWidth: z.number().positive(),
  sourceHeight: z.number().positive(),
  sourceRotation: z.number().default(0),
  coordinateSystem: z.literal('millimetres').default('millimetres'),
  scaleResolution: ScaleResolutionSchema,
  mmPerPixel: z.number().positive().optional(),
  verifiedDimensionMm: z.number().positive().optional(),
  scaleObservations: z.array(ScaleObservationSchema).default([]),
  scaleObservedMm: z.number().positive().optional(),
});

export const PlanValidationSchema = z.object({
  isValid: z.boolean(),
  blockingIssueCount: z.number().int().nonnegative(),
  issues: z.array(IssueActionSchema).default([]),
  failedAt: z.string().optional(),
  ruleVersion: z.string().optional(),
});

export const ApprovalMetaSchema = z.object({
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().datetime().optional(),
  priorVersionId: z.string().uuid().optional(),
  changeReason: z.string().optional(),
  reviewerNote: z.string().optional(),
  calibrationNote: z.string().optional(),
});

export const PlanSpaceSchema = z.object({
  id: z.string().uuid(),
  sourcePolygon: z.array(z.object({ x: z.number(), y: z.number() })),
  worldPolygon: z.array(z.object({ xMm: z.number(), yMm: z.number() })).optional(),
  roomType: RoomTypeSchema,
  roomName: z.string().optional(),
  areaSqm: z.number().nonnegative().optional(),
  areaMm2: z.number().nonnegative().optional(),
  ceilingHeightMm: z.number().positive().default(2700),
  wallRefs: z.array(z.string()).default([]),
  openingRefs: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  verification: VerificationStateSchema.default('unverified'),
});

export const PlanWallSchema = z.object({
  id: z.string().uuid(),
  sourceStart: z.object({ x: z.number(), y: z.number() }),
  sourceEnd: z.object({ x: z.number(), y: z.number() }),
  worldStart: z.object({ xMm: z.number(), yMm: z.number() }),
  worldEnd: z.object({ xMm: z.number(), yMm: z.number() }),
  lengthMm: z.number().nonnegative().optional(),
  thicknessMm: z.number().nonnegative().optional(),
  heightMm: z.number().nonnegative().optional(),
  interiorNormal: z.object({ x: z.number(), y: z.number() }).optional(),
  adjacentSpaces: z.array(z.string()).default([]),
  wallType: WallTypeSchema.optional(),
  verification: VerificationStateSchema.default('unverified'),
  confidence: z.number().min(0).max(1).optional(),
});

export const DoorOpeningSchema = z.object({
  id: z.string().uuid(),
  wallId: z.string().uuid(),
  offsetMm: z.number().nonnegative(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  sillMm: z.number().nonnegative().optional(),
  headMm: z.number().positive().optional(),
  hingeSide: HingeSideSchema.optional(),
  swing: DoorSwingSchema.optional(),
  type: z.string().optional(),
  verification: VerificationStateSchema.default('unverified'),
  confidence: z.number().min(0).max(1).optional(),
});

export const WindowOpeningSchema = z.object({
  id: z.string().uuid(),
  wallId: z.string().uuid(),
  offsetMm: z.number().nonnegative(),
  widthMm: z.number().positive(),
  sillMm: z.number().nonnegative(),
  headMm: z.number().positive(),
  type: WindowTypeSchema.optional(),
  verification: VerificationStateSchema.default('unverified'),
  confidence: z.number().min(0).max(1).optional(),
});

export const OpeningSchema = z.union([DoorOpeningSchema, WindowOpeningSchema]);

export const ColumnSchema = z.object({
  id: z.string().uuid(),
  center: z.object({ xMm: z.number(), yMm: z.number() }),
  sizeMm: z.object({ width: z.number().positive(), depth: z.number().positive() }).optional(),
  confidence: z.number().min(0).max(1).optional(),
  verification: VerificationStateSchema.default('unverified'),
});

export const BeamSchema = z.object({
  id: z.string().uuid(),
  start: z.object({ xMm: z.number(), yMm: z.number() }),
  end: z.object({ xMm: z.number(), yMm: z.number() }),
  heightMm: z.number().positive().optional(),
  widthMm: z.number().positive().optional(),
  confidence: z.number().min(0).max(1).optional(),
  verification: VerificationStateSchema.default('unverified'),
});

export const ServicePointSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['plumbing_in','plumbing_out','electrical','hvac','gas','data']),
  position: z.object({ xMm: z.number(), yMm: z.number() }),
  confidence: z.number().min(0).max(1).optional(),
  verification: VerificationStateSchema.default('unverified'),
});

export const AnnotationSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  position: z.object({ xMm: z.number(), yMm: z.number() }).optional(),
  kind: z.enum(['note','dimension','room_label','warn']).default('note'),
});

export const CanonicalPlanModelSchema = z.object({
  schemaVersion: z.literal('plan.v1'),
  source: PlanSourceSchema,
  state: PlanStateSchema.default('designer_review'),
  scale: ScaleObservationSchema.optional(),
  ceilingHeightMm: z.number().positive().default(2700),
  spaces: z.array(PlanSpaceSchema).default([]),
  walls: z.array(PlanWallSchema).default([]),
  openings: z.array(OpeningSchema).default([]),
  columns: z.array(ColumnSchema).default([]),
  beams: z.array(BeamSchema).default([]),
  servicePoints: z.array(ServicePointSchema).default([]),
  annotations: z.array(AnnotationSchema).default([]),
  issues: z.array(IssueActionSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  validation: PlanValidationSchema,
  approval: ApprovalMetaSchema.optional(),
});

export type CanonicalPlanModel = z.infer<typeof CanonicalPlanModelSchema>;

export const PlanValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(['warning','critical']),
  entityId: z.string().optional(),
  message: z.string().min(1),
});

export type PlanValidationIssue = z.infer<typeof PlanValidationIssueSchema>;

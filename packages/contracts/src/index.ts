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

export type ProviderStatus = {
  id: string;
  configured: boolean;
  operations: Array<z.infer<typeof VisualOperationSchema>>;
};

export { StageNameSchema, StageStatusSchema, type StageName, type StageStatus, StageStateSchema, type StageState, WorkflowStatusResponseSchema, type WorkflowStatusResponse } from './stage-types.js';
export { StageNameSchema as ProjectStageNameSchema, StageStatusSchema as ProjectStageStatusSchema, StageStateSchema as ProjectStageStateSchema, type StageName as ProjectStageName, type StageStatus as ProjectStageStatus, type StageState as ProjectStageState, WorkflowStatusResponseSchema as ProjectWorkflowStatusResponseSchema, type WorkflowStatusResponse as ProjectWorkflowStatusResponse } from './stage-types.js';

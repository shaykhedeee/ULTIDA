import { z } from 'zod';

export const StageNameSchema = z.enum([
  'brief',
  'plan',
  'spaces',
  'layouts',
  'modules',
  'materials',
  'three_d',
  'renders',
  'drawings',
  'estimate',
  'presentation',
]);

export const StageStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'review_required',
  'blocked',
  'complete',
  'failed',
]);

export type StageName = z.infer<typeof StageNameSchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;

export const StageStateSchema = z.object({
  stage: StageNameSchema,
  status: StageStatusSchema,
  completed: z.boolean(),
  lockReason: z.string().optional(),
  blockingIssueCount: z.number().int().nonnegative(),
  latestVersionId: z.string().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type StageState = z.infer<typeof StageStateSchema>;

export const WorkflowStatusResponseSchema = z.object({
  success: z.literal(true),
  projectId: z.string(),
  stages: z.array(StageStateSchema),
});

export type WorkflowStatusResponse = z.infer<typeof WorkflowStatusResponseSchema>;

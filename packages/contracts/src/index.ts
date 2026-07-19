import { z } from 'zod';

export const VisualOperationSchema = z.enum(['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance']);
export const VisualProposalRequestSchema = z.object({
  projectId: z.string().min(1),
  sceneVersionId: z.string().uuid(),
  roomId: z.string().min(1),
  sourceAssets: z.array(z.string()).min(1),
  referenceAssets: z.array(z.string()).default([]),
  masks: z.array(z.string()).default([]),
  operation: VisualOperationSchema,
  style: z.string().min(1).max(120),
  structuredPrompt: z.string().min(1).max(4000),
  providerPreference: z.array(z.string()).default([])
});

export type VisualProposalRequest = z.infer<typeof VisualProposalRequestSchema>;

export type ProviderStatus = {
  id: string;
  configured: boolean;
  operations: Array<z.infer<typeof VisualOperationSchema>>;
};

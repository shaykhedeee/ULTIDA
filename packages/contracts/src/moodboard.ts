import { z } from 'zod';

export const MoodboardCardSchema = z.object({
  id: z.string().min(1).max(200), kind: z.enum(['material', 'image', 'note']),
  materialId: z.string().uuid().optional(), assetId: z.string().uuid().optional(),
  title: z.string().max(200).default(''), note: z.string().max(2000).default(''),
  x: z.number().finite().min(0).max(1600), y: z.number().finite().min(0).max(1600),
  width: z.number().finite().min(100).max(1600), height: z.number().finite().min(100).max(1600),
}).strict().superRefine((card, ctx) => {
  if (card.kind === 'material' && !card.materialId) ctx.addIssue({ code: 'custom', message: 'Material cards require a saved material identity.' });
  if (card.kind === 'image' && !card.assetId) ctx.addIssue({ code: 'custom', message: 'Image cards require a saved project asset.' });
});
export const MoodboardDocumentSchema = z.object({
  schema: z.literal('ultida.moodboard.v1'), projectId: z.string().min(1).max(100), roomId: z.string().min(1).max(100),
  sceneVersionId: z.string().uuid().nullable(), sourceFingerprint: z.string().min(1).max(128),
  title: z.string().min(1).max(200), notes: z.string().max(5000).default(''),
  template: z.enum(['editorial', 'grid', 'studio']),
  canvas: z.object({ width: z.number().int().min(600).max(1600), height: z.number().int().min(600).max(1600), background: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).strict(),
  cards: z.array(MoodboardCardSchema).max(80),
}).strict().superRefine((board, ctx) => {
  const ids = new Set<string>();
  for (const card of board.cards) {
    if (ids.has(card.id)) ctx.addIssue({ code: 'custom', message: 'Card identities must be unique.' });
    ids.add(card.id);
    if (card.x + card.width > board.canvas.width || card.y + card.height > board.canvas.height) ctx.addIssue({ code: 'custom', message: 'Cards must stay inside the board.' });
  }
});
export const MoodboardSaveSchema = z.object({ expectedRevision: z.number().int().min(0), document: MoodboardDocumentSchema }).strict();
export type MoodboardDocument = z.infer<typeof MoodboardDocumentSchema>;
export type MoodboardCard = z.infer<typeof MoodboardCardSchema>;

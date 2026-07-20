import { z } from 'zod';

export const ProposalKindSchema = z.enum(['wall', 'opening', 'room', 'dimension']);
export const PlanProposalSchema = z.object({
  id: z.string(), kind: ProposalKindSchema, confidence: z.number().min(0).max(1), source: z.enum(['detector', 'ocr', 'manual']), status: z.enum(['proposed', 'accepted', 'rejected', 'needs_review']), geometry: z.record(z.number()), note: z.string()
});
export type PlanProposal = z.infer<typeof PlanProposalSchema>;

export type DetectorInput = { projectId: string; fileName: string; mimeType: string; bytes: number; width?: number; height?: number };

function proposal(kind: PlanProposal['kind'], geometry: Record<string, number>, confidence: number, note: string): PlanProposal {
  return { id: crypto.randomUUID(), kind, confidence, source: 'detector', status: confidence >= 0.85 ? 'proposed' : 'needs_review', geometry, note };
}

// This is a safe baseline detector contract. It creates reviewable candidates
// from source dimensions while the optional CV/OCR worker is unavailable.
// It must never be treated as measured truth or auto-approved geometry.
export function createBaselineProposals(input: DetectorInput): PlanProposal[] {
  const width = input.width ?? 1000; const height = input.height ?? 1000;
  return [
    proposal('wall', { x1: width * .1, y1: height * .1, x2: width * .9, y2: height * .1 }, .42, 'Baseline horizontal boundary candidate; confirm against the source.'),
    proposal('wall', { x1: width * .1, y1: height * .1, x2: width * .1, y2: height * .9 }, .42, 'Baseline vertical boundary candidate; confirm against the source.'),
    proposal('room', { x: width * .1, y: height * .1, width: width * .8, height: height * .8 }, .25, 'Placeholder room envelope from source bounds; name and resize during review.'),
    proposal('opening', { x: width * .5, y: height * .1, width: width * .1, kind: 0 }, .18, 'Opening candidate requires visual confirmation; 0 means door, 1 means window.'),
    proposal('dimension', { x1: width * .1, y1: height * .95, x2: width * .9, y2: height * .95, valueMm: 0 }, .1, 'OCR dimension unavailable; enter a trusted value before approval.')
  ];
}

import { createBaselineProposals, type DetectorInput } from '@ultida/plan-core';

export function detectPlanJob(input: DetectorInput) {
  return { kind: 'plan-detection', status: 'review_required' as const, source: 'baseline-detector', proposals: createBaselineProposals(input) };
}

console.log('ULTIDA detector worker ready; proposals remain review_required until accepted by a designer.');

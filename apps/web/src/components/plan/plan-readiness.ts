export type PlanReviewElement = { kind: string; status: string; isAnalysisGuide?: boolean };
export type ReadinessStage = 'import' | 'calibrate' | 'detect' | 'review' | 'approve';
export type ReadinessState = 'complete' | 'current' | 'blocked' | 'upcoming';
export type PlanReadinessInput = {
  hasSource: boolean;
  analysed: boolean;
  scaleMmPerPixel: number | null | undefined;
  elements: PlanReviewElement[];
  unresolvedIssueCount: number;
  calibrationDriftCount: number;
  mode: 'initial_design' | 'final_production';
  canApproveFromExistingChecks: boolean;
};
export type PlanReadiness = {
  active: ReadinessStage;
  stages: Array<{ id: ReadinessStage; label: string; state: ReadinessState; explanation: string }>;
  canReleaseForProduction: boolean;
  needsReview: number;
  nextAction: string;
};
/** Presentation-level progress summary. This NEVER grants plan approval by itself. */
export function assessPlanReadiness(input: PlanReadinessInput): PlanReadiness {
  const hasScale = Number.isFinite(input.scaleMmPerPixel) && Number(input.scaleMmPerPixel) > 0;
  const realElements = input.elements.filter(e => !e.isAnalysisGuide && e.status !== 'rejected');
  const needsReview = realElements.filter(e => e.status !== 'accepted').length;
  const hasGeometry = realElements.some(e => e.kind === 'wall' || e.kind === 'room');
  const analyzedOrTraced = input.analysed || hasGeometry;
  const productionBlockers = needsReview + Math.max(0, input.unresolvedIssueCount) + Math.max(0, input.calibrationDriftCount);
  const evidenceReviewed = hasGeometry && (input.mode !== 'final_production' || productionBlockers === 0);
  const canReleaseForProduction = Boolean(input.hasSource && hasScale && evidenceReviewed && input.mode === 'final_production' && input.canApproveFromExistingChecks && productionBlockers === 0);
  const stages: PlanReadiness['stages'] = [
    {id:'import',label:'Import',state:'upcoming',explanation:'Upload a source plan or use an explicitly identified manual drawing.'},
    {id:'calibrate',label:'Calibrate',state:'upcoming',explanation:'Mark two points on a known length. Check a second dimension independently.'},
    {id:'detect',label:'Detect',state:'upcoming',explanation:'Run AI-assisted detection or use manually traced geometry.'},
    {id:'review',label:'Review',state:'upcoming',explanation:'Inspect walls, openings, uncertain entities and scale drift.'},
    {id:'approve',label:'Approve',state:'upcoming',explanation:'Approve only when the existing workspace checks permit it.'},
  ];
  const complete = [input.hasSource, hasScale, analyzedOrTraced, evidenceReviewed, input.canApproveFromExistingChecks && evidenceReviewed];
  const firstIncomplete = complete.findIndex(done => !done);
  const activeIndex = firstIncomplete === -1 ? 4 : firstIncomplete;
  for (let i = 0; i < stages.length; i++) {
    stages[i].state = i < activeIndex ? 'complete' : i === activeIndex ? 'current' : 'upcoming';
  }
  if (hasScale && input.calibrationDriftCount > 0 && input.mode === 'final_production') {
    stages[1].state = 'blocked';
    stages[1].explanation = `${input.calibrationDriftCount} conflicting measured dimension(s); resolve before production approval.`;
  }
  if (input.mode === 'final_production' && needsReview + input.unresolvedIssueCount > 0) {
    stages[3].state = 'blocked';
    stages[3].explanation = `${needsReview} unaccepted element(s), ${input.unresolvedIssueCount} unresolved question(s).`;
  }
  return {
    active: stages[activeIndex].id,
    stages,
    canReleaseForProduction,
    needsReview,
    nextAction: !input.hasSource ? 'Upload a plan or begin a manual drawing'
      : !hasScale ? 'Calibrate a clearly marked known length'
      : !analyzedOrTraced ? 'Detect or trace the rooms and walls'
      : input.calibrationDriftCount > 0 ? 'Review conflicting printed dimensions'
      : needsReview > 0 ? `Review ${needsReview} proposed element${needsReview === 1 ? '' : 's'}`
      : input.unresolvedIssueCount > 0 ? 'Resolve uncertainty in the review queue'
      : !input.canApproveFromExistingChecks ? 'Complete geometric and opening checks'
      : 'Ready for designer approval',
  };
}

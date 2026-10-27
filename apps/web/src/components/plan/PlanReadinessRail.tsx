import { Check, AlertTriangle, ArrowRight, Crosshair, Layers } from 'lucide-react';
import { assessPlanReadiness, type PlanReadinessInput } from './plan-readiness';
import './plan-readiness-rail.css';

type Props = PlanReadinessInput & {
  onCalibrate: () => void;
  onExtract: () => void;
  onReview: () => void;
};

export default function PlanReadinessRail(props: Props) {
  const readiness = assessPlanReadiness(props);
  const hasScale = Number(props.scaleMmPerPixel) > 0 && Number.isFinite(Number(props.scaleMmPerPixel));
  return (
    <section className="ultida-plan-rail" aria-label="Floor plan completion guide">
      <div className="ultida-plan-rail-top">
        <div>
          <p className="ultida-plan-eyebrow">MEASURED DESIGN · GUIDED WORKFLOW</p>
          <h2>From uploaded plan to trusted geometry</h2>
          <p className="ultida-plan-subtitle">AI proposals are suggestions. Measurements and production require designer-verified evidence.</p>
        </div>
        <div className={`ultida-plan-scale-chip ${hasScale ? 'is-calibrated' : 'needs-calibration'}`} role="status">
          {hasScale ? <Check size={15}/> : <AlertTriangle size={15}/>}
          <span>{hasScale ? `${Number(props.scaleMmPerPixel).toFixed(3)} mm/px · Scale set` : 'Scale unconfirmed'}</span>
        </div>
      </div>
      <ol className="ultida-plan-steps">
        {readiness.stages.map((stage, index) => (
          <li key={stage.id} className={`ultida-plan-step is-${stage.state}`} title={stage.explanation} aria-current={stage.state === 'current' ? 'step' : undefined}>
            <span className="ultida-plan-step-mark">{stage.state === 'complete' ? <Check size={13}/> : stage.state === 'blocked' ? '!' : index + 1}</span>
            <span>{stage.label}</span>
          </li>
        ))}
      </ol>
      <div className="ultida-plan-rail-bottom">
        <div className="ultida-plan-next" role="status">
          <span>Next action</span>
          <strong>{readiness.nextAction}</strong>
          {props.calibrationDriftCount > 0 && <small>{props.calibrationDriftCount} dimension cross-check conflict(s). Do not release unverified geometry.</small>}
        </div>
        <div className="ultida-plan-rail-actions">
          <button type="button" onClick={props.onCalibrate} disabled={!props.hasSource && props.elements.length === 0}><Crosshair size={15}/> {hasScale ? 'Recalibrate' : 'Set scale'}</button>
          <button type="button" onClick={props.onExtract}><Layers size={15}/> Detect</button>
          <button type="button" onClick={props.onReview}>Review geometry <ArrowRight size={15}/></button>
        </div>
      </div>
    </section>
  );
}

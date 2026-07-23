import React from 'react';
import './ProvenanceBadge.css';

type ProvenanceState = 'source' | 'unreviewed' | 'verified' | 'stale';

type Props = {
  provider?: string;
  model?: string;
  sceneVersionId?: string;
  approvalState?: string;
  state?: ProvenanceState;
};

const stateLabel: Record<ProvenanceState, string> = {
  source: 'Source evidence',
  unreviewed: 'Awaiting review',
  verified: 'Verified',
  stale: 'Superseded',
};

export function ProvenanceBadge({ provider, model, sceneVersionId, approvalState, state = 'verified' }: Props) {
  return (
    <span className="provenance-badge" data-state={state} title={`${stateLabel[state]}${provider ? ` · ${provider}` : ''}${model ? ` · ${model}` : ''}`}>
      <span className="provenance-dot" />
      <span className="provenance-label">{approvalState ?? stateLabel[state]}</span>
      {sceneVersionId ? <span className="provenance-mono">{sceneVersionId}</span> : null}
    </span>
  );
}

export default ProvenanceBadge;

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAuraAuditEvent,
  validateAuraAuditEvent,
  validateAuraAuditTransition,
  type AuraAuditEvent,
} from '../src/audit.js';

function created(): AuraAuditEvent {
  return createAuraAuditEvent({
    projectId: 'project-1', actorId: 'designer-1', toolId: 'generate_tv_unit',
    eventType: 'proposal_created', sourceVersionId: 'scene-1', proposalId: 'proposal-1',
    payload: { proposal: { widthMm: 1800 } },
  });
}

test('creates and validates an audit event with stable context', () => {
  const event = created();
  assert.ok(event.id);
  assert.ok(event.createdAt);
  assert.equal(validateAuraAuditEvent(event).proposalId, 'proposal-1');
});

test('rejects malformed audit events', () => {
  assert.throws(() => validateAuraAuditEvent({}), /AURA_AUDIT_EVENT_INVALID/);
});

test('enforces supervised proposal lifecycle', () => {
  const proposal = created();
  assert.throws(() => validateAuraAuditTransition([], createAuraAuditEvent({ ...proposal, eventType: 'proposal_approved', id: undefined as never })), /AURA_PROPOSAL_NOT_FOUND/);
  const approved = createAuraAuditEvent({
    projectId: proposal.projectId, actorId: 'reviewer-1', toolId: proposal.toolId,
    eventType: 'proposal_approved', sourceVersionId: proposal.sourceVersionId,
    proposalId: proposal.proposalId, payload: { decision: 'approved' },
  });
  validateAuraAuditTransition([proposal], approved);
  assert.throws(() => validateAuraAuditTransition([proposal, approved], approved), /AURA_PROPOSAL_ALREADY_DECIDED/);
  const correction = createAuraAuditEvent({
    projectId: proposal.projectId, actorId: 'reviewer-1', toolId: proposal.toolId,
    eventType: 'correction_recorded', sourceVersionId: proposal.sourceVersionId,
    proposalId: proposal.proposalId, payload: { correction: 'Align unit to verified wall.' },
  });
  validateAuraAuditTransition([proposal, approved], correction);
});

export type AuraAuditEventType =
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'correction_recorded';

export type AuraAuditEvent = {
  id: string;
  projectId: string;
  actorId: string;
  toolId: string;
  eventType: AuraAuditEventType;
  sourceVersionId: string;
  proposalId: string;
  createdAt: string;
  payload: Record<string, unknown>;
  provenance?: {
    compilerVersion?: string;
    provider?: string;
    model?: string;
  };
};

export type AuraAuditEventInput = Omit<AuraAuditEvent, 'id' | 'createdAt'>;

export interface AuraAuditStore {
  append(event: AuraAuditEvent): Promise<void>;
  list(input: { projectId: string; proposalId?: string; limit?: number }): Promise<AuraAuditEvent[]>;
}

/** Enforces the supervised proposal lifecycle before an event is persisted. */
export function validateAuraAuditTransition(history: readonly AuraAuditEvent[], next: AuraAuditEvent): void {
  const proposalEvents = history.filter((event) =>
    event.projectId === next.projectId && event.proposalId === next.proposalId,
  );
  if (next.eventType === 'proposal_created') {
    if (proposalEvents.length > 0) throw new Error('AURA_PROPOSAL_ALREADY_EXISTS');
    return;
  }
  if (proposalEvents.length === 0 || !proposalEvents.some((event) => event.eventType === 'proposal_created')) {
    throw new Error('AURA_PROPOSAL_NOT_FOUND');
  }
  const terminal = proposalEvents.some((event) => event.eventType === 'proposal_approved' || event.eventType === 'proposal_rejected');
  if (terminal && next.eventType !== 'correction_recorded') throw new Error('AURA_PROPOSAL_ALREADY_DECIDED');
  if (next.eventType === 'correction_recorded' && typeof next.payload.correction !== 'string' && typeof next.payload.correctionCode !== 'string') {
    throw new Error('AURA_CORRECTION_REQUIRED');
  }
}

export function createAuraAuditEvent(input: AuraAuditEventInput): AuraAuditEvent {
  if (!input.projectId || !input.actorId || !input.toolId || !input.sourceVersionId || !input.proposalId) {
    throw new Error('AURA_AUDIT_CONTEXT_REQUIRED');
  }
  return {
    ...input,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
}

export function validateAuraAuditEvent(value: unknown): AuraAuditEvent {
  if (!value || typeof value !== 'object') throw new Error('AURA_AUDIT_EVENT_INVALID');
  const event = value as Partial<AuraAuditEvent>;
  const types: AuraAuditEventType[] = ['proposal_created', 'proposal_approved', 'proposal_rejected', 'correction_recorded'];
  if (!event.id || !event.projectId || !event.actorId || !event.toolId || !event.sourceVersionId || !event.proposalId || !event.createdAt || !types.includes(event.eventType as AuraAuditEventType) || !event.payload || typeof event.payload !== 'object') {
    throw new Error('AURA_AUDIT_EVENT_INVALID');
  }
  return event as AuraAuditEvent;
}

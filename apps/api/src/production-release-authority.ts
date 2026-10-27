import { createHash } from 'node:crypto';

/** Stable facts only: review status and nesting placements cannot change the digest. */
export function productionReviewFingerprint(snapshot: { parts: Array<Record<string, unknown>>; fabricationRules: unknown; hardware?: unknown }): string {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
  const parts = snapshot.parts.map(({ status, sheetId, placedPos, ...facts }) => facts).sort((a, b) => String(a.partInstanceId).localeCompare(String(b.partInstanceId)));
  return createHash('sha256').update(JSON.stringify(canonical({ parts, fabricationRules: snapshot.fabricationRules, hardware: snapshot.hardware ?? [] }))).digest('hex');
}

/** Shared manufacturing review decision for every export serializer. */
export function applyProductionReleaseAuthority<T extends {
  parts: Array<{ partInstanceId: string; status?: string }>;
  fabricationRules: { version: string };
  status: string;
}>(snapshot: T, review: unknown, intent: 'draft' | 'released' = 'draft'): T {
  const record = review as { status?: string; approved_part_ids?: unknown; fabrication_rules_version?: string; source_fingerprint?: string } | null;
  const ids = Array.isArray(record?.approved_part_ids) ? record.approved_part_ids : [];
  const expected = snapshot.parts.map(part => part.partInstanceId);
  const approved = record?.status === 'approved'
    && record.fabrication_rules_version === snapshot.fabricationRules.version
    && record.source_fingerprint === productionReviewFingerprint(snapshot)
    && expected.length > 0 && new Set(expected).size === expected.length
    && ids.length === expected.length && new Set(ids).size === ids.length
    && ids.every(id => typeof id === 'string' && expected.includes(id));
  if (intent === 'released' && !approved) {
    throw Object.assign(new Error('PRODUCTION_REVIEW_REQUIRED: Review every exact panel and the current fabrication rules before factory release.'), {
      status: 409, code: 'PRODUCTION_REVIEW_REQUIRED',
    });
  }
  return { ...snapshot, status: approved ? 'approved' : 'review_required',
    parts: snapshot.parts.map(part => ({ ...part, status: approved ? 'approved' : 'review_required' })) };
}

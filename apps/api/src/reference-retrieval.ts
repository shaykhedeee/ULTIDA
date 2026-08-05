export type ReferenceVaultRecord = {
  id: string;
  title: string;
  source_path: string;
  room?: string | null;
  module_family?: string | null;
  style?: string | null;
  material_tags?: string[] | null;
  viewpoint?: string | null;
  review_state?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ReferenceRetrievalQuery = {
  text?: string;
  room?: string;
  moduleFamily?: string;
  style?: string;
  limit?: number;
};

export type RetrievedReference = ReferenceVaultRecord & { score: number; matchedTerms: string[] };

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'or', 'the', 'to', 'with']);

function normalise(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function tokens(value: unknown) {
  return [...new Set(normalise(value).split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token)))];
}

function searchableText(entry: ReferenceVaultRecord) {
  return [
    entry.title,
    entry.source_path,
    entry.room,
    entry.module_family,
    entry.style,
    entry.viewpoint,
    ...(entry.material_tags ?? []),
  ].map(normalise).join(' ');
}

function exactMatch(value: unknown, expected?: string) {
  return !expected || normalise(value) === normalise(expected);
}

/**
 * Deterministic retrieval intentionally uses reviewed library metadata rather
 * than inferred geometry. This keeps the vault useful with no new provider,
 * token, vector store, or model-training surface.
 */
export function retrieveReferences(entries: ReferenceVaultRecord[], query: ReferenceRetrievalQuery = {}): RetrievedReference[] {
  const terms = tokens(query.text);
  const limit = Math.max(1, Math.min(Math.floor(query.limit ?? 6), 12));

  return entries
    .filter((entry) => entry.review_state !== 'archived' && entry.review_state !== 'rejected')
    .filter((entry) => exactMatch(entry.room, query.room))
    .filter((entry) => exactMatch(entry.module_family, query.moduleFamily))
    .filter((entry) => exactMatch(entry.style, query.style))
    .map((entry) => {
      const text = searchableText(entry);
      const matchedTerms = terms.filter((term) => text.includes(term));
      const exactTitle = normalise(entry.title);
      let score = entry.review_state === 'approved' ? 30 : 8;
      score += matchedTerms.reduce((total, term) => total + (exactTitle.includes(term) ? 12 : 6), 0);
      if (query.room && exactMatch(entry.room, query.room)) score += 20;
      if (query.moduleFamily && exactMatch(entry.module_family, query.moduleFamily)) score += 20;
      if (query.style && exactMatch(entry.style, query.style)) score += 14;
      return { ...entry, score, matchedTerms };
    })
    .filter((entry) => terms.length === 0 || entry.matchedTerms.length > 0 || Boolean(query.room || query.moduleFamily || query.style))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

export function compileReferenceContext(entries: RetrievedReference[]) {
  if (!entries.length) {
    return {
      summary: 'No reviewed studio references matched this request. Continue from the approved plan, scene, and material data only.',
      rules: ['Reference retrieval must not create or verify geometry.'],
    };
  }
  const labels = entries.map((entry) => [entry.title, entry.room, entry.module_family, entry.style].filter(Boolean).join(' — '));
  return {
    summary: `Use these ${entries.length} reviewed studio reference${entries.length === 1 ? '' : 's'} as visual guidance only: ${labels.join('; ')}.`,
    rules: [
      'Keep approved plan, opening, module, camera, and scene geometry unchanged.',
      'Use references for finish, composition, lighting restraint, and part vocabulary only.',
      'Treat all source-image dimensions as advisory unless independently verified in the plan.',
    ],
  };
}

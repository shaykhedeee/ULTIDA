export interface ReferenceLibraryEntry {
  id: string;
  title: string;
  imageUrl?: string;
  sourcePath?: string;
  sha256?: string;
  roomType?: string;
}

export const MAX_CURATED_REFERENCES = 24;

/**
 * Deduplicates references by content hash and normalized path, returning a
 * diverse shelf capped at 24 unique images across room types.
 */
export function curateUniqueReferences<T extends ReferenceLibraryEntry>(
  entries: readonly T[],
  maxCount = MAX_CURATED_REFERENCES,
): T[] {
  const seenKeys = new Set<string>();
  const unique: T[] = [];

  for (const item of entries) {
    const rawPath = (item.sourcePath ?? item.imageUrl ?? item.title ?? item.id)
      .toLowerCase()
      .replace(/\s*-\s*copy(\s*\(\d+\))?/g, '')
      .replace(/\s*\(\d+\)/g, '')
      .trim();
    const key = item.sha256 ? `sha:${item.sha256}` : `path:${rawPath}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    unique.push(item);
    if (unique.length >= maxCount) break;
  }

  return unique;
}

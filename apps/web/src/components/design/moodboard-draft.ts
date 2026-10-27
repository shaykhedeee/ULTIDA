import { MoodboardDocumentSchema, type MoodboardDocument } from '@ultida/contracts';

export type MoodboardDraft = { document: MoodboardDocument; revision: number; savedAt: string };
export function moodboardDraftKey(projectId: string, roomId: string): string {
    return `ultida-moodboard-draft:${encodeURIComponent(projectId)}:${encodeURIComponent(roomId)}`;
}
/** Local recovery never promotes a draft to an approved or server-saved board. */
export function readMoodboardDraft(raw: string | null, projectId: string, roomId: string): MoodboardDraft | null {
    if (!raw || raw.length > 500000) return null;
    try {
        const value = JSON.parse(raw);
        const document = MoodboardDocumentSchema.parse(value.document);
        if (document.projectId !== projectId || document.roomId !== roomId || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) return null;
        return { document, revision: value.revision, savedAt: value.savedAt };
    } catch { return null; }
}

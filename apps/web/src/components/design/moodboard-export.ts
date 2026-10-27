import type { MoodboardDocument } from '@ultida/contracts';
import type { RoomBoardItem } from './room-moodboard';
export type MoodboardSwatch = {
    materialId: string;
    assetId: string;
    signedUrl: string;
};
export type MoodboardImage = {
    assetId: string;
    signedUrl: string;
    title: string;
};
export function cardImageUrl(card: MoodboardDocument['cards'][number], swatches: MoodboardSwatch[], images: MoodboardImage[]): string | undefined {
    return card.kind === 'material' ? swatches.find(image => image.materialId === card.materialId)?.signedUrl : images.find(image => image.assetId === card.assetId)?.signedUrl;
}
async function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => { const image = new Image(); const timer = setTimeout(() => reject(new Error('Image download timed out. Refresh signed links and retry.')), 15000); image.crossOrigin = 'anonymous'; image.onload = () => { clearTimeout(timer); resolve(image); }; image.onerror = () => { clearTimeout(timer); reject(new Error('A saved swatch could not be downloaded. Refresh the board to renew signed links, or check storage CORS settings.')); }; image.src = url; });
}
export function assertMoodboardExportable(board: MoodboardDocument, items: RoomBoardItem[], stale = false): void {
    if (stale) throw new Error('Room sources changed. Regenerate the board from saved materials before exporting.');
    const available = new Set(items.map(item => item.materialId));
    for (const card of board.cards) {
        if (card.kind === 'material' && (!card.materialId || !available.has(card.materialId)))
            throw new Error(`Material identity is no longer in the room selection: ${card.title}. Regenerate the board before exporting.`);
    }
}
export async function exportMoodboardPng(board: MoodboardDocument, items: RoomBoardItem[], swatches: MoodboardSwatch[], images: MoodboardImage[], stale = false): Promise<Blob> {
    assertMoodboardExportable(board, items, stale);
    const canvas = document.createElement('canvas');
    canvas.width = board.canvas.width;
    canvas.height = board.canvas.height + 90;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('PNG export is unavailable in this browser.');
    ctx.fillStyle = board.canvas.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#242a27';
    ctx.font = 'bold 32px Georgia';
    ctx.fillText(board.title, 40, 55);
    ctx.font = '12px sans-serif';
    ctx.fillText('ULTIDA / MATERIAL STUDY · Current source-linked room selections', 40, 85);
    for (const card of board.cards) {
        const item = items.find(item => item.materialId === card.materialId);
        const url = cardImageUrl(card, swatches, images);
        const photo = url ? await loadImage(url) : null;
        ctx.save();
        ctx.beginPath();
        ctx.rect(card.x, card.y, card.width, card.height);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(card.x, card.y, card.width, card.height);
        const imageHeight = Math.max(0, card.height - 86);
        if (photo) {
            const scale = Math.max(card.width / photo.width, imageHeight / photo.height);
            ctx.drawImage(photo, card.x + (card.width - photo.width * scale) / 2, card.y + (imageHeight - photo.height * scale) / 2, photo.width * scale, photo.height * scale);
        }
        else if (card.kind !== 'note') {
            ctx.fillStyle = item?.hex ?? '#e4dfd5';
            ctx.fillRect(card.x, card.y, card.width, imageHeight);
            ctx.fillStyle = '#353b37';
            ctx.font = '12px sans-serif';
            ctx.fillText('Swatch not uploaded', card.x + 12, card.y + 22);
        }
        if (card.kind === 'note') {
            ctx.fillStyle = '#f4eddc';
            ctx.fillRect(card.x, card.y, card.width, imageHeight);
            ctx.fillStyle = '#27372d';
            ctx.font = '18px Georgia';
            const words = card.note.split(/\s+/);
            let line = '', row = 0;
            for (const word of words) {
                if (ctx.measureText(`${line} ${word}`).width > card.width - 32 && line) {
                    ctx.fillText(line, card.x + 16, card.y + 30 + row * 24);
                    line = word;
                    row++;
                }
                else
                    line = line ? `${line} ${word}` : word;
            }
            ctx.fillText(line, card.x + 16, card.y + 30 + row * 24);
        }
        ctx.fillStyle = '#242a27';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(card.title, card.x + 12, card.y + card.height - 62, card.width - 24);
        ctx.font = '12px sans-serif';
        ctx.fillText(item ? `${item.brand ?? 'Supplier unspecified'} · ${item.code ?? 'Code unspecified'}` : card.kind === 'image' ? 'Project image · visual reference' : card.note, card.x + 12, card.y + card.height - 40, card.width - 24);
        ctx.fillText(item ? `${item.finish ?? item.category} · ${item.skuVerified ? 'Source linked' : 'Source unverified'}` : card.note, card.x + 12, card.y + card.height - 20, card.width - 24);
        ctx.restore();
    }
    ctx.fillStyle = '#eee9dd';
    ctx.fillRect(0, board.canvas.height, canvas.width, 90);
    ctx.fillStyle = '#353b37';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('DESIGN REFERENCE / DRAFT — verify physical samples, not manufacturing approval', 24, board.canvas.height + 30, canvas.width - 48);
    ctx.font = '11px sans-serif';
    ctx.fillText(`Room ${board.roomId} · Source ${board.sourceFingerprint.slice(0, 24)} · Scene ${board.sceneVersionId ?? 'not compiled'}`, 24, board.canvas.height + 54, canvas.width - 48);
    try {
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
    }
    catch {
        throw new Error('Swatch export was blocked by storage CORS. Update storage image access and try again; no image was exported.');
    }
}
export function downloadMoodboardBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function moodboardSpecification(board: MoodboardDocument, items: RoomBoardItem[]) {
    assertMoodboardExportable(board, items, false);
    const ids = new Set(board.cards.flatMap(card => card.materialId ? [card.materialId] : []));
    return { document: board, materialReferences: items.filter(item => ids.has(item.materialId)), notice: 'Draft design reference. Verify physical samples and exact product specifications. Not manufacturing approval. Image assets are referenced by identity; access URLs are not included.' };
}

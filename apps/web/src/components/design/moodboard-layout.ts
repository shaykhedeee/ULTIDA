import { MoodboardDocumentSchema, type MoodboardCard, type MoodboardDocument } from '@ultida/contracts';
import type { RoomBoardItem } from './room-moodboard';
export function layoutMoodboard(cards: MoodboardCard[], template: MoodboardDocument['template']): {
    canvas: MoodboardDocument['canvas'];
    cards: MoodboardCard[];
} {
    if (cards.length > 80)
        throw new Error('A board supports up to 80 cards. Reduce the saved material selection.');
    const width = cards.length > 24 ? 1600 : 1200;
    if (template === 'editorial' && cards.length > 1) {
        const hero = cards.find(card => card.kind === 'image') ?? cards[0]!;
        const remaining = cards.filter(card => card.id !== hero.id);
        const columns = cards.length > 24 ? 8 : 4;
        const rows = Math.ceil(remaining.length / columns);
        const gap = 22;
        const heroHeight = cards.length > 24 ? 200 : 260;
        const height = Math.min(1600, Math.max(900, 170 + heroHeight + gap + rows * 100 + (rows - 1) * gap));
        const w = (width - 80 - gap * (columns - 1)) / columns;
        const h = (height - 170 - heroHeight - gap - gap * (rows - 1)) / rows;
        return {
            canvas: { width, height, background: '#faf8f2' },
            cards: [{ ...hero, x: 40, y: 125, width: width - 80, height: heroHeight }, ...remaining.map((card, index) => ({ ...card, x: 40 + index % columns * (w + gap), y: 125 + heroHeight + gap + Math.floor(index / columns) * (h + gap), width: w, height: h }))],
        };
    }
    const columns = cards.length > 24 ? 8 : template === 'grid' ? 4 : 3;
    const rows = Math.max(1, Math.ceil(cards.length / columns));
    const height = Math.min(1600, Math.max(900, 150 + rows * 140));
    const gap = template === 'studio' ? 14 : 22;
    const w = (width - 80 - gap * (columns - 1)) / columns;
    const h = (height - 170 - gap * (rows - 1)) / rows;
    return { canvas: { width, height, background: template === 'studio' ? '#eae6dd' : '#faf8f2' }, cards: cards.map((card, index) => ({ ...card, x: 40 + (index % columns) * (w + gap), y: 125 + Math.floor(index / columns) * (h + gap), width: w, height: h })) };
}
export function createMoodboard(input: {
    projectId: string;
    roomId: string;
    roomName: string;
    sceneVersionId: string | null;
    sourceFingerprint: string;
    items: RoomBoardItem[];
    template: MoodboardDocument['template'];
}): MoodboardDocument {
    const materials = Array.from(new Map(input.items.map(item => [item.materialId, item])).values());
    const cards: MoodboardCard[] = materials.map(item => ({ id: `material-${item.materialId}`, kind: 'material', materialId: item.materialId, title: item.name, note: '', x: 0, y: 0, width: 100, height: 100 }));
    const layout = layoutMoodboard(cards, input.template);
    return MoodboardDocumentSchema.parse({ schema: 'ultida.moodboard.v1', projectId: input.projectId, roomId: input.roomId, sceneVersionId: input.sceneVersionId, sourceFingerprint: input.sourceFingerprint, title: input.roomName, notes: '', template: input.template, ...layout });
}
export function moveMoodboardCard(card: MoodboardCard, canvas: MoodboardDocument['canvas'], x: number, y: number): MoodboardCard {
    return { ...card, x: Math.max(0, Math.min(canvas.width - card.width, x)), y: Math.max(0, Math.min(canvas.height - card.height, y)) };
}
export function resizeMoodboardCard(card: MoodboardCard, canvas: MoodboardDocument['canvas'], width: number, height: number): MoodboardCard {
    return { ...card, width: Math.max(100, Math.min(canvas.width - card.x, width)), height: Math.max(100, Math.min(canvas.height - card.y, height)) };
}

/** Reuse a saved project asset; never persist its temporary signed URL. */
export function swatchAttachment(input: {
    materialId: string;
    assetId: string;
    rightsConfirmed: boolean;
    materialSources: Array<{ materialId: string; textureAssetId: string | null }>;
    imageAssets: Array<{ assetId: string }>;
}) {
    const source = input.materialSources.find(source => source.materialId === input.materialId);
    if (!source || !input.imageAssets.some(image => image.assetId === input.assetId))
        throw new Error('Select a material in this room and an existing project image.');
    if (!input.rightsConfirmed)
        throw new Error('Confirm that you have permission to use this swatch image.');
    return { materialId: input.materialId, assetId: input.assetId, expectedTextureAssetId: source.textureAssetId, rightsConfirmed: true as const };
}

export function moodboardSourcesChanged(board: MoodboardDocument, current: { loaded: boolean; sourceFingerprint: string; sceneVersionId: string | null }): boolean {
    return board.sceneVersionId !== current.sceneVersionId || (current.loaded && board.sourceFingerprint !== current.sourceFingerprint);
}

/** Refresh shared identities while preserving valid positioning, notes and titles. */
export function refreshMoodboardSources(board: MoodboardDocument, current: {
    sourceFingerprint: string; sceneVersionId: string | null; items: RoomBoardItem[]; imageAssets: Array<{assetId: string}>;
}): MoodboardDocument {
    const materials = new Map(current.items.map(item => [item.materialId, item]));
    const images = new Set(current.imageAssets.map(image => image.assetId));
    const cards = board.cards.filter(card => card.kind === 'note' || (card.kind === 'image' ? images.has(card.assetId!) : materials.has(card.materialId!)));
    const represented = new Set(cards.filter(card => card.kind === 'material').map(card => card.materialId));
    const additions = [...materials.values()].filter(item => !represented.has(item.materialId)).map(item => ({id:`material-${item.materialId}`,kind:'material' as const,materialId:item.materialId,title:item.name,note:'',x:40,y:125,width:300,height:240}));
    if (cards.length + additions.length > 80) throw new Error('Refreshing would exceed 80 cards. Remove some notes or images first.');
    return MoodboardDocumentSchema.parse({...board, sourceFingerprint:current.sourceFingerprint, sceneVersionId:current.sceneVersionId, cards:[...cards,...additions]});
}

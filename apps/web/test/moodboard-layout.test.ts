import test from 'node:test';
import assert from 'node:assert/strict';
import { MoodboardDocumentSchema, type MoodboardCard } from '@ultida/contracts';
import { layoutMoodboard, moveMoodboardCard, resizeMoodboardCard, createMoodboard } from '../src/components/design/moodboard-layout';
const cards = (count: number): MoodboardCard[] => Array.from({ length: count }, (_, index) => ({ id: `note-${index}`, kind: 'note', title: 'Note', note: '', x: 0, y: 0, width: 100, height: 100 }));
for (const template of ['editorial', 'grid', 'studio'] as const)
    for (const count of [0, 1, 12, 24, 25, 80])
        test(`${template} fits ${count} cards within its declared canvas`, () => {
            const result = layoutMoodboard(cards(count), template);
            const document = { schema: 'ultida.moodboard.v1', projectId: 'project', roomId: 'room', sceneVersionId: null, sourceFingerprint: 'source', title: 'Kitchen', notes: '', template, ...result };
            assert.equal(MoodboardDocumentSchema.safeParse(document).success, true);
            for (const card of result.cards) {
                assert.ok(card.width >= 100 && card.height >= 100);
                assert.ok(card.x + card.width <= result.canvas.width);
                assert.ok(card.y + card.height <= result.canvas.height);
            }
        });
test('layouts reject overflowing card counts instead of hiding materials', () => assert.throws(() => layoutMoodboard(cards(81), 'grid'), /80/));
test('movement and resizing stay inside the board', () => {
    const canvas = { width: 1200, height: 900, background: '#ffffff' };
    const moved = moveMoodboardCard(cards(1)[0]!, canvas, 9000, -9000);
    assert.equal(moved.x, 1100);
    assert.equal(moved.y, 0);
    const resized = resizeMoodboardCard(moved, canvas, 9000, 9000);
    assert.equal(resized.width, 100);
    assert.equal(resized.height, 900);
});
test('generated board retains actual material IDs and does not multiply duplicate assignments', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const item = { materialId: id, name: 'Saved oak' } as any;
    const board = createMoodboard({ projectId: 'project', roomId: 'room', roomName: 'Kitchen', sceneVersionId: null, sourceFingerprint: 'saved-source', items: [item, item], template: 'editorial' });
    assert.equal(board.cards.length, 1);
    assert.equal(board.cards[0]!.materialId, id);
    assert.equal(board.sourceFingerprint, 'saved-source');
});

test('missing swatches never resolve to invented asset URLs', async () => {
  const { cardImageUrl } = await import('../src/components/design/moodboard-export');
  const card = { ...cards(1)[0]!, kind: 'material' as const, materialId: 'material' };
  assert.equal(cardImageUrl(card, [], []), undefined);
  assert.equal(cardImageUrl(card, [{ materialId: 'material', assetId: 'swatch', signedUrl: 'https://storage.example/signed' }], []), 'https://storage.example/signed');
});

test('stale sources and missing room material identities block export', async () => {
    const { assertMoodboardExportable } = await import('../src/components/design/moodboard-export');
    const id = '00000000-0000-4000-8000-000000000001';
    const item = { materialId: id, name: 'Saved oak' } as any;
    const board = createMoodboard({ projectId: 'project', roomId: 'room', roomName: 'Kitchen', sceneVersionId: null, sourceFingerprint: 'saved-source', items: [item], template: 'editorial' });
    assert.throws(() => assertMoodboardExportable(board, [item], true), /sources changed/);
    assert.throws(() => assertMoodboardExportable(board, []), /Material identity/);
    assert.doesNotThrow(() => assertMoodboardExportable(board, [item]));
});

test('swatch attachment requires room identities and permission and retains expected texture identity', async () => {
    const { swatchAttachment } = await import('../src/components/design/moodboard-layout');
    const input = { materialId: 'saved-material', assetId: 'uploaded-image', rightsConfirmed: true, materialSources: [{ materialId: 'saved-material', textureAssetId: 'previous-image' }], imageAssets: [{ assetId: 'uploaded-image' }] };
    assert.throws(() => swatchAttachment({ ...input, rightsConfirmed: false }), /permission/);
    assert.throws(() => swatchAttachment({ ...input, imageAssets: [] }), /existing project image/);
    assert.throws(() => swatchAttachment({ ...input, materialSources: [] }), /material in this room/);
    const body = swatchAttachment(input);
    assert.equal(body.expectedTextureAssetId, 'previous-image');
    assert.deepEqual(Object.keys(body).sort(), ['assetId', 'expectedTextureAssetId', 'materialId', 'rightsConfirmed']);
});

test('undoing into a previous source revision stays stale even when the scene is unchanged', async () => {
    const { moodboardSourcesChanged } = await import('../src/components/design/moodboard-layout');
    const board = createMoodboard({ projectId:'p', roomId:'r', roomName:'Kitchen', sceneVersionId:null, sourceFingerprint:'old-source', items:[], template:'grid' });
    assert.equal(moodboardSourcesChanged(board, {loaded:true,sourceFingerprint:'new-source',sceneVersionId:null}), true);
    assert.equal(moodboardSourcesChanged({...board,sourceFingerprint:'new-source'}, {loaded:true,sourceFingerprint:'new-source',sceneVersionId:null}), false);
    assert.equal(moodboardSourcesChanged(board, {loaded:false,sourceFingerprint:'',sceneVersionId:null}), false, 'Unverified local drafts remain exportable with the permanent draft label');
});

test('source refresh preserves design and removes unavailable shared identities', async () => {
    const { refreshMoodboardSources } = await import('../src/components/design/moodboard-layout');
    const oldId = '00000000-0000-4000-8000-000000000001', newId = '00000000-0000-4000-8000-000000000002';
    const board = createMoodboard({projectId:'p',roomId:'r',roomName:'Kitchen',sceneVersionId:null,sourceFingerprint:'old',items:[{materialId:oldId,name:'Oak'} as any],template:'grid'});
    board.notes = 'Client direction'; board.cards[0]!.note = 'Keep matte'; board.cards[0]!.x = 70;
    board.cards.push({id:'note',kind:'note',title:'Direction',note:'Warm',x:40,y:125,width:100,height:100});
    const next = refreshMoodboardSources(board,{sourceFingerprint:'new',sceneVersionId:null,items:[{materialId:oldId,name:'Oak'},{materialId:newId,name:'Stone'}] as any,imageAssets:[]});
    assert.equal(next.sourceFingerprint,'new'); assert.equal(next.notes,'Client direction');
    assert.equal(next.cards[0]!.note,'Keep matte'); assert.equal(next.cards[0]!.x,70);
    assert.equal(next.cards.length,3);
    const removed = refreshMoodboardSources(next,{sourceFingerprint:'third',sceneVersionId:null,items:[],imageAssets:[]});
    assert.deepEqual(removed.cards.map(card=>card.id),['note']);
    assert.equal(board.cards.length,2);
});

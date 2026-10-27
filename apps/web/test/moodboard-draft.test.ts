import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoodboard } from '../src/components/design/moodboard-layout';
import { readMoodboardDraft, moodboardDraftKey } from '../src/components/design/moodboard-draft';
const document = createMoodboard({projectId:'project',roomId:'room',roomName:'Kitchen',sceneVersionId:null,sourceFingerprint:'source',items:[],template:'editorial'});
const raw = JSON.stringify({document,revision:3,savedAt:'2026-10-14T00:00:00Z'});
test('recovers the exact local document and original expected revision', () => {
    assert.deepEqual(readMoodboardDraft(raw,'project','room')?.document, document);
    assert.equal(readMoodboardDraft(raw,'project','room')?.revision,3);
});
test('rejects cross-room recovery and invalid revisions', () => {
    assert.equal(readMoodboardDraft(raw,'project','another'),null);
    for (const revision of [-1,1.5,'3']) assert.equal(readMoodboardDraft(JSON.stringify({document,revision,savedAt:'2026-10-14'}),'project','room'),null);
});
test('rejects corrupt documents and unreasonable storage payloads', () => {
    for (const raw of ['{',null,'x'.repeat(500001),JSON.stringify({document:{...document,cards:[{id:'bad'}]},revision:0,savedAt:'invalid'})]) assert.equal(readMoodboardDraft(raw,'project','room'),null);
});
test('storage keys cannot collide through project and room separators', () => {
    assert.notEqual(moodboardDraftKey('a:b','c'),moodboardDraftKey('a','b:c'));
});

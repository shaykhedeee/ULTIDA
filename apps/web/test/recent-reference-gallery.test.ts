import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { RECENT_REFERENCE_GALLERY, REFERENCE_SPACE_LABELS, referenceDisplayTitle, referenceFocus } from '../src/components/library/recent-reference-gallery.ts';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

test('recent visual reference gallery has unique, shipped assets and provenance', () => {
  assert.ok(RECENT_REFERENCE_GALLERY.length >= 300, 'expected the de-duplicated raster and technical reference set');
  const ids = new Set<string>();
  const images = new Set<string>();

  for (const reference of RECENT_REFERENCE_GALLERY) {
    assert.ok(reference.id && !ids.has(reference.id), `duplicate or missing reference ID: ${reference.id}`);
    assert.ok(reference.img.startsWith('/reference-vault/recent/'), `unexpected asset path: ${reference.img}`);
    assert.ok(!images.has(reference.img), `duplicate image path: ${reference.img}`);
    assert.ok(reference.title.trim().length > 0, `missing title: ${reference.id}`);
    assert.ok(reference.tags.includes('visual-reference'), `reference must be tagged advisory: ${reference.id}`);
    assert.match(reference.sourceSha256, /^[a-f0-9]{64}$/i, `missing source hash: ${reference.id}`);
    assert.ok(existsSync(path.join(publicDir, reference.img.slice(1))), `missing shipped image: ${reference.img}`);
    ids.add(reference.id);
    images.add(reference.img);
  }
});

test('technical drawings and finish details carry separate advisory labels', () => {
  const technical = RECENT_REFERENCE_GALLERY.filter((reference) => reference.kind === 'technical');
  const materials = RECENT_REFERENCE_GALLERY.filter((reference) => reference.kind === 'material-detail');
  assert.ok(technical.length >= 20, 'expected the reviewed technical sheets to remain searchable');
  assert.ok(materials.length >= 3, 'expected material-detail references to remain separately searchable');
  assert.ok(technical.every((reference) => reference.tags.includes('verify-source-separately')));
  assert.ok(materials.every((reference) => reference.tags.includes('not-supplier-specification')));
});

test('reference taxonomy provides a useful room, design focus, and non-generic title for every import', () => {
  const validSpaces = new Set(Object.keys(REFERENCE_SPACE_LABELS));
  for (const reference of RECENT_REFERENCE_GALLERY) {
    assert.ok(validSpaces.has(reference.room), `unclassified space on ${reference.id}: ${reference.room}`);
    assert.ok(referenceFocus(reference).trim().length > 0, `missing design focus on ${reference.id}`);
    const title = referenceDisplayTitle(reference);
    assert.ok(title.trim().length > 0, `missing display title on ${reference.id}`);
    assert.doesNotMatch(title, /visual reference\s+\d+/i, `generic fallback title remains on ${reference.id}`);
  }
  assert.equal(referenceFocus({ family: 'tv-unit', room: 'living', kind: 'render-or-inspiration' }), 'TV & media walls');
  assert.equal(referenceFocus({ family: 'wardrobe', room: 'bedroom', kind: 'render-or-inspiration' }), 'Wardrobes & storage');
  assert.equal(referenceFocus({ family: 'technical-reference', room: 'technical', kind: 'technical' }), 'Technical drawings');
  assert.equal(referenceFocus({ family: 'material-detail', room: 'materials', kind: 'material-detail' }), 'Material details');
});

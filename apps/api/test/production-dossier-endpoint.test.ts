import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { app, buildDossierSpecFromContext } from '../src/index.js';
import { generateProductionDossierPdf, buildProductionSnapshot } from '@ultida/drawing-core';
import type { SceneV1 } from '@ultida/schema';

const sampleScene: SceneV1 = {
  schema: 'scene.v1',
  units: 'mm',
  projectId: 'sharma-residence-01',
  floorPlanVersionId: 'plan-01',
  coordinateSystem: 'right-handed-z-up',
  floors: [{ id: 'f1', name: 'Level 01', elevationMm: 0, heightMm: 2700 }],
  spaces: [
    { id: 'sp-kitchen', floorId: 'f1', name: 'Gourmet Kitchen', type: 'kitchen' },
    { id: 'sp-master', floorId: 'f1', name: 'Master Suite', type: 'bedroom' },
    { id: 'sp-living', floorId: 'f1', name: 'Living & Dining Lounge', type: 'living' },
  ],
  rooms: [
    { id: 'r-kitchen', spaceId: 'sp-kitchen', name: 'Kitchen', type: 'kitchen', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 3600, yMm: 0 }, { xMm: 3600, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }], confidence: 1 },
    { id: 'r-master', spaceId: 'sp-master', name: 'Master Bed', type: 'bedroom', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4500, yMm: 0 }, { xMm: 4500, yMm: 4000 }, { xMm: 0, yMm: 4000 }, { xMm: 0, yMm: 0 }], confidence: 1 },
  ],
  walls: [
    { id: 'w1', floorId: 'f1', start: { xMm: 0, yMm: 0 }, end: { xMm: 3600, yMm: 0 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['sp-kitchen'], confidence: 1 },
    { id: 'w2', floorId: 'f1', start: { xMm: 0, yMm: 0 }, end: { xMm: 4500, yMm: 0 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['sp-master'], confidence: 1 },
  ],
  openings: [],
  fixedFixtures: [],
  materials: [],
  lighting: [],
  cameras: [],
  constraints: [],
  unresolvedDetections: [],
  modules: [
    { id: 'mod-wardrobe-1', roomId: 'r-master', family: 'wardrobe', widthMm: 2400, depthMm: 600, heightMm: 2400, position: { xMm: 500, yMm: 100 }, rotationDeg: 0, anchor: 'wall', confidence: 1 },
    { id: 'mod-kitchen-base', roomId: 'r-kitchen', family: 'kitchen-base', widthMm: 1800, depthMm: 600, heightMm: 850, position: { xMm: 200, yMm: 100 }, rotationDeg: 0, anchor: 'wall', confidence: 1 },
  ],
  moduleParts: [
    { id: 'p1', moduleId: 'mod-wardrobe-1', roomId: 'r-master', semanticType: 'panel', name: 'Side Gable Left', widthMm: 2400, depthMm: 600, heightMm: 18, position: { xMm: 500, yMm: 100, zMm: 0 }, rotationDeg: 0, confidence: 1 },
    { id: 'p2', moduleId: 'mod-wardrobe-1', roomId: 'r-master', semanticType: 'panel', name: 'Side Gable Right', widthMm: 2400, depthMm: 600, heightMm: 18, position: { xMm: 2900, yMm: 100, zMm: 0 }, rotationDeg: 0, confidence: 1 },
    { id: 'p3', moduleId: 'mod-wardrobe-1', roomId: 'r-master', semanticType: 'shelf', name: 'Top Fixed Shelf', widthMm: 2364, depthMm: 560, heightMm: 18, position: { xMm: 518, yMm: 100, zMm: 2100 }, rotationDeg: 0, confidence: 1 },
    { id: 'p4', moduleId: 'mod-wardrobe-1', roomId: 'r-master', semanticType: 'shutter', name: 'Front Shutter Left', widthMm: 590, depthMm: 18, heightMm: 2100, position: { xMm: 500, yMm: 100, zMm: 100 }, rotationDeg: 0, confidence: 1 },
    { id: 'p5', moduleId: 'mod-wardrobe-1', roomId: 'r-master', semanticType: 'shutter', name: 'Front Shutter Right', widthMm: 590, depthMm: 18, heightMm: 2100, position: { xMm: 1095, yMm: 100, zMm: 100 }, rotationDeg: 0, confidence: 1 },
    { id: 'p6', moduleId: 'mod-wardrobe-1', roomId: 'r-master', semanticType: 'back', name: 'Back Panel 8mm', widthMm: 2364, depthMm: 8, heightMm: 2300, position: { xMm: 518, yMm: 692, zMm: 100 }, rotationDeg: 0, confidence: 1 },
    { id: 'p7', moduleId: 'mod-kitchen-base', roomId: 'r-kitchen', semanticType: 'panel', name: 'Base Carcass Side', widthMm: 850, depthMm: 560, heightMm: 18, position: { xMm: 200, yMm: 100, zMm: 0 }, rotationDeg: 0, confidence: 1 },
    { id: 'p8', moduleId: 'mod-kitchen-base', roomId: 'r-kitchen', semanticType: 'shutter', name: 'Sink Shutter', widthMm: 596, depthMm: 18, heightMm: 720, position: { xMm: 200, yMm: 100, zMm: 100 }, rotationDeg: 0, confidence: 1 },
  ],
  metadata: {
    status: 'approved',
    designVersion: 'scene-04',
    changeReason: 'Final Sign-Off Approval',
  },
};

async function withServer<T>(callback: (baseUrl: string) => Promise<T>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('buildDossierSpecFromContext constructs an authoritative ProductionDossierSpecV1', async () => {
  const mockReq = {
    params: { projectId: 'sharma-residence-01' },
    header: () => null,
  } as any;

  const snapshot = buildProductionSnapshot(sampleScene);
  const spec = await buildDossierSpecFromContext(mockReq, sampleScene, snapshot);

  assert.equal(spec.schema, 'production.dossier.v1');
  assert.ok(spec.project.name);
  assert.ok(spec.project.clientName);
  assert.equal(spec.project.status, 'approved');

  // Verify brief & rooms scope
  assert.ok(spec.brief.lifestyleBrief.length > 20);
  assert.ok(spec.brief.roomsScope.length >= 3);
  assert.ok(spec.brief.appliances.length >= 2);

  // Verify BOM and Cutlist
  assert.ok(spec.bom.boardNesting.sheets18mm >= 1);
  assert.ok(spec.bom.hardwareTotals.length >= 3);
  assert.ok(spec.bom.cutlistParts.length >= 5);

  // Verify Commercial BOQ & Milestones
  assert.ok(spec.boq.lineItems.length >= 1);
  assert.equal(spec.boq.milestones.length, 4);
  assert.equal(spec.boq.milestones[0].pct, 10);
  assert.equal(spec.boq.milestones[1].pct, 40);
  assert.equal(spec.boq.milestones[2].pct, 40);
  assert.equal(spec.boq.milestones[3].pct, 10);

  // Verify 10-Point Pre-Installation Checklist
  assert.equal(spec.checklist.items.length, 10);
  assert.ok(spec.checklist.items.some((item) => item.check.includes('Civil Plaster')));
  assert.ok(spec.checklist.items.some((item) => item.check.includes('Chimney Duct')));
  assert.ok(spec.checklist.items.some((item) => item.check.includes('Moisture')));
});

test('generateProductionDossierPdf streams complete turnkey architectural PDF from built spec', async () => {
  const mockReq = {
    params: { projectId: 'sharma-residence-01' },
    header: () => null,
  } as any;

  const snapshot = buildProductionSnapshot(sampleScene);
  const spec = await buildDossierSpecFromContext(mockReq, sampleScene, snapshot);

  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c) => chunks.push(Buffer.from(c)));
  const completed = new Promise<void>((resolve, reject) => {
    stream.once('end', resolve);
    stream.once('error', reject);
  });

  generateProductionDossierPdf(spec, stream);
  await completed;

  const buffer = Buffer.concat(chunks);
  assert.ok(buffer.length > 35000, `Expected PDF buffer to be > 35KB, got ${buffer.length} bytes`);
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
  const pdfString = buffer.toString('binary');
  assert.ok(pdfString.includes('DWG-001'), 'DWG-001 Cover Sheet present');
  assert.ok(pdfString.includes('DWG-002'), 'DWG-002 Design Brief present');
  assert.ok(pdfString.includes('DWG-003'), 'DWG-003 Key Plan present');
  assert.ok(pdfString.includes('DWG-004'), 'DWG-004 Material Spec Matrix present');
  assert.ok(pdfString.includes('DWG-005'), 'DWG-005 Elevation Detail Sheet present');
  assert.ok(pdfString.includes('DWG-008'), 'DWG-008 Production Nesting present');
  assert.ok(pdfString.includes('DWG-009'), 'DWG-009 Commercial BOQ present');
  assert.ok(pdfString.includes('DWG-010'), 'DWG-010 Civil Readiness present');
  assert.ok(pdfString.includes('IS 710'), 'IS 710 Marine specification present');
  assert.ok(pdfString.includes('System 32'), 'System 32 joinery standard present');
});

test('production package and turnkey dossier routes enforce authentication', async () => {
  await withServer(async (baseUrl) => {
    const pkgResp = await fetch(`${baseUrl}/api/projects/proj-123/scenes/scene-456/production/package.pdf`);
    assert.equal(pkgResp.status, 401, 'Unauthenticated package.pdf returns 401');

    const dossierResp = await fetch(`${baseUrl}/api/projects/proj-123/dossier.pdf`);
    assert.equal(dossierResp.status, 401, 'Unauthenticated dossier.pdf returns 401');
  });
});

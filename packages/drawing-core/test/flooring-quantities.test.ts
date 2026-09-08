import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { buildFlooringQuantities } from '../../contracts/src/flooring.ts';
import {
  generateProductionDossierPdf,
  type ProductionDossierSpecV1,
} from '../src/production-dossier-pdf.ts';

test('one shared tile layout provides per-surface quantities and dossier finish rows', async () => {
  const quantities = buildFlooringQuantities([
    {
      id: 'floor-marble',
      roomId: 'living',
      materialVersionId: 'mat-calacatta-v1',
      regionPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 1200, yMm: 0 }, { xMm: 1200, yMm: 600 }, { xMm: 0, yMm: 600 }],
      elevationMm: 0,
      buildUpThicknessMm: 20,
      substrate: 'screed',
      tile: { widthMm: 600, lengthMm: 600, groutWidthMm: 0, groutColor: 'warm grey', originX: 0, originY: 0, angleDeg: 0, pattern: 'grid' as const },
      skirting: { heightMm: 100, profile: 'flush', doorwayExclusions: [{ startMm: 0, endMm: 900 }] },
    },
    {
      id: 'floor-wood',
      roomId: 'living',
      materialVersionId: 'mat-oak-v1',
      regionPolygon: [{ xMm: 1200, yMm: 0 }, { xMm: 2100, yMm: 0 }, { xMm: 2100, yMm: 600 }, { xMm: 1200, yMm: 600 }],
      elevationMm: 0,
      buildUpThicknessMm: 12,
      substrate: 'plywood-underlay',
      tile: { widthMm: 600, lengthMm: 600, groutWidthMm: 0, groutColor: 'none', originX: 1200, originY: 0, angleDeg: 0, pattern: 'brick' as const },
    },
  ]);

  assert.equal(quantities.length, 2);
  assert.equal(quantities[0].netAreaSqm, 0.72);
  assert.equal(quantities[0].fullTileCount, 2);
  assert.equal(quantities[0].cutTileCount, 0);
  assert.equal(quantities[0].skirtingLinearM, 2.7);
  assert.equal(quantities[1].netAreaSqm, 0.54);
  assert.equal(quantities[1].fullTileCount, 1);
  assert.equal(quantities[1].cutTileCount, 1);
  assert.ok(quantities[1].wastagePct > 0);

  const spec: ProductionDossierSpecV1 = {
    schema: 'production.dossier.v1',
    project: { name: 'Flooring Dossier', clientName: 'Client', location: 'Mumbai', designerName: 'Designer', date: '2026-09-07', revision: 'REV-01', status: 'approved' },
    elevations: [],
    finishes: {
      coreSubstrates: [], surfaceFinishes: [], edgeBanding: [], hardwareStandards: [],
      flooring: quantities.map((quantity) => ({
        surfaceId: quantity.surfaceId,
        materialVersionId: quantity.materialVersionId,
        application: quantity.surfaceId === 'floor-marble' ? 'Living / Calacatta' : 'Living / Oak',
        netAreaSqm: quantity.netAreaSqm,
        fullTileCount: quantity.fullTileCount,
        cutTileCount: quantity.cutTileCount,
        wastagePct: quantity.wastagePct,
        skirtingLinearM: quantity.skirtingLinearM,
      })),
    },
    bom: {
      boardNesting: { sheets18mm: 0, sheets8mm: 0, sheetsLaminate: 0, totalAreaSqm: 0, totalAreaSqFt: 0, nestingYieldPct: 0, stockSheetSizeMm: '2440 × 1220 mm' },
      edgeBandingSummary: [], hardwareTotals: [], cutlistParts: [],
      flooring: quantities,
    },
  };

  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  const complete = new Promise<void>((resolve, reject) => { stream.on('end', resolve); stream.on('error', reject); });
  generateProductionDossierPdf(spec, stream);
  await complete;
  const pdf = Buffer.concat(chunks);

  assert.ok(pdf.length > 30_000);
  const text = pdf.toString('latin1');
  assert.ok(text.includes('Living / Calacatta'));
  assert.ok(text.includes('Living / Oak'));
  assert.ok(text.includes('0.72'));
  assert.ok(text.includes('0.54'));
});

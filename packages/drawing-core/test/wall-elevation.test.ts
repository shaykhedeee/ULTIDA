import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { exportWallElevationToDxf, generateWallElevationsPdf, generateWallElevationsSvg } from '../src/index.js';

const testScene = {
  schema: 'scene.v1',
  units: 'mm',
  projectId: 'proj-elevation-test',
  floorPlanVersionId: 'plan-v1',
  rooms: [{ id: 'room-1', name: 'Living Room', type: 'living', boundary: [] }],
  openings: [{ id: 'door-1', kind: 'door', wallId: 'wall-1', offsetMm: 200, widthMm: 900, heightMm: 2100 }],
  materials: [],
  metadata: { branch: 'main', status: 'approved', changeReason: 'Test approval' },
  walls: [{ id: 'wall-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 3500, yMm: 0 }, thicknessMm: 150, heightMm: 2700 }],
  modules: [{ id: 'tv-console', roomId: 'room-1', family: 'tv-unit', widthMm: 1800, depthMm: 400, heightMm: 450, position: { xMm: 1200, yMm: 0 }, rotationDeg: 0 }]
};

test('generateWallElevationsSvg produces styled SVG element with wall dimensions and labels', () => {
  const svg = generateWallElevationsSvg(testScene as any, 'wall-1', {
    titleBlock: { companyName: 'Altera Studio', drawingTitle: 'TV Wall Elevation' }
  });
  assert.match(svg, /<svg/);
  assert.match(svg, /Altera Studio/);
  assert.match(svg, /TV Wall Elevation/);
  assert.match(svg, /tv-unit 1800mm/);
});

test('exportWallElevationToDxf emits a valid AutoCAD-compatible DXF file passed by Python ezdxf validator', () => {
  const dxf = exportWallElevationToDxf(testScene as any, 'wall-1', {
    titleBlock: { companyName: 'Altera Studio', drawingTitle: 'TV Wall Elevation' }
  });
  assert.match(dxf, /^0\r\nSECTION\r\n2\r\nHEADER\r\n/);
  assert.match(dxf, /0\r\nSECTION\r\n2\r\nENTITIES\r\n/);
  assert.match(dxf, /A-WALL/);
  assert.match(dxf, /A-MOD/);
  assert.match(dxf, /A-OPENING/);
  assert.match(dxf, /0\r\nEOF\r\n$/);

  const tempPath = join(fileURLToPath(new URL('.', import.meta.url)), 'temp_wall_elevation.dxf');
  writeFileSync(tempPath, dxf);
  try {
    const validatorPath = join(fileURLToPath(new URL('../../../scripts', import.meta.url)), 'validate_dxf.py');
    execFileSync('python', [validatorPath, tempPath], { stdio: 'pipe' });
  } finally {
    try { unlinkSync(tempPath); } catch {}
  }
});

test('generateWallElevationsPdf streams valid PDF data', async () => {
  const chunks: Buffer[] = [];
  const outStream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    }
  });

  generateWallElevationsPdf(testScene as any, outStream);
  await new Promise((resolve) => outStream.on('finish', resolve));

  const pdfBuffer = Buffer.concat(chunks);
  assert.ok(pdfBuffer.length > 100);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
});

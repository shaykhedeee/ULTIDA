import test from 'node:test';
import assert from 'node:assert/strict';
import { clipCncLineToPanel, jaaliInputIssues, validateCncPanelOperations } from '../src/features/tools/cnc-validation.ts';

test('CNC operation validation blocks drills that cross panel edges or stock depth', () => {
  const issues = validateCncPanelOperations(
    { widthMm: 500, lengthMm: 800, thicknessMm: 18 },
    { holes: [
      { id: 'edge-hole', x: 5, y: 200, diameter: 15, depth: 12 },
      { id: 'through-depth', x: 100, y: 200, diameter: 8, depth: 20 },
    ], grooves: [] },
  );
  assert.match(issues.join('\n'), /edge-hole.*outside/);
  assert.match(issues.join('\n'), /through-depth.*exceeds/);
});

test('valid CNC panel operations pass without warnings', () => {
  assert.deepEqual(validateCncPanelOperations(
    { widthMm: 500, lengthMm: 800, thicknessMm: 18 },
    { holes: [{ id: 'pin', x: 37, y: 200, diameter: 5, depth: 13 }], grooves: [] },
  ), []);
});

test('jaali validation blocks circle layouts below the requested material bridge', () => {
  const issues = jaaliInputIssues({ widthMm: 600, heightMm: 900, spacingMm: 50, toolDiameterMm: 8, materialThicknessMm: 18, minimumBridgeMm: 16, pattern: 'circle' });
  assert.match(issues.join('\n'), /leaves only/);
});

test('Jaali diagonal DXF lines are clipped to the measured panel boundary', () => {
  const line = clipCncLineToPanel(-200, 0, 700, 900, 600, 900);
  assert.ok(line);
  assert.ok(line!.every((value, index) => index % 2 === 0 ? value >= 0 && value <= 600 : value >= 0 && value <= 900));
  assert.equal(clipCncLineToPanel(-300, -100, -200, -50, 600, 900), null);
});

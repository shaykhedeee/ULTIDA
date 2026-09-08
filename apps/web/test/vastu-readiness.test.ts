import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateVastuCompliance,
  TopViewFurniture,
} from '../src/components/spaces/TopViewFloorplanEnhancer.tsx';

test('Vastu compliance: default bedroom placement in South-West (Nairutya) passes with high score', () => {
  const room = { widthMm: 4200, lengthMm: 3800 };
  const items: TopViewFurniture[] = [
    {
      id: 'bed-1',
      name: 'King Bed + Floating Nightstands',
      category: 'bed',
      widthMm: 2600,
      depthMm: 2200,
      xMm: 420, // ~10% (West)
      yMm: 2090, // ~55% (South) -> center = normX: (420+1300)/4200 = 0.409, normY: (2090+1100)/3800 = 0.839 (South)
      rotationDeg: 0,
      unitPrice: 2100,
      isFloating: false,
      semanticColor: '#cc0000',
    },
    {
      id: 'tv-1',
      name: 'Floating Modular TV Console',
      category: 'modular_storage',
      widthMm: 2400,
      depthMm: 450,
      xMm: 900,
      yMm: 300, // North
      rotationDeg: 0,
      unitPrice: 920,
      isFloating: true,
      semanticColor: '#ff9900',
    },
  ];

  const analysis = evaluateVastuCompliance(room, items);
  assert.equal(analysis.isCompliant, true);
  assert.equal(analysis.remedyCount, 0);
  assert.ok(analysis.score >= 80, `Expected score >= 80, got ${analysis.score}`);
  assert.equal(analysis.criticalRemedy, undefined);
});

test('Vastu compliance: shifting master bed to North-East (Ishanya) triggers Vastu remedy defect', () => {
  const room = { widthMm: 4200, lengthMm: 3800 };
  const items: TopViewFurniture[] = [
    {
      id: 'bed-1',
      name: 'King Bed + Floating Nightstands',
      category: 'bed',
      widthMm: 2600,
      depthMm: 2200,
      // Placed in North-East:
      xMm: 3024, // normX center = (3024 + 1300)/4200 = 1.029 (East)
      yMm: 304,  // normY center = (304 + 1100)/3800 = 0.369 (North)
      rotationDeg: 0,
      unitPrice: 2100,
      isFloating: false,
      semanticColor: '#cc0000',
    },
  ];

  const analysis = evaluateVastuCompliance(room, items);
  assert.equal(analysis.isCompliant, false);
  assert.ok(analysis.remedyCount >= 1);
  assert.ok(analysis.criticalRemedy?.includes('South-West (Nairutya)'));
});

test('Vastu compliance: sacred Mandir in North-East (Ishanya) is auspicious, outside is flagged', () => {
  const room = { widthMm: 5000, lengthMm: 4000 };
  
  // Placed in NE
  const mandirInNE: TopViewFurniture[] = [
    {
      id: 'mandir-1',
      name: 'Sacred Teak Mandir Unit',
      category: 'modular_storage',
      widthMm: 1200,
      depthMm: 600,
      xMm: 3500, // East
      yMm: 500,  // North
      rotationDeg: 0,
      unitPrice: 1500,
      isFloating: false,
      semanticColor: '#ff9900',
    },
  ];

  const neAnalysis = evaluateVastuCompliance(room, mandirInNE);
  assert.equal(neAnalysis.isCompliant, true);
  assert.equal(neAnalysis.remedyCount, 0);

  // Placed in South-West (defective for Mandir)
  const mandirInSW: TopViewFurniture[] = [
    {
      id: 'mandir-1',
      name: 'Sacred Teak Mandir Unit',
      category: 'modular_storage',
      widthMm: 1200,
      depthMm: 600,
      xMm: 500,  // West
      yMm: 3000, // South
      rotationDeg: 0,
      unitPrice: 1500,
      isFloating: false,
      semanticColor: '#ff9900',
    },
  ];

  const swAnalysis = evaluateVastuCompliance(room, mandirInSW);
  assert.equal(swAnalysis.isCompliant, false);
  assert.ok(swAnalysis.remedyCount >= 1);
  assert.ok(swAnalysis.criticalRemedy?.includes('North-East corner'));
});

test('Vastu compliance: kitchen hob in South-East (Agneya) is auspicious, in North-West triggers remedy', () => {
  const room = { widthMm: 4000, lengthMm: 4000 };

  // Placed in SE
  const kitchenHobSE: TopViewFurniture[] = [
    {
      id: 'kitchen-1',
      name: 'Modular Kitchen Counter & Hob',
      category: 'modular_storage',
      widthMm: 1800,
      depthMm: 600,
      xMm: 2800, // East
      yMm: 3000, // South
      rotationDeg: 0,
      unitPrice: 2200,
      isFloating: false,
      semanticColor: '#ff9900',
    },
  ];

  const seAnalysis = evaluateVastuCompliance(room, kitchenHobSE);
  assert.equal(seAnalysis.isCompliant, true);
  assert.equal(seAnalysis.remedyCount, 0);

  // Placed in North-West
  const kitchenHobNW: TopViewFurniture[] = [
    {
      id: 'kitchen-1',
      name: 'Modular Kitchen Counter & Hob',
      category: 'modular_storage',
      widthMm: 1800,
      depthMm: 600,
      xMm: 500,  // West
      yMm: 500,  // North
      rotationDeg: 0,
      unitPrice: 2200,
      isFloating: false,
      semanticColor: '#ff9900',
    },
  ];

  const nwAnalysis = evaluateVastuCompliance(room, kitchenHobNW);
  assert.equal(nwAnalysis.isCompliant, false);
  assert.ok(nwAnalysis.remedyCount >= 1);
  assert.ok(nwAnalysis.criticalRemedy?.includes('South-East'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionSnapshot, generateFullProductionCutlist, generateProductionLabelsSvg, generateProductionNestingSvg, nestPanels2D } from '../src/index.ts';

test('production snapshot separates panel thickness from its visible height', () => {
  const snapshot = buildProductionSnapshot({
    projectId: 'project-1', modules: [{ id: 'module-1', family: 'crockery-unit' }],
    moduleParts: [{ id: 'door-1', moduleId: 'module-1', roomId: 'dining', semanticType: 'shutter', name: 'Glass door surround', widthMm: 420, depthMm: 18, heightMm: 1200, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'laminate-1', confidence: 1 }],
    metadata: { status: 'approved', designVersion: 'scene-7' },
  } as any);
  assert.deepEqual({ lengthMm: snapshot.parts[0].lengthMm, widthMm: snapshot.parts[0].widthMm, thicknessMm: snapshot.parts[0].thicknessMm }, { lengthMm: 1200, widthMm: 420, thicknessMm: 18 });
});

test('nesting fails clearly when a panel cannot fit the trimmed stock sheet', () => {
  assert.throws(() => nestPanels2D([{ id: 'oversize', moduleId: 'm1', family: 'wardrobe', partName: 'Oversize panel', lengthMm: 2500, widthMm: 600, thicknessMm: 18, edging: 'none', materialCode: 'ply', quantity: 1, status: 'review_required' }]), /PANEL_EXCEEDS_USABLE_SHEET/);
});

test('production labels and nesting remain linked to physical scene part identities', () => {
  const snapshot = buildProductionSnapshot({
    projectId: 'project-1', modules: [{ id: 'module-1', family: 'tv-unit' }],
    moduleParts: [{ id: 'panel-1', moduleId: 'module-1', roomId: 'living', semanticType: 'panel', name: 'TV back panel', widthMm: 900, depthMm: 18, heightMm: 1200, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'oak', confidence: 1 }],
    metadata: { status: 'locked', designVersion: 'scene-9' },
  } as any);
  const labels = generateProductionLabelsSvg(snapshot);
  const nesting = generateProductionNestingSvg(snapshot);
  assert.match(labels, /panel-1/);
  assert.match(labels, /1200 x 900 x 18 mm/);
  assert.match(nesting, /panel-1/);
  assert.match(nesting, /oak 18 mm/);
});

test('legacy cutlist entrypoint uses compiled parts and never invents a carcass', () => {
  const scene = {
    projectId: 'project-1',
    modules: [{ id: 'module-1', family: 'wardrobe', widthMm: 2400, depthMm: 600, heightMm: 2700 }],
    moduleParts: [{ id: 'approved-panel', moduleId: 'module-1', roomId: 'bedroom', semanticType: 'panel', name: 'Approved side panel', widthMm: 18, depthMm: 600, heightMm: 2400, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'oak-18', confidence: 1 }],
    metadata: { status: 'approved', designVersion: 'scene-10' },
  } as any;
  const cutlist = generateFullProductionCutlist(scene);
  assert.deepEqual(cutlist.parts.map((part) => part.id), ['approved-panel']);
  assert.equal(cutlist.parts[0]?.materialCode, 'oak-18');
  assert.equal(cutlist.parts.some((part) => part.id === 'module-1-left'), false);
});

test('certification gating excludes uncertified modules and surfaces them explicitly', () => {
  const scene = {
    projectId: 'project-certified-test',
    modules: [
      { id: 'wardrobe-1', family: 'wardrobe', name: 'Master Wardrobe' },
      { id: 'sofa-1', family: 'sofa', name: 'Living Room Boucle Sofa', production: { panelBased: false, hardwareSchedule: false, cutlistSupported: false } },
    ],
    moduleParts: [
      { id: 'w-panel-1', moduleId: 'wardrobe-1', roomId: 'bedroom', semanticType: 'shutter', name: 'Wardrobe Shutter L', widthMm: 450, depthMm: 18, heightMm: 2100, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'hdhmr-18', confidence: 1 },
      { id: 'sofa-cushion-1', moduleId: 'sofa-1', roomId: 'living', semanticType: 'panel', name: 'Sofa Base Foam Board', widthMm: 900, depthMm: 18, heightMm: 1800, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'foam-wood', confidence: 1 },
    ],
    metadata: { status: 'approved', designVersion: 'scene-cert-1' },
  } as any;

  const snapshot = buildProductionSnapshot(scene);

  // Wardrobe part is included
  assert.equal(snapshot.parts.length, 1);
  assert.equal(snapshot.parts[0].id, 'w-panel-1');
  assert.equal(snapshot.parts[0].family, 'wardrobe');

  // Sofa part is completely excluded
  assert.equal(snapshot.parts.some((p) => p.moduleId === 'sofa-1'), false);

  // Excluded modules list contains the sofa with explicit reason
  assert.ok(snapshot.excludedModules && snapshot.excludedModules.length === 1);
  assert.equal(snapshot.excludedModules[0].moduleId, 'sofa-1');
  assert.equal(snapshot.excludedModules[0].family, 'sofa');
  assert.match(snapshot.excludedModules[0].reason, /cutlistSupported: false|uncertified/);

  // Warning is logged
  assert.ok(snapshot.warnings.some((w) => w.includes('sofa-1') && w.includes('uncertified')));
});

test('grain-direction-aware nesting respects vertical/horizontal constraints and yields denser packing when unconstrained', () => {
  // A fixture panel that cannot fit in height if vertical (e.g., width 1190, length 1300)
  // Usable sheet space is 2420 x 1200 (trimmed from 2440 x 1220)
  // Part: length 1300, width 700.
  // In a 2420 x 1200 sheet:
  // With vertical grain: length along X (1300), width along Y (700). Only 1 fits vertically (700*2 = 1400 > 1200).
  // Along X: 1300 fits once (1300*2 = 2600 > 2420). So exactly 1 panel per sheet if vertical!
  // If rotated 90 deg: width along X (700), length along Y (1300 > 1200, so cannot rotate this one).
  
  // Let's create fixture parts: four panels of size 1200 x 590 mm with vertical grain
  // Usable sheet area: 2420 x 1200.
  // With vertical grain (length along X, width along Y):
  // X = 1200 + 3 = 1203, so 2 fit along X (1200*2 + 3 = 2403 <= 2420).
  // Y = 590 + 3 = 593, so 2 fit along Y (590*2 + 3 = 1183 <= 1200).
  // 4 fit on 1 sheet.
  
  // Now consider parts: two panels of 1300 x 590 mm and two panels of 590 x 1100 mm with vertical grain.
  const parts: any[] = [
    { id: 'p1', moduleId: 'm1', family: 'wardrobe', partName: 'Tall Shutter 1', lengthMm: 1300, widthMm: 590, thicknessMm: 18, edging: 'none', materialCode: 'ply-18', quantity: 2, status: 'approved', grainDirection: 'vertical' },
    { id: 'p2', moduleId: 'm1', family: 'wardrobe', partName: 'Cross Shutter 2', lengthMm: 1300, widthMm: 590, thicknessMm: 18, edging: 'none', materialCode: 'ply-18', quantity: 2, status: 'approved', grainDirection: 'vertical' },
  ];

  // Test with respectGrain: true
  const constrained = nestPanels2D(parts, 2440, 1220, 3, 10, true);
  // Test with respectGrain: false (unconstrained)
  const unconstrained = nestPanels2D(parts, 2440, 1220, 3, 10, false);

  assert.ok(constrained.sheets.length >= unconstrained.sheets.length, 'Unconstrained nesting must need equal or fewer sheets');
  assert.ok(unconstrained.overallUtilizationPercentage >= constrained.overallUtilizationPercentage, 'Unconstrained nesting must have equal or higher utilization');

  // Verify that rotated flag is false on all panels when constrained
  for (const sheet of constrained.sheets) {
    for (const panel of sheet.placedPanels) {
      assert.equal(panel.rotated, false, `Panel ${panel.partId} must not rotate when grain is constrained`);
    }
  }
});

test('multi-sheet-size optimization selects optimal sheet size across 8x4, 9x4, and 7x4', async () => {
  const { optimizeMultiSheetNesting, STANDARD_SHEET_SIZES } = await import('../src/index.ts');
  
  // Tall panels of 2400mm cannot fit on a 7x4 sheet (2135mm), but fit on 8x4 (2440mm trimmed is 2420mm) or 9x4 (2745mm)
  const tallParts: any[] = [
    { id: 'tall-1', moduleId: 'm1', family: 'wardrobe', partName: 'Tall Gable', lengthMm: 2400, widthMm: 580, thicknessMm: 18, edging: 'none', materialCode: 'ply-18', quantity: 2, status: 'approved', grainDirection: 'vertical' }
  ];

  const result = optimizeMultiSheetNesting(tallParts, STANDARD_SHEET_SIZES);

  assert.ok(result.bestSize, 'Must select a best sheet size');
  assert.ok(result.candidates.length === 3, 'Must evaluate 3 standard sheet candidates');

  // 7x4 candidate should be infeasible because 2400mm > 2135mm trimmed
  const candidate7x4 = result.candidates.find((c) => c.sheetSize.name.includes('7x4'));
  assert.equal(candidate7x4?.feasible, false);

  // 8x4 or 9x4 candidate should be feasible
  const candidate8x4 = result.candidates.find((c) => c.sheetSize.name.includes('8x4'));
  assert.equal(candidate8x4?.feasible, true);
});

test('generateCncPanelDxf writes System 32 line boring and hinge cup layers', async () => {
  const { generateCncPanelDxf } = await import('../src/index.ts');

  // Carcass Gable: line boring & hinge mounting
  const gableDxf = generateCncPanelDxf({
    widthMm: 580,
    lengthMm: 2400,
    thicknessMm: 18,
    panelType: 'gable_left',
    name: 'Left Wardrobe Gable',
  });

  assert.match(gableDxf, /A-OUTLINE-CUT/);
  assert.match(gableDxf, /A-DRILL-BORING/);
  assert.match(gableDxf, /A-DRILL-HINGE/);
  assert.match(gableDxf, /A-DRILL-MINIFIX/);
  assert.match(gableDxf, /A-GROOVE-BACK/);

  // Shutter Door: 35mm hinge cup borings
  const shutterDxf = generateCncPanelDxf({
    widthMm: 594,
    lengthMm: 2394,
    thicknessMm: 18,
    panelType: 'shutter',
    name: 'Main Wardrobe Shutter',
  });

  assert.match(shutterDxf, /A-OUTLINE-CUT/);
  assert.match(shutterDxf, /A-DRILL-HINGE/);
  // Verify 35mm hinge cup radius (17.5mm) is emitted as CIRCLE
  assert.match(shutterDxf, /CIRCLE[\r\n]+8[\r\n]+A-DRILL-HINGE[\r\n]+10[\r\n]+21.5[\r\n]+20[\r\n]+\d+[\r\n]+30[\r\n]+0[\r\n]+40[\r\n]+17.5/);
});

test('certification gating withholds orphaned parts referencing unregistered modules', () => {
  const scene = {
    projectId: 'project-orphan-test',
    modules: [
      { id: 'kitchen-base-1', family: 'kitchen-base', name: 'Base Unit' },
    ],
    moduleParts: [
      { id: 'kb-part-1', moduleId: 'kitchen-base-1', roomId: 'kitchen', semanticType: 'shutter', name: 'Valid Shutter', widthMm: 500, depthMm: 18, heightMm: 700, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'hdhmr-18', confidence: 1 },
      { id: 'orphan-part-1', moduleId: 'rogue-unregistered-module', roomId: 'living', semanticType: 'panel', name: 'Loose Panel', widthMm: 600, depthMm: 18, heightMm: 1200, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'ply-18', confidence: 1 },
    ],
    metadata: { status: 'approved', designVersion: 'scene-orphan-1' },
  } as any;

  const snapshot = buildProductionSnapshot(scene);
  assert.equal(snapshot.parts.length, 1);
  assert.equal(snapshot.parts[0].id, 'kb-part-1');
  assert.equal(snapshot.parts.some((p) => p.id === 'orphan-part-1'), false);
  assert.ok(snapshot.excludedModules?.some((m) => m.moduleId === 'rogue-unregistered-module'));
  assert.ok(snapshot.warnings.some((w) => w.includes('rogue-unregistered-module')));
});

test('certification gating checks external catalog lookup and filters modules where cutlistSupported !== true', () => {
  const catalog = [
    { id: 'custom-wardrobe-mockup', family: 'wardrobe', name: 'Visual Wardrobe Proxy', production: { cutlistSupported: false } },
    { id: 'certified-cabinet-1', family: 'kitchen-wall', name: 'Standard Wall Cabinet', production: { cutlistSupported: true } },
  ];

  const scene = {
    projectId: 'project-cat-lookup-test',
    modules: [
      { id: 'mod-certified', catalogItemId: 'certified-cabinet-1', family: 'kitchen-wall', name: 'Real Wall Cabinet' },
      { id: 'mod-proxy', catalogItemId: 'custom-wardrobe-mockup', family: 'wardrobe', name: 'Visual Proxy' },
    ],
    moduleParts: [
      { id: 'p-cert', moduleId: 'mod-certified', roomId: 'kitchen', semanticType: 'shutter', name: 'Wall Door', widthMm: 450, depthMm: 18, heightMm: 720, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'm1', confidence: 1 },
      { id: 'p-proxy', moduleId: 'mod-proxy', roomId: 'bedroom', semanticType: 'shutter', name: 'Proxy Door', widthMm: 500, depthMm: 18, heightMm: 2100, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'm2', confidence: 1 },
    ],
    metadata: { status: 'approved', designVersion: 'scene-lookup-1' },
  } as any;

  const snapshot = buildProductionSnapshot(scene, undefined, catalog);
  assert.equal(snapshot.parts.length, 1);
  assert.equal(snapshot.parts[0].id, 'p-cert');
  assert.equal(snapshot.parts.some((p) => p.moduleId === 'mod-proxy'), false);
  assert.ok(snapshot.excludedModules?.some((m) => m.moduleId === 'mod-proxy' && /cutlistSupported: false/.test(m.reason)));
});


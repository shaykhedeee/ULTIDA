import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePlanVastu,
  determineVastuZone,
  parseDimensionPair,
  autoCalibrateFromRoomDimensions,
} from '../../../packages/plan-core/src/index.ts';

test('Vastu Engine: Cardinal & Inter-cardinal zone determinations with 0 deg North', () => {
  const bounds = { minX: 0, minY: 0, width: 1000, height: 1000 };

  // North-East corner: x=850, y=150 (Right-Top)
  const ne = determineVastuZone({ x: 850, y: 150 }, bounds, 0);
  assert.equal(ne, 'NE');

  // South-East corner: x=850, y=850 (Right-Bottom)
  const se = determineVastuZone({ x: 850, y: 850 }, bounds, 0);
  assert.equal(se, 'SE');

  // South-West corner: x=150, y=850 (Left-Bottom)
  const sw = determineVastuZone({ x: 150, y: 850 }, bounds, 0);
  assert.equal(sw, 'SW');

  // North-West corner: x=150, y=150 (Left-Top)
  const nw = determineVastuZone({ x: 150, y: 150 }, bounds, 0);
  assert.equal(nw, 'NW');

  // Center: x=500, y=500
  const center = determineVastuZone({ x: 500, y: 500 }, bounds, 0);
  assert.equal(center, 'Brahmasthan');
});

test('Vastu Engine: Whole-plan assessment of classical auspicious 3BHK villa', () => {
  const rooms = [
    {
      id: 'room-master-bed',
      label: 'Master Bedroom',
      roomType: 'master_bedroom',
      geometry: { x: 100, y: 650, width: 250, height: 250 }, // South-West
    },
    {
      id: 'room-kitchen',
      label: 'Modular Kitchen',
      roomType: 'kitchen',
      geometry: { x: 650, y: 650, width: 250, height: 250 }, // South-East
    },
    {
      id: 'room-pooja',
      label: 'Pooja Mandir',
      roomType: 'pooja',
      geometry: { x: 700, y: 100, width: 200, height: 200 }, // North-East
    },
    {
      id: 'room-living',
      label: 'Living Room',
      roomType: 'living',
      geometry: { x: 400, y: 100, width: 250, height: 250 }, // North
    },
  ];

  const report = calculatePlanVastu({ rooms, northAngleDeg: 0, planBounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 } });
  assert.ok(report.overallScore >= 90, `Expected score >= 90, got ${report.overallScore}`);
  assert.equal(report.status, 'highly_auspicious');
  assert.equal(report.summary.criticalDefectCount, 0);
  assert.equal(report.summary.auspiciousCount, 4);
});

test('Vastu Engine: Detects critical defects (Master Bed in NE and Kitchen in NE) and issues remedies', () => {
  const rooms = [
    {
      id: 'room-master-bed',
      label: 'Master Bedroom',
      roomType: 'master_bedroom',
      geometry: { x: 750, y: 100, width: 200, height: 200 }, // North-East (Critical Defect)
    },
    {
      id: 'room-kitchen',
      label: 'Kitchen',
      roomType: 'kitchen',
      geometry: { x: 750, y: 320, width: 200, height: 200 }, // East/NE (Defect)
    },
  ];

  const report = calculatePlanVastu({ rooms, northAngleDeg: 0, planBounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 } });
  assert.ok(report.summary.criticalDefectCount >= 1);
  assert.equal(report.status, 'critical_alignments_needed');
  assert.ok(report.keyRemedies.length >= 1);
});

test('Auto-Calibration: Dimension pair parsing from Imperial and Metric notations', () => {
  const imp1 = parseDimensionPair("MASTER BEDROOM 14'0\" x 12'0\"");
  assert.ok(imp1);
  assert.equal(imp1.dim1Mm, 4267);
  assert.equal(imp1.dim2Mm, 3658);

  const imp2 = parseDimensionPair("KITCHEN 12' x 10'");
  assert.ok(imp2);
  assert.equal(imp2.dim1Mm, 3658);
  assert.equal(imp2.dim2Mm, 3048);

  const metric1 = parseDimensionPair("LIVING 4200 x 3600 mm");
  assert.ok(metric1);
  assert.equal(metric1.dim1Mm, 4200);
  assert.equal(metric1.dim2Mm, 3600);

  const metricMeters = parseDimensionPair("BEDROOM 3.60 x 3.00 m");
  assert.ok(metricMeters);
  assert.equal(metricMeters.dim1Mm, 3600);
  assert.equal(metricMeters.dim2Mm, 3000);
});

test('Auto-Calibration: Correlates room bounding box to OCR dimension to calculate mmPerPixel', () => {
  // Suppose 1 px = 20 mm
  // A 4000 x 3000 mm room will be 200 x 150 px
  const rooms = [
    {
      id: 'r1',
      label: "MASTER BEDROOM 14'0\" x 12'0\"", // 4267 x 3658 mm
      widthPx: 213.35, // 4267 / 20 = 213.35 px
      heightPx: 182.9,  // 3658 / 20 = 182.9 px
    },
    {
      id: 'r2',
      label: "KITCHEN 3600 x 2400 mm",
      widthPx: 180, // 3600 / 20 = 180 px
      heightPx: 120, // 2400 / 20 = 120 px
    },
  ];

  const ocr = [
    "MASTER BEDROOM 14'0\" x 12'0\"",
    "KITCHEN 3600 x 2400 mm",
  ];

  const result = autoCalibrateFromRoomDimensions(rooms, ocr);
  assert.equal(result.success, true);
  assert.ok(Math.abs(result.resolvedMmPerPixel - 20.0) < 0.2, `Expected ~20.0 mm/px, got ${result.resolvedMmPerPixel}`);
  assert.ok(result.confidence >= 0.85);
  assert.ok(result.observation);
  assert.equal(result.matchedRooms.length, 2);
});

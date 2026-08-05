import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  // coordinate spaces
  sourceImageToWorld, worldToSourceImage,
  createWallFrame, wallLocalToWorld, worldToWallLocal,
  worldToRoomLocal, roomLocalToWorld, worldToRenderer, rendererToWorld,
  convertToMm, convertFromMm,
  // scale
  resolveScale, manualTwoPointObservation, ScaleObservationSchema,
  // builders
  buildCanonicalWall, anchorOpening, buildRoomPolygon, shoelaceAreaMm2, polygonPerimeterMm, polygonCentroid,
  // validation
  validateGeometry, IssueCode,
} from '../src/index.js';

const EPS = 1e-6;

// A known 4000mm (X) x 3000mm (Z) room, origin at world (0,0).
const ROOM_WORLD: Array<{ xMm: number; zMm: number }> = [
  { xMm: 0, zMm: 0 },
  { xMm: 4000, zMm: 0 },
  { xMm: 4000, zMm: 3000 },
  { xMm: 0, zMm: 3000 },
  { xMm: 0, zMm: 0 },
];

test('unit conversions', () => {
  assert.strictEqual(convertToMm(10, 'cm'), 100);
  assert.strictEqual(convertToMm(2, 'm'), 2000);
  assert.strictEqual(convertToMm(1, 'in'), 25.4);
  assert.strictEqual(convertFromMm(3048, 'ft'), 10);
});

test('source-image <-> world round trip (transformation round trip)', () => {
  const ref = { originPx: { x: 100, y: 100 }, mmPerPixel: 10.0, rotationRad: 0 };
  const world = sourceImageToWorld({ xPx: 200, yPx: 300 }, ref);
  assert.strictEqual(world.xMm, 1000);
  assert.strictEqual(world.zMm, 2000);
  const back = worldToSourceImage(world, ref);
  assert.ok(Math.abs(back.xPx - 200) < 1e-9);
  assert.ok(Math.abs(back.yPx - 300) < 1e-9);
});

test('all five coordinate spaces round trip within 1mm', () => {
  // wall-local
  const start = { xMm: 0, zMm: 0 };
  const end = { xMm: 4000, zMm: 0 };
  const frame = createWallFrame(start, end, 0);
  const w = wallLocalToWorld({ offsetAlongMm: 1234, offsetFromMm: 200, heightMm: 1500 }, frame);
  const back = worldToWallLocal(w, frame);
  assert.ok(Math.abs(back.offsetAlongMm - 1234) < 1e-6);
  assert.ok(Math.abs(back.offsetFromMm - 200) < 1e-6);
  assert.ok(Math.abs(back.heightMm - 1500) < 1e-6);
  // room-local
  const room = { originXMm: 0, originZMm: 0 };
  const rl = worldToRoomLocal({ xMm: 2500, zMm: 1800 }, room);
  const rw = roomLocalToWorld(rl, room);
  assert.ok(Math.abs(rw.xMm - 2500) < 1e-6 && Math.abs(rw.zMm - 1800) < 1e-6);
  // renderer
  const r = worldToRenderer({ xMm: 10, yMm: 20, zMm: 30 });
  const w2 = rendererToWorld(r);
  assert.deepEqual(r, [10, 20, 30]);
  assert.ok(Math.abs(w2.xMm - 10) < 1e-6);
});

test('known wall length: canonical wall is 4000mm with interior normal', () => {
  const wall = buildCanonicalWall(
    { id: 'w-bottom', start: { xMm: 0, zMm: 0 }, end: { xMm: 4000, zMm: 0 }, heightMm: 2700 },
    [{ id: 'room-1', centroid: { xMm: 2000, zMm: 1500 } }]
  );
  assert.ok(Math.abs(wall.lengthMm - 4000) < EPS);
  assert.strictEqual(wall.heightMm, 2700);
  // interior normal points into the room (+Z), since wall runs +X and room is above (+Z)
  assert.ok(Math.abs(wall.interiorNormal.x) < 1e-6);
  assert.ok(wall.interiorNormal.y > 0.99);
  assert.ok(wall.adjacentSpaces.includes('room-1'));
});

test('known door width: anchored door keeps 1000mm width and correct offset', () => {
  const wall = buildCanonicalWall({ id: 'w-bottom', start: { xMm: 0, zMm: 0 }, end: { xMm: 4000, zMm: 0 } });
  // Door centered at 2000mm along the wall (x=2000, z=0).
  const door = anchorOpening(
    { id: 'd1', wallId: 'w-bottom', world: { xMm: 2000, zMm: 0 }, widthMm: 1000, type: 'door' },
    wall
  );
  assert.strictEqual(door.widthMm, 1000);
  assert.ok(Math.abs(door.offsetMm - 2000) < 1e-6);
});

test('known window offset: window anchored at 3000mm offset', () => {
  const wall = buildCanonicalWall({ id: 'w-right', start: { xMm: 4000, zMm: 0 }, end: { xMm: 4000, zMm: 3000 } });
  // Window at (4000, 1200) on the right wall -> offset 1200mm from start.
  const win = anchorOpening(
    { id: 'w1', wallId: 'w-right', world: { xMm: 4000, zMm: 1200 }, widthMm: 1200, type: 'window' },
    wall
  );
  assert.strictEqual(win.widthMm, 1200);
  assert.ok(Math.abs(win.offsetMm - 1200) < 1e-6);
});

test('room area: 4000x3000 = 12.0 m^2 exactly', () => {
  const room = buildRoomPolygon({
    id: 'room-1',
    sourcePolygon: ROOM_WORLD.map((p) => ({ x: p.xMm, y: p.zMm })),
    worldPolygon: ROOM_WORLD,
    ceilingHeightMm: 2700,
  });
  assert.ok(Math.abs(room.areaMm2 - 12_000_000) < EPS);
  assert.ok(Math.abs(room.areaSqm - 12.0) < 1e-9);
  assert.ok(Math.abs(room.perimeterMm - 14000) < EPS);
  assert.ok(Math.abs(room.centroid.xMm - 2000) < 1e-6);
  assert.ok(Math.abs(room.centroid.zMm - 1500) < 1e-6);
});

test('scale reconciliation: manual calibration resolves verified 10mm/px', () => {
  const obs = manualTwoPointObservation({
    id: 'cal-1',
    pointA: { xPx: 0, yPx: 0 },
    pointB: { xPx: 100, yPx: 0 },
    realWorldDistanceMm: 1000,
    verified: true,
  });
  ScaleObservationSchema.parse(obs); // valid schema
  const res = resolveScale([obs]);
  assert.strictEqual(res.isVerified, true);
  assert.ok(Math.abs(res.resolvedMmPerPixel - 10.0) < 1e-9);
  assert.strictEqual(res.resolutionMethod, 'manual_two_point_calibration');
});

test('scale priority: verified dimension beats AI estimate', () => {
  const ai = manualTwoPointObservation({ id: 'ai', pointA: { xPx: 0, yPx: 0 }, pointB: { xPx: 100, yPx: 0 }, realWorldDistanceMm: 500, verified: false });
  ai.source = 'ai_low_confidence_estimate';
  ai.method = 'ai_low_confidence_estimate';
  ai.verificationState = 'unverified';
  const verified = manualTwoPointObservation({ id: 'v', pointA: { xPx: 0, yPx: 0 }, pointB: { xPx: 100, yPx: 0 }, realWorldDistanceMm: 1000, verified: true });
  verified.source = 'verified_written_dimension';
  verified.method = 'verified_written_dimension';
  const res = resolveScale([ai, verified]);
  assert.strictEqual(res.isVerified, true);
  assert.strictEqual(res.resolutionMethod, 'verified_written_dimension');
  assert.ok(Math.abs(res.resolvedMmPerPixel - 10.0) < 1e-6);
});

test('scale inconsistency detection: conflicting observations flagged', () => {
  const a = manualTwoPointObservation({ id: 'a', pointA: { xPx: 0, yPx: 0 }, pointB: { xPx: 100, yPx: 0 }, realWorldDistanceMm: 1000, verified: true });
  const b = manualTwoPointObservation({ id: 'b', pointA: { xPx: 0, yPx: 0 }, pointB: { xPx: 100, yPx: 0 }, realWorldDistanceMm: 1400, verified: true });
  const res = resolveScale([a, b]);
  assert.strictEqual(res.anomalies.inconsistentDimensions, true);
  assert.strictEqual(res.isVerified, false);
});

test('X/Y distortion detection', () => {
  // Horizontal obs says 10mm/px; vertical obs says 15mm/px -> anisotropic.
  const h = manualTwoPointObservation({ id: 'h', pointA: { xPx: 0, yPx: 0 }, pointB: { xPx: 100, yPx: 0 }, realWorldDistanceMm: 1000, verified: true });
  const v = manualTwoPointObservation({ id: 'v', pointA: { xPx: 0, yPx: 0 }, pointB: { xPx: 0, yPx: 100 }, realWorldDistanceMm: 1500, verified: true });
  const res = resolveScale([h, v]);
  assert.strictEqual(res.xyDistortion.detected, true);
  assert.ok(res.xyDistortion.ratio > 0.1);
});

test('validation: unverified scale blocks approval', () => {
  const issues = validateGeometry({
    scaleVerified: false,
    walls: [buildCanonicalWall({ id: 'w1', start: { xMm: 0, zMm: 0 }, end: { xMm: 4000, zMm: 0 }, heightMm: 2700 })],
    openings: [],
    rooms: [{ id: 'r1', worldPolygon: ROOM_WORLD, ceilingHeightMm: 2700 }],
  });
  assert.ok(issues.some((i) => i.code === IssueCode.UNVERIFIED_SCALE && i.severity === 'critical'));
});

test('validation: zero-length wall, open boundary, missing heights all detected', () => {
  const issues = validateGeometry({
    scaleVerified: true,
    walls: [
      buildCanonicalWall({ id: 'w0', start: { xMm: 0, zMm: 0 }, end: { xMm: 0, zMm: 0 }, heightMm: 0 }), // zero length + missing height
    ],
    openings: [],
    rooms: [{ id: 'r1', worldPolygon: [{ xMm: 0, zMm: 0 }, { xMm: 1000, zMm: 0 }, { xMm: 1000, zMm: 1000 }], ceilingHeightMm: 0 }], // open (3 pts, not closed) + no ceiling
  });
  const codes = issues.map((i) => i.code);
  assert.ok(codes.includes(IssueCode.ZERO_LENGTH_WALL));
  assert.ok(codes.includes(IssueCode.MISSING_WALL_HEIGHT));
  assert.ok(codes.includes(IssueCode.OPEN_BOUNDARY));
  assert.ok(codes.includes(IssueCode.MISSING_CEILING_HEIGHT));
});

test('validation: opening outside wall and wider than wall detected', () => {
  const wall = buildCanonicalWall({ id: 'w1', start: { xMm: 0, zMm: 0 }, end: { xMm: 2000, zMm: 0 }, heightMm: 2700 });
  // opening centered at 2500mm (outside 2000mm wall) and 3000mm wide (wider than wall)
  const issues = validateGeometry({
    scaleVerified: true,
    walls: [wall],
    openings: [
      anchorOpening({ id: 'o1', wallId: 'w1', world: { xMm: 2500, zMm: 0 }, widthMm: 3000, type: 'door' }, wall),
    ],
    rooms: [{ id: 'r1', worldPolygon: ROOM_WORLD, ceilingHeightMm: 2700 }],
  });
  const codes = issues.map((i) => i.code);
  assert.ok(codes.includes(IssueCode.OPENING_OUTSIDE_WALL));
  assert.ok(codes.includes(IssueCode.OPENING_WIDER_THAN_WALL));
});

test('validation: clean verified plan passes with no critical issues', () => {
  const walls = [
    buildCanonicalWall({ id: 'w-bottom', start: { xMm: 0, zMm: 0 }, end: { xMm: 4000, zMm: 0 }, heightMm: 2700 }, [{ id: 'r1', centroid: { xMm: 2000, zMm: 1500 } }]),
    buildCanonicalWall({ id: 'w-right', start: { xMm: 4000, zMm: 0 }, end: { xMm: 4000, zMm: 3000 }, heightMm: 2700 }, [{ id: 'r1', centroid: { xMm: 2000, zMm: 1500 } }]),
    buildCanonicalWall({ id: 'w-top', start: { xMm: 4000, zMm: 3000 }, end: { xMm: 0, zMm: 3000 }, heightMm: 2700 }, [{ id: 'r1', centroid: { xMm: 2000, zMm: 1500 } }]),
    buildCanonicalWall({ id: 'w-left', start: { xMm: 0, zMm: 3000 }, end: { xMm: 0, zMm: 0 }, heightMm: 2700 }, [{ id: 'r1', centroid: { xMm: 2000, zMm: 1500 } }]),
  ];
  const issues = validateGeometry({
    scaleVerified: true,
    walls,
    openings: [
      anchorOpening({ id: 'd1', wallId: 'w-bottom', world: { xMm: 2000, zMm: 0 }, widthMm: 1000, type: 'door' }, walls[0]),
      anchorOpening({ id: 'w1', wallId: 'w-right', world: { xMm: 4000, zMm: 1200 }, widthMm: 1200, type: 'window' }, walls[1]),
    ],
    rooms: [{ id: 'r1', worldPolygon: ROOM_WORLD, ceilingHeightMm: 2700 }],
  });
  const critical = issues.filter((i) => i.severity === 'critical');
  assert.strictEqual(critical.length, 0, `unexpected critical issues: ${JSON.stringify(issues)}`);
});

test('maximum geometry deviation of 1mm: rounded wall stays within tolerance of ideal', () => {
  // Build wall from source pixels through scale, compare to known world length.
  const ref = { originPx: { x: 0, y: 0 }, mmPerPixel: 5.0, rotationRad: 0 };
  const a = sourceImageToWorld({ xPx: 0, yPx: 0 }, ref);
  const b = sourceImageToWorld({ xPx: 800, yPx: 0 }, ref); // 800px * 5mm = 4000mm
  const wall = buildCanonicalWall({ id: 'w', start: a, end: b, heightMm: 2700 });
  assert.ok(Math.abs(wall.lengthMm - 4000) < 1e-6); // exact here; tolerance guard for real rounding
  assert.ok(Math.abs(wall.lengthMm - 4000) <= 1, 'deviation exceeds 1mm');
});

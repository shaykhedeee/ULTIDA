import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCanvas, projectPoint, unprojectPoint } from '../src/features/spaces/canvas-projection';

test('room corners fit inside padding and centre in wide and tall rooms', () => {
  for (const [width, height] of [[6930, 5280], [1000, 9000], [12000, 1000]]) {
    const corners = [{ xMm: -2000, yMm: 700 }, { xMm: width - 2000, yMm: height + 700 }];
    const view = fitCanvas(corners);
    const [a, b] = corners.map(p => projectPoint(p, view));
    assert.ok(a.x >= 40 - 1e-9 && a.y >= 40 - 1e-9);
    assert.ok(b.x <= 720 + 1e-9 && b.y <= 440 + 1e-9);
    assert.ok(Math.abs((a.x + b.x) / 2 - 380) < 1e-9);
    assert.ok(Math.abs((a.y + b.y) / 2 - 240) < 1e-9);
  }
});

test('measured placement coordinates round-trip after viewport zoom and pan', () => {
  const view = fitCanvas([{ xMm: -2000, yMm: 700 }, { xMm: 4930, yMm: 5980 }]);
  const point = { xMm: 1275.5, yMm: 2400.25 };
  const local = projectPoint(point, view);
  for (const zoom of [0.4, 1, 1.5, 3.5]) {
    const originX = (view.w - view.w / zoom) / 2 - 71;
    const originY = (view.h - view.h / zoom) / 2 + 19;
    // Screen CTM inversion restores SVG coordinates before unprojection.
    const screen = { x: (local.x - originX) * zoom, y: (local.y - originY) * zoom };
    const restored = unprojectPoint(screen.x / zoom + originX, screen.y / zoom + originY, view);
    assert.ok(Math.abs(restored.xMm - point.xMm) < 1e-8);
    assert.ok(Math.abs(restored.yMm - point.yMm) < 1e-8);
  }
});

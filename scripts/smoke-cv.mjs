import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcilePlan } from '../apps/api/dist/plan/reconcile_plan.js';

const execFileAsync = promisify(execFile);
const python = process.env.CV_PYTHON_PATH || 'python3';

// Run the real OpenCV wall-tracer on the proof floor-plan image
const proofImg = new URL('../floorplan analyser/ultida-flow-kit/proof/test_floorplan_input.png', import.meta.url);
const dir = await mkdtemp(join(tmpdir(), 'ultida-smoke-'));
const inPath = join(dir, 'plan.png');
const outPath = join(dir, 'trace.json');
const imgBytes = await readFile(proofImg);
await writeFile(inPath, imgBytes);
await execFileAsync(python, ['apps/api/cv/wall_tracer.py', inPath, outPath], { timeout: 60000, windowsHide: true });
const cv = JSON.parse(await readFile(outPath, 'utf8'));

// A vision-shaped semantic result (stand-in for what the vision provider returns)
const vision = {
  rooms: [{ label: 'Living', roomType: 'living', approxPolygonPx: [
    { x: 40, y: 40 }, { x: 1040, y: 40 }, { x: 1040, y: 400 }, { x: 40, y: 400 } ], confidence: 0.8 }],
  openings: [{ kind: 'door', approxCenterPx: { x: 540, y: 40 }, approxWidthPx: 90, confidence: 0.7 }],
  dimensionTextFindings: [],
};

const reconciled = reconcilePlan(cv, vision);
console.log('CV walls:', cv.walls.length, 'openings:', cv.openings.length);
console.log('Reconciled rooms:', reconciled.rooms.length, '| walls:', reconciled.walls.length);
console.log('Reconciled scale (mmPerPixel):', reconciled.scale?.mmPerPixel);
console.log('SMOKE_OK');
await rm(dir, { recursive: true, force: true });

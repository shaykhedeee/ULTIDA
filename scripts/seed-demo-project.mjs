import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envPath = new URL('../.env', import.meta.url);
const envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL/SECRET in .env'); process.exit(1); }
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Reuse the org + user from the first existing project so the demo data is
// visible to the real signed-in studio member (same org, RLS-friendly).
const { data: existing, error: exErr } = await client
  .from('projects').select('organization_id, created_by').order('created_at').limit(1).single();
if (exErr || !existing) { console.error('Could not find a base project/org:', exErr?.message); process.exit(1); }
const ORG = existing.organization_id;
const USER = existing.created_by;
console.log('Seeding under org', ORG, 'user', USER);

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const FP_ID = '22222222-2222-2222-2222-222222222222';
const SCENE_ID = '33333333-3333-3333-3333-333333333333';

async function upsert(table, rows) {
  let attemptRows = rows;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await client.from(table).upsert(attemptRows, { onConflict: 'id' });
    if (!error) { console.log(`  + ${table}: ${rows.length} row(s)`); return; }
    const colM = error.message.match(/Could not find the '([^']+)' column/);
    if (colM) {
      const bad = colM[1];
      console.warn(`  ! ${table}: dropping unknown column '${bad}'`);
      attemptRows = attemptRows.map(({ [bad]: _omit, ...rest }) => rest);
      continue;
    }
    if (/Could not find the table/.test(error.message)) {
      console.warn(`  ! ${table}: TABLE MISSING in live DB — skipped (apply migrations to populate)`);
      return;
    }
    console.error(`UPSERT ${table} FAILED:`, error.message); process.exit(1);
  }
  console.error(`UPSERT ${table} exhausted retries`); process.exit(1);
}

// 1) Project
await upsert('projects', [{
  id: PROJECT_ID, organization_id: ORG, name: 'Riverside Residence — 3BHK',
  client_name: 'Mr. & Mrs. Sharma', workflow_stage: 'render',
  project_status: 'active', created_by: USER,
}]);

// 2) Project brief
await upsert('project_briefs', [{
  id: '44444444-4444-4444-4444-444444444444',
  project_id: PROJECT_ID, client_name: 'Mr. & Mrs. Sharma',
  client_email: 'sharma.family@example.com', site_location: 'Powai, Mumbai',
  property_type: 'apartment', num_bedrooms: 3, is_renovation: false,
  ceiling_height_mm: 2700, budget_inr: 1850000, measurement_units: 'mm',
  style_preferences: ['contemporary_minimal', 'warm_modern'],
  room_requirements: { living: { seatingCount: 5, tvSizeInch: 55, poojaUnit: true },
    master_bedroom: { bedSize: 'king', wardrobeType: 'walk_in' },
    kitchen: { shape: 'l_shaped', hob: '4_burner', chimney: true } },
  created_by: USER,
}]);

// 3) Floor plan version (approved, with canonical geometry + CV candidate)
const canonical = {
  schemaVersion: 'plan.v1', units: 'mm', coordinateSystem: 'right-handed-z-up',
  scale: { pointA: { x: 40, y: 40 }, pointB: { x: 1040, y: 40 }, pixelDistance: 1000, realDistanceMm: 9000, mmPerPixel: 9 },
  ceilingHeightMm: 2700,
  walls: [
    { id: 'w1', sourceGeometry: { x1: 40, y1: 40, x2: 1040, y2: 40 }, worldGeometry: { start: { xMm: 360, yMm: 2700 }, end: { xMm: 9360, yMm: 2700 } } },
    { id: 'w2', sourceGeometry: { x1: 1040, y1: 40, x2: 1040, y2: 760 }, worldGeometry: { start: { xMm: 9360, yMm: 2700 }, end: { xMm: 9360, yMm: 360 } } },
    { id: 'w3', sourceGeometry: { x1: 1040, y1: 760, x2: 40, y2: 760 }, worldGeometry: { start: { xMm: 9360, yMm: 360 }, end: { xMm: 360, yMm: 360 } } },
    { id: 'w4', sourceGeometry: { x1: 40, y1: 760, x2: 40, y2: 40 }, worldGeometry: { start: { xMm: 360, yMm: 360 }, end: { xMm: 360, yMm: 2700 } } },
    { id: 'w5', sourceGeometry: { x1: 540, y1: 40, x2: 540, y2: 400 }, worldGeometry: { start: { xMm: 5220, yMm: 2700 }, end: { xMm: 5220, yMm: 1440 } } },
  ],
  rooms: [
    { id: 'r-living', sourceGeometry: { x: 540, y: 40, width: 500, height: 360 }, worldGeometry: { polygon: [{ xMm: 5220, yMm: 2700 }, { xMm: 9720, yMm: 2700 }, { xMm: 9720, yMm: 900 }, { xMm: 5220, yMm: 900 }] }, areaSqm: 32.4 },
    { id: 'r-master', sourceGeometry: { x: 40, y: 40, width: 500, height: 360 }, worldGeometry: { polygon: [{ xMm: 360, yMm: 2700 }, { xMm: 5220, yMm: 2700 }, { xMm: 5220, yMm: 900 }, { xMm: 360, yMm: 900 }] }, areaSqm: 34.0 },
    { id: 'r-kitchen', sourceGeometry: { x: 40, y: 400, width: 500, height: 360 }, worldGeometry: { polygon: [{ xMm: 360, yMm: 900 }, { xMm: 5220, yMm: 900 }, { xMm: 5220, yMm: 360 }, { xMm: 360, yMm: 360 }] }, areaSqm: 30.0 },
  ],
  openings: [
    { id: 'o1', wallId: 'w1', offsetAlongWallMm: 4500 },
    { id: 'o2', wallId: 'w3', offsetAlongWallMm: 3000 },
  ],
  unresolvedItems: [],
};
await upsert('floor_plan_versions', [{
  id: FP_ID, organization_id: ORG, project_id: PROJECT_ID, version_number: 1,
  status: 'approved', source_asset_id: null, spatial_model: canonical,
  canonical_model: canonical,
  scale_state: { pointA: { x: 40, y: 40 }, pointB: { x: 1040, y: 40 }, pixelDistance: 1000, realDistanceMm: 9000, mmPerPixel: 9, calibratedBy: 'designer' },
  verification_state: { calibrated: true, minConfidence: 0.9 },
  schema_version: 'plan.v1', confidence_min: 0.9, review_status: 'approved',
  reviewed_by: USER, reviewed_at: new Date().toISOString(), created_by: USER,
}]);

// 4) Spaces (derived from approved plan)
const spaces = [
  { id: '55555555-5555-5555-5555-555555555555', name: 'Living Room', room_type: 'living', area_sqm: 32.4, ceiling_height_mm: 2700, status: 'approved', geometry_json: { walls: canonical.walls.slice(0, 2) } },
  { id: '66666666-6666-6666-6666-666666666666', name: 'Master Bedroom', room_type: 'master_bedroom', area_sqm: 34.0, ceiling_height_mm: 2700, status: 'approved', geometry_json: {} },
  { id: '77777777-7777-7777-7777-777777777777', name: 'Kitchen', room_type: 'kitchen', area_sqm: 30.0, ceiling_height_mm: 2700, status: 'configured', geometry_json: {} },
];
for (const s of spaces) {
  await upsert('spaces', [{ ...s, organization_id: ORG, project_id: PROJECT_ID, floor_plan_version_id: FP_ID, created_by: USER }]);
}

// 5) Layouts + module instances for living room
await upsert('layouts', [{
  id: '88888888-8888-8888-8888-888888888888', organization_id: ORG, project_id: PROJECT_ID,
  space_id: '55555555-5555-5555-5555-555555555555', layout_shape: 'tv-opposite-sofa',
  label: 'Option A — TV opposite sofa', status: 'approved', approved_by: USER, approved_at: new Date().toISOString(),
  candidate_json: { placements: [{ module: 'tv-full-wall', wall: 'w1', clearanceMm: 450 }, { module: 'sofa-3seater', wall: 'w3', clearanceMm: 600 }] },
  rule_score_json: { score: 0.92, violations: [] }, created_by: USER,
}]);
await upsert('module_instances', [{
  id: '99999999-9999-9999-9999-999999999999', organization_id: ORG, project_id: PROJECT_ID,
  layout_id: '88888888-8888-8888-8888-888888888888', template_id: 'tv-full-wall-profile-v1',
  category: 'tv-unit', label: 'Full-wall TV unit', status: 'approved',
  config_json: { widthMm: 3600, heightMm: 2400, finish: 'matte-oak', led: true },
  validation_json: { valid: true, issues: [] }, position_json: { wall: 'w1', offsetMm: 0 }, created_by: USER,
}]);

// 6) Scene version
const scene = {
  schema: 'scene.v1', units: 'mm', projectId: PROJECT_ID, floorPlanVersionId: FP_ID,
  rooms: canonical.rooms, walls: canonical.walls, openings: canonical.openings,
  modules: [{ id: 'm1', roomId: 'r-living', family: 'tv-unit', widthMm: 3600, depthMm: 400, heightMm: 2400, position: { xMm: 5220, yMm: 2700 }, rotationDeg: 0, anchor: 'floor', confidence: 1 }],
  materials: [{ slot: 'shutter', key: 'matte-oak' }], lighting: [], cameras: [],
  coordinateSystem: 'right-handed-z-up',
  metadata: { branch: 'main', status: 'approved', schemaVersion: 'scene.v1', designVersion: '1.0.0' },
};
await upsert('scene_versions', [{
  id: SCENE_ID, organization_id: ORG, project_id: PROJECT_ID, floor_plan_version_id: FP_ID,
  version_number: 1, branch_name: 'main', status: 'approved', scene,
  change_reason: 'Demo seed', created_by: USER,
}]);

// 7) Quote (commercial)
await upsert('quotes', [{
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', organization_id: ORG, project_id: PROJECT_ID,
  scene_version_id: SCENE_ID, version_number: 1, status: 'approved',
  items: [
    { category: 'tv-unit', label: 'Full-wall TV unit 3.6m', qty: 1, unitInr: 145000, totalInr: 145000 },
    { category: 'kitchen', label: 'L-shaped modular kitchen', qty: 1, unitInr: 420000, totalInr: 420000 },
    { category: 'wardrobe', label: 'Walk-in wardrobe', qty: 1, unitInr: 310000, totalInr: 310000 },
  ],
  subtotal_inr: 875000, discount_inr: 25000, margin_rate: 0.18, margin_inr: 153000,
  gst_rate: 0.18, gst_inr: 153000, taxable_inr: 850000, total_amount: 1003000,
  currency: 'INR', created_by: USER,
}]);

// 8) Approvals trail
await upsert('approvals', [
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', organization_id: ORG, project_id: PROJECT_ID, stage: 'plan', entity_type: 'floor_plan_version', entity_id: FP_ID, status: 'approved', approved_by: USER },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', organization_id: ORG, project_id: PROJECT_ID, stage: 'spaces', status: 'approved', approved_by: USER },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', organization_id: ORG, project_id: PROJECT_ID, stage: 'layout', entity_type: 'layout', entity_id: '88888888-8888-8888-8888-888888888888', status: 'approved', approved_by: USER },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', organization_id: ORG, project_id: PROJECT_ID, stage: 'scene', entity_type: 'scene_version', entity_id: SCENE_ID, status: 'approved', approved_by: USER },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', organization_id: ORG, project_id: PROJECT_ID, stage: 'estimate', entity_type: 'quote', entity_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', status: 'approved', approved_by: USER },
]);

// 9) Workflow stage status
await upsert('workflow_stage_status', [
  { organization_id: ORG, project_id: PROJECT_ID, stage: 'brief', status: 'complete', updated_by: USER },
  { organization_id: ORG, project_id: PROJECT_ID, stage: 'floor_plan', status: 'complete', updated_by: USER },
  { organization_id: ORG, project_id: PROJECT_ID, stage: 'spaces', status: 'complete', updated_by: USER },
  { organization_id: ORG, project_id: PROJECT_ID, stage: 'layout', status: 'complete', updated_by: USER },
  { organization_id: ORG, project_id: PROJECT_ID, stage: 'modules', status: 'complete', updated_by: USER },
  { organization_id: ORG, project_id: PROJECT_ID, stage: '3d_scene', status: 'complete', updated_by: USER },
  { organization_id: ORG, project_id: PROJECT_ID, stage: 'render', status: 'in_progress', updated_by: USER },
  { organization_id: ORG, project_id: PROJECT_ID, stage: 'production', status: 'blocked', updated_by: USER },
]);

console.log('\n✅ DEMO PROJECT SEEDED — id', PROJECT_ID);

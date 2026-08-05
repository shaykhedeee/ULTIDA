import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dirname, '..', '.env'), 'utf8');
for (const line of envText.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);
const { data: auth } = await sb.auth.signInWithPassword({ email: 'zebbroka@gmail.com', password: '12345678' });
const token = auth.session.access_token;
const PROJECT = '11111111-1111-1111-1111-111111111111';
const { data, error } = await sb.from('floor_plan_versions').select('id,status,spatial_model,scale_verified,active_version,approved_at').eq('project_id', PROJECT);
console.log('error', error?.message);
console.log('rows', data?.length);
for (const r of data ?? []) {
  const sm = r.spatial_model || {};
  console.log('id', r.id, 'status', r.status, 'scaleVerified', r.scale_verified, 'active', r.active_version, 'approved', r.approved_at);
  console.log('  spatial_model keys', Object.keys(sm));
  console.log('  rooms', (sm.rooms || sm.spaces || []).length, 'walls', (sm.walls || []).length, 'openings', (sm.openings || []).length);
  console.log('  sample room', JSON.stringify((sm.rooms || sm.spaces || [])[0]));
}

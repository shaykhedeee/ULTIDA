import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
const envText = readFileSync(envPath, 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const sb = createClient(url, key);
const PROJECT = '11111111-1111-1111-1111-111111111111';

const { data, error } = await sb.auth.signInWithPassword({ email: 'zebbroka@gmail.com', password: '12345678' });
if (error) { console.error('AUTH FAIL', error.message); process.exit(1); }
const token = data.session.access_token;
const base = 'http://127.0.0.1:8800/api';
const res = await fetch(`${base}/projects/${PROJECT}/floor-plan/active`, { headers: { authorization: `Bearer ${token}` } });
const payload = await res.json();
console.log('status', res.status, 'success', payload.success);
if (payload.success) {
  console.log('floorPlanVersionId', payload.floorPlanVersionId);
  console.log('scaleVerified', payload.scaleVerified, 'ceiling', payload.ceilingHeightMm);
  console.log('rooms', payload.rooms?.length, 'walls', payload.walls?.length, 'openings', payload.openings?.length);
  console.log('columns', payload.columns?.length, 'beams', payload.beams?.length, 'services', payload.services?.length);
  console.log('issues', payload.issues?.length, 'annotations', payload.annotations?.length);
  console.log('first room', JSON.stringify(payload.rooms?.[0]?.polygon?.slice(0,2)));
} else {
  console.log('MESSAGE', payload.message, 'CODE', payload.code);
}

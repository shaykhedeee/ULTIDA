import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
const envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.ULTIDA_TEST_EMAIL;
const password = process.env.ULTIDA_TEST_PASSWORD;
if (!url || !key || !email || !password || !process.env.ULTIDA_TEST_PROJECT_ID) {
  console.error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ULTIDA_TEST_EMAIL, ULTIDA_TEST_PASSWORD and ULTIDA_TEST_PROJECT_ID in a local untracked environment file before running this diagnostic.');
  process.exit(1);
}
const sb = createClient(url, key);
const PROJECT = process.env.ULTIDA_TEST_PROJECT_ID;

const { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error) { console.error('AUTH FAIL', error.message); process.exit(1); }
const token = data.session.access_token;
const base = (process.env.ULTIDA_API_BASE ?? 'http://127.0.0.1:8800/api').replace(/\/$/, '');
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

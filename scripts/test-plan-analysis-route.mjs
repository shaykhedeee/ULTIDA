import { config } from 'dotenv';
config({ path: '../../.env' });
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.auth.signInWithPassword({ email: 'zebbroka@gmail.com', password: '12345678' });
if (error) { console.error('AUTH_FAIL', error.message); process.exit(1); }
const token = data.session.access_token;
console.log('signed in as', data.user.email);

const projectId = '11111111-1111-1111-1111-111111111111';
const imgPath = join(process.cwd(), '..', 'floorplan analyser', 'ultida-flow-kit', 'proof', 'test_floorplan_input.png');
const buf = await readFile(imgPath);
const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;

const apiBase = 'http://127.0.0.1:8800/api';
const res = await fetch(`${apiBase}/projects/${projectId}/plan-analysis`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ fileName: 'test_floorplan_input.png', mimeType: 'image/png', dataUrl, assetId: null }),
});
const payload = await res.json().catch(() => null);
console.log('HTTP', res.status);
if (payload) {
  console.log('analysisId:', payload.analysisId);
  console.log('provenance:', JSON.stringify(payload.provenance));
  console.log('persisted:', payload.persisted, payload.persistence || '');
  console.log('elements:', (payload.elements || []).length, 'issues:', (payload.issues || []).length);
  console.log('sample element:', JSON.stringify((payload.elements || [])[0]));
}

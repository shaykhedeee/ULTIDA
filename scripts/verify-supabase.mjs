import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = existsSync(resolve(root, '.env')) ? Object.fromEntries(readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; })) : {};
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const requiredMigrations = ['202607200001_foundation.sql', '202607200002_onboarding_policy_hardening.sql', '202607200003_project_brief.sql', '202607200004_scene_creation_gate.sql', '202607200005_reference_library.sql', '202607200006_delivery_records.sql', '202607210001_quotes_and_handover.sql'];
const present = new Set(readdirSync(resolve(root, 'supabase/migrations')));
const missing = requiredMigrations.filter((name) => !present.has(name));
if (missing.length) throw new Error(`Missing local migrations: ${missing.join(', ')}`);
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in .env.');
const headers = { apikey: key, Authorization: `Bearer ${key}` };
for (const table of ['projects', 'project_assets', 'floor_plan_versions', 'scene_versions', 'jobs', 'artifacts', 'reference_library_items', 'quotes']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers });
  if (!response.ok) throw new Error(`Supabase table check failed for ${table}: ${response.status} ${await response.text()}`);
  console.log(`PASS table ${table}`);
}
const bucket = await fetch(`${url}/storage/v1/bucket/project-assets`, { headers });
if (!bucket.ok && !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) { console.warn(`WARN storage bucket API check requires a server-only Supabase secret key (${bucket.status}); verify with Supabase dashboard or MCP.`); console.log('Supabase verification complete with publishable-key checks.'); process.exit(0); }
if (!bucket.ok) throw new Error(`Supabase project-assets bucket check failed: ${bucket.status} ${await bucket.text()}`);
const bucketData = await bucket.json();
if (bucketData.public === true) throw new Error('project-assets must remain private.');
console.log('PASS private storage bucket project-assets');
console.log('Supabase verification complete.');

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Load .env from repo root (same file the API uses via dotenv)
const envPath = new URL('../.env', import.meta.url);
const envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  process.exit(1);
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await client.from('projects').select('id').limit(1);
if (error) {
  console.error('SUPABASE_CONNECT_ERROR:', error.message);
  process.exit(1);
}
console.log('SUPABASE_OK existing_projects=', data?.length ?? 0);

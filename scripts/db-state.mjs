import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const t of ['projects','project_briefs','floor_plan_versions','spaces','layouts','module_instances','scene_versions','quotes','workflow_stage_status','approvals']) {
  const { data, error, count } = await client.from(t).select('*', { count: 'exact', head: true });
  console.log(t.padEnd(22), error ? `ERR: ${error.message.slice(0,50)}` : `rows=${count}`);
}

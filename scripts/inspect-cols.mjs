import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tables = ['floor_plan_versions','spaces','layouts','module_instances','scene_versions','quotes','approvals','workflow_stage_status','project_briefs'];
for (const t of tables) {
  const { data, error } = await client.from(t).select('*').limit(0);
  // Use RPC info via a dummy insert error to reveal columns is overkill; instead read information_schema
  const cols = await client.rpc('get_columns', { tbl: t }).catch(() => null);
  console.log(t, '->', cols ? cols.map(c=>c.column_name).join(',') : 'rpc-unavailable');
}

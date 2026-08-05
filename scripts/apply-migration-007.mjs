import fs from 'node:fs';
import { config } from 'dotenv';
config();
const sql = fs.readFileSync('supabase/migrations/202607240001_plan_analyses_tables.sql', 'utf-8');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const body = JSON.stringify({ query: sql });
fetch(`${url}/rest/v1/sql?query=${encodeURIComponent(sql)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
})
  .then((r) => r.text())
  .then((t) => console.log('SQL_RESP', t.slice(0, 300)))
  .catch((e) => console.error('SQL_ERR', e.message));

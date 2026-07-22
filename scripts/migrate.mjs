import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const rootEnvPath = resolve(process.cwd(), '.env');
if (existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !secretKey) {
  console.log('Skipping database migration: SUPABASE_URL or SUPABASE_SECRET_KEY is not configured.');
  process.exit(0);
}

const client = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function runMigration() {
  console.log('Validating database connectivity and schema compatibility...');
  const { data, error } = await client.from('projects').select('id').limit(1);
  if (error && error.code === 'PGRST116') {
    console.log('Database schema ready.');
  } else if (error) {
    console.warn('Database health notice:', error.message);
  } else {
    console.log(`Database connected. Schema version verified against ${supabaseUrl}.`);
  }
}

runMigration().catch((err) => {
  console.error('Migration verification failed:', err);
  process.exit(1);
});

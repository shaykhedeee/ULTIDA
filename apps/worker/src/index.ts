import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = [resolve(workerDir, '../../.env'), resolve(workerDir, '../../../.env')].find((candidate) => existsSync(candidate));
dotenv.config({ path: rootEnvPath, override: true });

function hasServerSupabaseKey() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export async function runWorkerLoop() {
  if (!hasServerSupabaseKey()) {
    console.warn('ULTIDA worker is idle: a server-only Supabase key is required.');
    return;
  }

  // The API owns canonical job processing. Keeping this boundary inert prevents
  // a second process from using obsolete persistence logic against live jobs.
  console.log('ULTIDA worker standby: canonical processing runs in the API service.');
}

void runWorkerLoop().catch((error) => console.error('ULTIDA worker failed:', error));

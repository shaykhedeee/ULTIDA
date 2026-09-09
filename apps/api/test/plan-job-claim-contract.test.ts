import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('a queue-delivered plan job claims only its requested id', async () => {
  const source = await readFile(fileURLToPath(new URL('../src/plan-jobs.ts', import.meta.url)), 'utf8');
  const migration = await readFile(fileURLToPath(new URL('../../../supabase/migrations/202608130002_claim_specific_plan_job.sql', import.meta.url)), 'utf8');

  assert.match(source, /rpc\('claim_plan_analysis_job'/);
  assert.match(source, /requested_job_id:\s*jobId/);
  assert.match(migration, /where id = requested_job_id/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /grant execute on function public\.claim_plan_analysis_job\(uuid, text\) to service_role/);
});

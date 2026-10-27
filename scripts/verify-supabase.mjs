import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = existsSync(resolve(root, '.env')) ? Object.fromEntries(readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; })) : {};
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const requiredMigrations = [
  '0001_ultida_phase1_foundation.sql',
  '20260720020313_ultida_0002_security_compatibility.sql',
  '20260720020455_ultida_0003_private_project_assets_storage.sql',
  '20260720021121_ultida_0004_foreign_key_indexes.sql',
  '20260720140851_reference_library_compatible.sql',
  '20260720141024_reference_library_fk_indexes.sql',
  '20260720192733_ensure_project_assets_bucket.sql',
  '20260722075115_layout_invalidation_stage_status.sql',
  '20260722083149_live_schema_compatibility.sql',
  '20260722103920_quotes_and_handover.sql',
  '20260722104027_ensure_private_project_assets_bucket.sql',
  '20260722114628_project_metadata_columns.sql',
  '20260722115526_project_realtime_publication.sql',
  '20260722120235_projects_id_default.sql',
  '20260722124345_project_assets_organization_compatibility.sql',
  '20260722124802_scene_version_organization_compatibility.sql',
  '20260722210403_jobs_contract_recovery.sql',
  '20260722211323_ai_runs_and_plan_approval.sql',
  '20260730124221_aura_audit_events_project_id_text.sql',
  '20260802172224_geometry_mode_approval.sql',
  '20260802172236_plan_approval_invoker_hardening.sql',
  '20260802173059_studio_settings_and_invites.sql',
  '20260802173842_reference_vault_entries.sql',
  '20260805034432_project_operations_reviews.sql',
  '20260805034851_material_specifications.sql',
  '20260808130302_add_studio_design_decisions.sql',
  '20260808130321_add_studio_calendar_and_invoices.sql',
  '20260808130332_add_material_edge_banding_specifications.sql',
  '202608100001_job_transition_metadata.sql',
  '20260812231751_claim_specific_plan_job.sql',
  '20260813065209_reconcile_floor_plan_versions_contract.sql',
  '20260813070603_reconcile_render_artifacts_contract.sql',
  '20260813070742_reconcile_scene_ownership.sql',
  '20260813072840_recover_unleased_plan_jobs.sql',
  '20260813155322_production_snapshot_reviews.sql',
  '20260813155501_production_snapshot_review_policy_hardening.sql',
  '20260829031924_release_reconciliation_and_job_observability.sql',
  '20260915060515_scene_design_intent.sql',
  '20261017223419_room_moodboard_versions.sql',
  '20261017223424_atomic_visual_review.sql',
  '20261017223425_kitchen_quote_versions.sql',
  '20261017223427_atomic_moodboard_save.sql',
  '20261017223429_atomic_aura_review.sql',
  '20261017223721_production_review_fingerprint.sql',
];
const present = new Set(readdirSync(resolve(root, 'supabase/migrations')));
const missing = requiredMigrations.filter((name) => !present.has(name));
if (missing.length) throw new Error(`Missing local migrations: ${missing.join(', ')}`);
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in .env.');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function fetchWithRetry(input, init) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750 * attempt));
    }
  }
  throw lastError;
}

for (const table of ['projects', 'project_assets', 'floor_plan_versions', 'scene_versions', 'jobs', 'artifacts', 'reference_library_items', 'quotes', 'material_assignments', 'production_snapshot_reviews']) {
  const response = await fetchWithRetry(`${url}/rest/v1/${table}?select=*&limit=0`, { headers });
  if (!response.ok) throw new Error(`Supabase table check failed for ${table}: ${response.status} ${await response.text()}`);
  console.log(`PASS table ${table}`);
}
const jobContract = await fetchWithRetry(`${url}/rest/v1/jobs?select=id,status,request_id,attempts,max_attempts,queued_at,processing_at,completed_at,failed_at,last_error_code,lease_token,lease_expires_at,deadline_at,progress_stage&limit=0`, { headers });
if (!jobContract.ok) throw new Error(`Supabase durable job contract check failed: ${jobContract.status} ${await jobContract.text()}`);
console.log('PASS durable job lease and transition columns');
const storageKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!storageKey) {
  console.warn('WARN storage bucket API check requires a server-only Supabase secret key; verify with Supabase dashboard or MCP.');
  console.log('Supabase verification complete with publishable-key checks.');
  process.exit(0);
}
const bucketHeaders = { apikey: storageKey, Authorization: `Bearer ${storageKey}` };
const bucket = await fetchWithRetry(`${url}/storage/v1/bucket/project-assets`, { headers: bucketHeaders });
if (!bucket.ok) throw new Error(`Supabase project-assets bucket check failed: ${bucket.status} ${await bucket.text()}`);
const bucketData = await bucket.json();
if (bucketData.public === true) throw new Error('project-assets must remain private.');
console.log('PASS private storage bucket project-assets');
console.log('Supabase verification complete.');

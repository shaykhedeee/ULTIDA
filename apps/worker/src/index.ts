import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parsePlanIntake } from '@ultida/plan-core';
import { createProviderGateway } from '@ultida/provider-gateway';

const workerDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = [resolve(workerDir, '../../.env'), resolve(workerDir, '../../../.env')].find((candidate) => existsSync(candidate));
dotenv.config({ path: rootEnvPath });

const supabaseUrl = process.env.SUPABASE_URL || '';
// Workers must use a server-only key. A publishable key cannot claim jobs or
// write private assets and would make the worker silently fail under RLS.
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const gateway = createProviderGateway(process.env);

async function runWorkerLoop() {
  if (!supabase) {
    console.log('Supabase credentials missing, worker is idle.');
    return;
  }

  // 1. Process queued jobs
  const { data: queuedJobs, error: qErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('available_at', new Date().toISOString())
    .limit(5);

  if (qErr) {
    console.error('Error fetching queued jobs:', qErr);
  } else if (queuedJobs && queuedJobs.length > 0) {
    for (const job of queuedJobs) {
      // Claim the job
      const { data: claimedJob, error: claimErr } = await supabase
        .from('jobs')
        .update({
          status: 'running',
          locked_at: new Date().toISOString(),
          locked_by: 'worker-main',
          attempts: job.attempts + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('status', 'queued')
        .select('*')
        .single();

      if (claimErr || !claimedJob) {
        continue; // Already claimed or error
      }

      console.log(`Processing job ${job.id} (${job.kind})...`);

      try {
        if (job.kind === 'plan-detection') {
          // Perform plan detection
          const intake = parsePlanIntake(job.input ?? { projectId: 'active', fileName: 'plan.png', mimeType: 'image/png', bytes: 1024 });
          const proposals = intake.proposals;
          await supabase
            .from('jobs')
            .update({
              status: 'succeeded',
              output: { proposals },
              updated_at: new Date().toISOString(),
              locked_at: null
            })
            .eq('id', job.id);
        } else if (job.kind === 'visual-proposal') {
          const input = job.input;
          const result = await gateway.createVisualProposal(input);

          if (result.status === 'succeeded' && result.resultUrl) {
            // Handle immediate success (Pedra or fallback)
            await finalizeVisualProposal(job, result.provider || 'unknown', result.resultUrl);
          } else if (result.status === 'queued' && result.promptId) {
            // Asynchronous task (ComfyUI / AIHD)
            await supabase
              .from('jobs')
              .update({
                status: 'running',
                output: { provider: result.provider, promptId: result.promptId, request: input },
                updated_at: new Date().toISOString(),
                locked_at: null
              })
              .eq('id', job.id);
          } else {
            throw new Error((result as any).reason || 'Failed to initialize visual proposal.');
          }
        } else {
          throw new Error(`Unsupported job kind: ${job.kind}`);
        }
      } catch (err: any) {
        console.error(`Error processing job ${job.id}:`, err);
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: { message: err.message || 'Unknown processing error' },
            updated_at: new Date().toISOString(),
            locked_at: null
          })
          .eq('id', job.id);
      }
    }
  }

  // 2. Poll running visual tasks
  const { data: runningJobs, error: rErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'running')
    .eq('kind', 'visual-proposal');

  if (rErr) {
    console.error('Error fetching running jobs:', rErr);
  } else if (runningJobs && runningJobs.length > 0) {
    for (const job of runningJobs) {
      try {
        const { provider, promptId } = job.output || {};
        if (!provider || !promptId) continue;

        const pollResult = await gateway.pollTaskStatus(provider, promptId);
        if (pollResult.status === 'succeeded' && pollResult.resultUrl) {
          console.log(`Job ${job.id} visual proposal succeeded, persisting results...`);
          await finalizeVisualProposal(job, provider, pollResult.resultUrl);
        } else if (pollResult.status === 'failed') {
          console.log(`Job ${job.id} visual proposal failed.`);
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error: { message: 'Provider generation failed.' },
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }
      } catch (err: any) {
        console.error(`Error polling running job ${job.id}:`, err);
      }
    }
  }
}

async function finalizeVisualProposal(job: any, provider: string, resultUrl: string) {
  if (!supabase) return;

  const input = job.input;
  const imageRes = await fetch(resultUrl);
  const buffer = await imageRes.arrayBuffer();

  const assetId = crypto.randomUUID();
  const storagePath = `${input.projectId}/${job.scene_version_id || 'unversioned'}/${assetId}.png`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('project-assets')
    .upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) throw uploadError;

  // Retrieve project organization
  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', input.projectId)
    .single();

  const organizationId = project?.organization_id;
  if (!organizationId) throw new Error('Project organization context not found.');

  // Create Project Asset record
  await supabase.from('project_assets').insert({
    id: assetId,
    organization_id: organizationId,
    project_id: input.projectId,
    kind: 'visual-proposal',
    storage_path: storagePath,
    mime_type: 'image/png',
    metadata: {
      provider,
      operation: input.operation,
      roomId: input.roomId,
      sceneVersionId: input.sceneVersionId
    },
    created_by: job.created_by
  });

  // Create Artifact record
  await supabase.from('artifacts').insert({
    organization_id: organizationId,
    project_id: input.projectId,
    scene_version_id: input.sceneVersionId,
    job_id: job.id,
    kind: 'visual-proposal',
    status: 'approved',
    stale: false,
    storage_path: storagePath,
    provenance: {
      provider,
      operation: input.operation,
      prompt: input.structuredPrompt,
      style: input.style
    },
    created_by: job.created_by
  });

  // Update job status to succeeded
  await supabase
    .from('jobs')
    .update({
      status: 'succeeded',
      output: { resultUrl, storagePath },
      updated_at: new Date().toISOString(),
      locked_at: null
    })
    .eq('id', job.id);
}

// Start interval-based polling
setInterval(() => {
  runWorkerLoop().catch(console.error);
}, 5000);

console.log('ULTIDA durable Supabase job worker started.');
export { runWorkerLoop };

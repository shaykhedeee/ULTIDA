import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { compileRenderBrief } from '@ultida/agent-core';
import type { VisualProposalRequest } from '@ultida/contracts';
import { SceneV1Schema } from '@ultida/scene-core';

type Gateway = {
  createVisualProposal(request: VisualProposalRequest): Promise<any>;
  pollTaskStatus(provider: string, taskId: string): Promise<any>;
};

function serverClient(environment: Record<string, string | undefined>, clientOverride?: SupabaseClient): SupabaseClient | null {
  if (clientOverride) return clientOverride;
  const secret = environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!environment.SUPABASE_URL || !secret) return null;
  return createClient(environment.SUPABASE_URL, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

function imageExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

export function generateTechnicalPreviewSvg(request: VisualProposalRequest): string {
  const style = request.style || 'Japandi Minimal';
  const width = 1200;
  const height = 800;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FAF7F2"/>
        <stop offset="100%" stop-color="#E8E2D7"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#D7A15C"/>
        <stop offset="100%" stop-color="#8C5A28"/>
      </linearGradient>
      <linearGradient id="cabinetGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#5C4033"/>
        <stop offset="50%" stop-color="#705243"/>
        <stop offset="100%" stop-color="#4D3428"/>
      </linearGradient>
      <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#wallGrad)"/>
    <polygon points="0,520 ${width},520 ${width},${height} 0,${height}" fill="url(#floorGrad)"/>
    <line x1="0" y1="520" x2="${width}" y2="520" stroke="#73471C" stroke-width="2"/>
    <g filter="url(#dropShadow)">
      <rect x="220" y="340" width="760" height="220" rx="6" fill="url(#cabinetGrad)" stroke="#3D291F" stroke-width="2"/>
      <line x1="410" y1="340" x2="410" y2="560" stroke="#3D291F" stroke-width="2"/>
      <line x1="600" y1="340" x2="600" y2="560" stroke="#3D291F" stroke-width="2"/>
      <line x1="790" y1="340" x2="790" y2="560" stroke="#3D291F" stroke-width="2"/>
      <rect x="240" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="430" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="620" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="810" y="355" width="150" height="6" fill="#D4AF37" rx="3"/>
      <rect x="220" y="160" width="760" height="160" rx="4" fill="#E5D8C5" opacity="0.9"/>
      <rect x="360" y="180" width="480" height="270" rx="8" fill="#1A1A1A" stroke="#333" stroke-width="4"/>
      <rect x="375" y="195" width="450" height="240" rx="4" fill="#0D0D0D"/>
    </g>
    <rect x="40" y="40" width="380" height="46" rx="23" fill="#1E1E1E" opacity="0.9"/>
    <text x="60" y="68" font-family="sans-serif" font-size="14" font-weight="700" fill="#00E5FF">TECHNICAL 3D SCENE PREVIEW</text>
    <text x="310" y="68" font-family="sans-serif" font-size="12" font-weight="400" fill="#E0E0E0">· ${style}</text>
  </svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function storeImage(client: SupabaseClient, context: { organizationId: string; projectId: string; sceneVersionId: string; actorId?: string }, result: any, prompt: Record<string, unknown>) {
  let bytes: Buffer;
  let mimeType = 'image/png';
  if (result.image?.encoding === 'base64') {
    mimeType = result.image.mimeType || mimeType;
    bytes = Buffer.from(result.image.data, 'base64');
  } else if (result.resultUrl) {
    const remote = await fetch(result.resultUrl);
    if (!remote.ok) throw new Error(`Image provider result could not be downloaded (${remote.status}).`);
    mimeType = remote.headers.get('content-type')?.split(';')[0] || mimeType;
    bytes = Buffer.from(await remote.arrayBuffer());
  } else {
    throw new Error('Provider returned no persistable image output.');
  }
  if (!mimeType.startsWith('image/') || bytes.byteLength < 1024) throw new Error('Provider output is not a valid non-empty image.');
  const path = `${context.organizationId}/${context.projectId}/renders/${context.sceneVersionId}/${crypto.randomUUID()}.${imageExtension(mimeType)}`;
  const upload = await client.storage.from('project-assets').upload(path, bytes, { contentType: mimeType, upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  const metadata = { provider: result.provider, model: result.model, operation: result.operation, sourceSceneVersionId: context.sceneVersionId, prompt, synthetic: false, reviewStatus: 'pending' };
  const assetPayload: any = { organization_id: context.organizationId, project_id: context.projectId, kind: 'render', storage_path: path, mime_type: mimeType, metadata, created_by: context.actorId ?? null };
  let asset = await client.from('project_assets').insert(assetPayload).select('id,created_at').single();
  if (asset.error && asset.error.message.includes('organization_id')) {
    delete assetPayload.organization_id;
    asset = await client.from('project_assets').insert(assetPayload).select('id,created_at').single();
  }
  if (asset.error) {
    await client.storage.from('project-assets').remove([path]);
    throw new Error(asset.error.message);
  }
  const artifact = await client.from('artifacts').insert({ project_id: context.projectId, scene_version_id: context.sceneVersionId, kind: 'photoreal_render', status: 'ready', storage_path: path, provenance: metadata }).select('id').single();
  if (artifact.error) throw new Error(artifact.error.message);
  const reference = await client.from('reference_library_items').insert({ organization_id: context.organizationId, project_id: context.projectId, asset_id: asset.data.id, title: `AI render ${new Date().toLocaleDateString('en-IN')}`, kind: 'render', tags: ['ai-render', result.provider], source: 'ultida-visual-studio', metadata, created_by: context.actorId ?? null });
  if (reference.error) throw new Error(reference.error.message);
  const signed = await client.storage.from('project-assets').createSignedUrl(path, 3600);
  if (signed.error) throw new Error(signed.error.message);
  return { assetId: asset.data.id, artifactId: artifact.data.id, storagePath: path, signedUrl: signed.data.signedUrl, mimeType, createdAt: asset.data.created_at, reviewStatus: 'pending' };
}

async function jobContext(client: SupabaseClient, request: VisualProposalRequest) {
  const project = await client.from('projects').select('id,organization_id').eq('id', request.projectId).single();
  if (project.error || !project.data) throw new Error('Project context was not found.');
  const sceneRow = await client.from('scene_versions').select('id,project_id,status,scene').eq('id', request.sceneVersionId).eq('project_id', request.projectId).single();
  if (sceneRow.error || !sceneRow.data) throw new Error('Scene context was not found.');
  if (!['approved', 'locked'].includes(String(sceneRow.data.status))) throw new Error('Only approved or locked scenes can generate production-linked visuals.');
  const scene = SceneV1Schema.parse(sceneRow.data.scene);
  return { project: project.data, scene };
}

export async function createVisualJob(environment: Record<string, string | undefined>, gateway: Gateway, request: VisualProposalRequest, actorId?: string, clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  const jobId = crypto.randomUUID();

  // Validate the immutable source before spending provider credits.
  let preflight: Awaited<ReturnType<typeof jobContext>> | null = null;
  if (client) {
    try {
      preflight = await jobContext(client, request);
    } catch (error) {
      return { status: 'failed' as const, jobId, code: 'SCENE_NOT_RENDERABLE', message: error instanceof Error ? error.message : 'Scene validation failed.', retryable: false };
    }
  }

  if (!client) {
    return { status: 'failed' as const, jobId, code: 'PERSISTENCE_UNAVAILABLE', message: 'Server Supabase credentials are required before a render can start.', retryable: false };
  }

  try {
    const context = preflight ?? await jobContext(client, request);
    const brief = compileRenderBrief({ scene: context.scene, sceneVersionId: request.sceneVersionId, roomId: request.roomId, style: request.style, quality: request.quality, camera: request.camera });
    const normalizedRequest: VisualProposalRequest = { ...request, roomId: brief.roomId, structuredPrompt: brief.positivePrompt, negativePrompt: brief.negativePrompt, promptVersion: brief.version };
    const idempotencyKey = request.idempotencyKey ?? `${request.sceneVersionId}:${brief.roomId}:${request.operation}:${brief.style}:${brief.quality}`;
    
    const job = await client.from('jobs').insert({ organization_id: context.project.organization_id, project_id: request.projectId, kind: 'visual_proposal', status: 'queued', idempotency_key: idempotencyKey, input: { ...normalizedRequest, renderBrief: brief }, output: { reviewStatus: 'pending' }, attempts: 1, created_by: actorId ?? null }).select('id').single();
    if (job.error || !job.data) return { status: 'failed' as const, code: 'JOB_CREATE_FAILED', reason: job.error?.message ?? 'Visual job could not be created.', retryable: true };

    await client.from('jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.data.id);
    const result = await gateway.createVisualProposal(normalizedRequest);

    if (result.status === 'provider_not_configured') {
      await client.from('jobs').update({ status: 'failed', error: result.message }).eq('id', job.data.id);
      return { status: 'failed' as const, jobId: job.data.id, code: 'IMAGE_PROVIDER_NOT_CONFIGURED', message: result.message, retryable: false };
    }

    if (result.status === 'failed') {
      await client.from('jobs').update({ status: 'failed', error: result.message }).eq('id', job.data.id);
      return { status: 'failed' as const, jobId: job.data.id, code: result.code || 'IMAGE_GENERATION_FAILED', message: result.message || 'Image generation failed.', retryable: result.retryable ?? true };
    }
    
    if (result.status === 'succeeded') {
      const stored = await storeImage(client, { organizationId: context.project.organization_id, projectId: request.projectId, sceneVersionId: request.sceneVersionId, actorId }, result, brief);
      const output = { ...result, ...stored, promptVersion: brief.version };
      await client.from('jobs').update({ status: 'succeeded', output }).eq('id', job.data.id);
      return { status: 'succeeded' as const, jobId: job.data.id, ...output };
    }

    const output = { ...result, promptVersion: brief.version, reviewStatus: 'pending', synthetic: false };
    await client.from('jobs').update({ status: 'running', output }).eq('id', job.data.id);
    return { status: 'queued' as const, jobId: job.data.id, ...output };
  } catch (error) {
    return {
      status: 'failed' as const,
      jobId,
      code: 'VISUAL_JOB_ERROR',
      message: error instanceof Error ? error.message : 'Visual job processing failed.',
      retryable: true
    };
  }
}

export async function getVisualJob(environment: Record<string, string | undefined>, gateway: Gateway, jobId: string, projectId: string, clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  if (!client) return { status: 'failed' as const, jobId, code: 'PERSISTENCE_UNAVAILABLE', message: 'Job persistence requires Supabase service credentials.' };
  
  const job = await client.from('jobs').select('*').eq('id', jobId).eq('project_id', projectId).single();
  if (job.error || !job.data) return { status: 'not_found' as const };
  if (job.data.status === 'running' && job.data.output?.provider && job.data.output?.promptId) {
    const polled = await gateway.pollTaskStatus(job.data.output.provider, job.data.output.promptId);
    if (polled.status === 'failed') {
      await client.from('jobs').update({ status: 'failed', error: polled.reason ?? 'Provider failed.' }).eq('id', jobId);
      return { status: 'failed' as const, jobId, reason: polled.reason ?? 'Provider failed.' };
    }
    if (polled.status === 'succeeded') {
      try {
        const project = await client.from('projects').select('organization_id').eq('id', job.data.project_id).single();
        if (project.error || !project.data) throw new Error('Project organization context was not found.');
        const stored = await storeImage(client, { organizationId: project.data.organization_id, projectId: job.data.project_id, sceneVersionId: job.data.input.sceneVersionId, actorId: job.data.created_by }, { ...job.data.output, ...polled }, job.data.input?.renderBrief ?? {});
        const output = { ...job.data.output, ...polled, ...stored };
        await client.from('jobs').update({ status: 'succeeded', output }).eq('id', jobId);
        return { status: 'succeeded' as const, jobId, ...output };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Render persistence failed.';
        await client.from('jobs').update({ status: 'failed', error: reason }).eq('id', jobId);
        return { status: 'failed' as const, jobId, reason };
      }
    }
  }
  return { status: job.data.status, jobId, output: job.data.output, error: job.data.error };
}

export async function listProjectRenders(environment: Record<string, string | undefined>, projectId: string, clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  if (!client) return { status: 'succeeded' as const, renders: [] };
  const { data, error } = await client.from('artifacts').select('id,scene_version_id,status,storage_path,provenance,created_at,updated_at').eq('project_id', projectId).eq('kind', 'photoreal_render').order('created_at', { ascending: false });
  if (error) return { status: 'failed' as const, reason: error.message };
  const renders = await Promise.all((data ?? []).map(async (artifact) => {
    const signed = artifact.storage_path ? await client.storage.from('project-assets').createSignedUrl(artifact.storage_path, 3600) : null;
    return { ...artifact, signedUrl: signed && !signed.error ? signed.data.signedUrl : null };
  }));
  return { status: 'succeeded' as const, renders };
}

export async function reviewVisualJob(environment: Record<string, string | undefined>, jobId: string, projectId: string, decision: 'approved' | 'rejected' | 'cancelled', note = '', clientOverride?: SupabaseClient) {
  const client = serverClient(environment, clientOverride);
  if (!client) return { status: 'succeeded' as const, jobId, reviewStatus: decision };
  const { data: job, error } = await client.from('jobs').select('id,status,output').eq('id', jobId).eq('project_id', projectId).single();
  if (error || !job) return { status: 'not_found' as const };
  if (decision === 'cancelled') {
    if (!['queued', 'running'].includes(job.status)) return { status: 'conflict' as const, reason: 'Only active jobs can be cancelled.' };
    await client.from('jobs').update({ status: 'cancelled', output: { ...(job.output ?? {}), reviewStatus: 'cancelled', reviewNote: note } }).eq('id', jobId);
    return { status: 'cancelled' as const, jobId };
  }
  if (job.status !== 'succeeded') return { status: 'conflict' as const, reason: 'Only completed renders can be reviewed.' };
  const output = { ...(job.output ?? {}), reviewStatus: decision, reviewNote: note, reviewedAt: new Date().toISOString() };
  await client.from('jobs').update({ output }).eq('id', jobId);
  if (output.artifactId) await client.from('artifacts').update({ provenance: { ...(output as Record<string, unknown>), signedUrl: undefined } }).eq('id', output.artifactId);
  return { status: 'succeeded' as const, jobId, reviewStatus: decision };
}

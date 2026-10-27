import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MoodboardSaveSchema, type MoodboardDocument } from '@ultida/contracts';

export class MoodboardError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
function checked<T>(result: { data: T; error: { message?: string; code?: string } | null }): T {
  if (result.error) throw new MoodboardError(503, 'MOODBOARD_STORAGE_UNAVAILABLE', 'Moodboard storage is unavailable. Verify migrations and access policies.');
  return result.data;
}
type Assignment = { target_kind: string; target_id: string; module_instance_id?: string | null; semantic_slot: string; material_id: string; revision: number; status: string };
export function moodboardFingerprint(assignments: Assignment[], moduleIds: Set<string>, roomId: string, materials: Array<{id:string;texture_asset_id?:string|null;updated_at?:string|null}> = []): string {
  const latest = new Map<string, Assignment>();
  for (const row of [...assignments].sort((a,b) => b.revision-a.revision)) {
    if (!(row.target_kind === 'room' && row.target_id === roomId) &&
        !(row.target_kind === 'module' && moduleIds.has(row.module_instance_id || row.target_id)) &&
        !(row.target_kind === 'part' && !!row.module_instance_id && moduleIds.has(row.module_instance_id)) && row.target_kind !== 'semantic_slot') continue;
    const key = `${row.target_kind}:${row.target_id}:${row.module_instance_id ?? ''}:${row.semantic_slot}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  const records = [...latest].sort(([a],[b]) => a.localeCompare(b)).map(([key,row]) => [key,row.material_id,row.revision,row.status]);
  const referenced = new Set([...latest.values()].map(row => row.material_id));
  const materialVersions = materials.filter(m => referenced.has(m.id)).sort((a,b) => a.id.localeCompare(b.id)).map(m => [m.id,m.texture_asset_id ?? null,m.updated_at ?? null]);
  return createHash('sha256').update(JSON.stringify([records,materialVersions])).digest('hex');
}
export async function loadMoodboardContext(client: SupabaseClient, projectId: string, roomId: string) {
  const project = checked(await client.from('projects').select('id,organization_id').eq('id',projectId).maybeSingle());
  const room = checked(await client.from('spaces').select('id,project_id,organization_id').eq('id',roomId).eq('project_id',projectId).maybeSingle());
  if (!project || !room || room.organization_id !== project.organization_id) throw new MoodboardError(404,'MOODBOARD_ROOM_NOT_FOUND','Room does not belong to this project.');
  const modules = checked(await client.from('module_instances').select('id').eq('project_id',projectId).eq('space_id',roomId));
  const assignments = checked(await client.from('material_assignments').select('target_kind,target_id,module_instance_id,semantic_slot,material_id,revision,status').eq('project_id',projectId));
  const materials = checked(await client.from('material_library_items').select('id,texture_asset_id,updated_at,metadata').eq('organization_id',project.organization_id));
  const assets = checked(await client.from('project_assets').select('id,kind,storage_path,mime_type,metadata').eq('project_id',projectId).eq('organization_id',project.organization_id));
  // Supabase's default row limit must not silently produce a supposedly complete board.
  if ([modules,assignments,materials,assets].some(rows => (rows?.length ?? 0) >= 1000)) throw new MoodboardError(503,'MOODBOARD_CONTEXT_TRUNCATED','Moodboard evidence requires pagination before it can be verified.');
  const fingerprint = moodboardFingerprint(assignments ?? [], new Set((modules ?? []).map(m=>String(m.id))),roomId,materials ?? []);
  const latest = checked(await client.from('room_moodboard_versions').select('document,revision').eq('project_id',projectId).eq('room_id',roomId).order('revision',{ascending:false}).limit(1).maybeSingle());
  let sceneStale = false;
  if (latest?.document?.sceneVersionId) {
    const linked = checked(await client.from('scene_versions').select('id,scene').eq('id',latest.document.sceneVersionId).eq('project_id',projectId).maybeSingle());
    const ids = new Set((modules ?? []).map(m => m.id));
    sceneStale = !linked || !Array.isArray(linked.scene?.modules) || !linked.scene.modules.length || !linked.scene.modules.every((m: {id:string}) => ids.has(m.id));
  }
  return { project, room, materials: materials ?? [], assets: assets ?? [], fingerprint, latest, sceneStale, assignments: assignments ?? [], moduleIds: new Set((modules ?? []).map(m => String(m.id))) };
}
export async function signedMoodboardAssets(client: SupabaseClient, context: Awaited<ReturnType<typeof loadMoodboardContext>>) {
  const allowed = context.assets.filter(a => ['image/png','image/jpeg','image/webp','image/avif'].includes(String(a.mime_type)) && typeof a.storage_path === 'string' && a.storage_path.startsWith(`${context.project.organization_id}/${context.project.id}/`) && !a.storage_path.split('/').includes('..'));
  const swatches: Array<{ materialId: string; assetId: string; signedUrl: string }> = [];
  const imageAssets: Array<{ assetId: string; signedUrl: string; title: string }> = [];
  for (const asset of allowed) {
    const owners = context.materials.filter(m=>m.texture_asset_id === asset.id);
    if (!owners.length && asset.kind !== 'reference_image') continue;
    const signed = await client.storage.from('project-assets').createSignedUrl(asset.storage_path,3600);
    if (signed.error || !signed.data?.signedUrl) throw new MoodboardError(503,'MOODBOARD_ASSET_ACCESS_FAILED','An authorized moodboard image could not be signed.');
    for (const material of owners) swatches.push({materialId:material.id,assetId:asset.id,signedUrl:signed.data.signedUrl});
    if (asset.kind === 'reference_image') imageAssets.push({assetId:asset.id,signedUrl:signed.data.signedUrl,title:typeof asset.metadata?.title === 'string' ? asset.metadata.title : 'Project reference'});
  }
  return {swatches,imageAssets};
}
export async function saveMoodboard(client: SupabaseClient, projectId: string, roomId: string, userId: string, body: unknown) {
  const parsed = MoodboardSaveSchema.safeParse(body);
  if (!parsed.success) throw new MoodboardError(422,'INVALID_MOODBOARD','Check the board dimensions, cards and saved identities.');
  const { document, expectedRevision } = parsed.data;
  if (document.projectId !== projectId || document.roomId !== roomId) throw new MoodboardError(422,'MOODBOARD_CONTEXT_MISMATCH','Board identities must match the requested room.');
  const context = await loadMoodboardContext(client,projectId,roomId);
  if ((context.latest?.revision ?? 0) !== expectedRevision) throw new MoodboardError(409,'MOODBOARD_REVISION_CONFLICT','Reload the latest board before saving.');
  if (document.sourceFingerprint !== context.fingerprint) throw new MoodboardError(409,'MOODBOARD_SOURCE_CHANGED','Saved material assignments changed. Refresh the board before saving.');
  const materials = new Set(context.materials.map(m=>m.id));
  const images = new Set(context.assets.filter(a=>a.kind === 'reference_image' && ['image/png','image/jpeg','image/webp','image/avif'].includes(String(a.mime_type)) && typeof a.storage_path === 'string' && a.storage_path.startsWith(`${context.project.organization_id}/${projectId}/`) && !a.storage_path.split('/').includes('..')).map(a=>a.id));
  if (document.cards.some(card=>card.materialId && !materials.has(card.materialId) || card.assetId && !images.has(card.assetId))) throw new MoodboardError(422,'MOODBOARD_REFERENCE_NOT_ALLOWED','Cards must use authorized organization materials and project reference images.');
  if (document.sceneVersionId) {
    const scene = checked(await client.from('scene_versions').select('id,scene').eq('id',document.sceneVersionId).eq('project_id',projectId).maybeSingle());
    const modules = checked(await client.from('module_instances').select('id').eq('project_id',projectId).eq('space_id',roomId));
    const ids = new Set((modules ?? []).map(m=>m.id));
    if (!scene || !Array.isArray(scene.scene?.modules) || !scene.scene.modules.length || !scene.scene.modules.every((m: { id: string })=>ids.has(m.id))) throw new MoodboardError(422,'MOODBOARD_SCENE_MISMATCH','Scene must belong to this project and room.');
  }
  const revision = expectedRevision + 1;
  const inserted = await client.rpc('save_room_moodboard_atomic', {p_project_id:projectId,p_room_id:roomId,p_revision:expectedRevision,p_document:document,p_sources:{assignments:context.assignments,materials:context.materials,moduleIds:[...context.moduleIds]}});
  if (['23505','40001'].includes(inserted.error?.code ?? '')) throw new MoodboardError(409,'MOODBOARD_REVISION_CONFLICT','Another edit was saved first. Reload the board.');
  if (!checked(inserted)?.revision) throw new MoodboardError(503,'MOODBOARD_SAVE_UNCONFIRMED','Moodboard save did not return a persisted revision.');
  return {document:document as MoodboardDocument,revision,currentSourceFingerprint:context.fingerprint,stale:false};
}

const SwatchAttachmentSchema = z.object({
  materialId:z.string().uuid(), assetId:z.string().uuid(), expectedTextureAssetId:z.string().uuid().nullable(), rightsConfirmed:z.literal(true),
}).strict();
/** Attach an already authorized sample image; never changes geometry or invents texture fidelity. */
export async function attachMoodboardSwatch(client:SupabaseClient,projectId:string,roomId:string,body:unknown) {
  const parsed=SwatchAttachmentSchema.safeParse(body);
  if(!parsed.success) throw new MoodboardError(422,'INVALID_SWATCH_ATTACHMENT','Choose saved identities and confirm image usage rights.');
  const input=parsed.data;
  const context=await loadMoodboardContext(client,projectId,roomId);
  const latest=new Map<string,Assignment>();
  for(const row of [...context.assignments].sort((a,b)=>b.revision-a.revision)) {
    const moduleId=row.module_instance_id || row.target_id;
    if(!(row.target_kind==='room' && row.target_id===roomId) && !(['module','part'].includes(row.target_kind) && context.moduleIds.has(moduleId))) continue;
    const key=`${row.target_kind}:${row.target_id}:${row.module_instance_id ?? ''}:${row.semantic_slot}`;
    if(!latest.has(key))latest.set(key,row);
  }
  if(![...latest.values()].some(row=>row.material_id===input.materialId && ['draft','approved'].includes(row.status))) throw new MoodboardError(422,'SWATCH_MATERIAL_NOT_ASSIGNED','The material must be saved in this room before adding a sample.');
  const material=context.materials.find(m=>m.id===input.materialId);
  if(!material) throw new MoodboardError(422,'SWATCH_MATERIAL_NOT_ALLOWED','Choose a material from the organization library.');
  if((material.texture_asset_id ?? null)!==input.expectedTextureAssetId) throw new MoodboardError(409,'SWATCH_REVISION_CONFLICT','The sample changed. Refresh before replacing it.');
  const asset=context.assets.find(a=>a.id===input.assetId);
  const prefix=`${context.project.organization_id}/${projectId}/references/`;
  if(!asset || asset.kind!=='reference_image' || !['image/png','image/jpeg','image/webp','image/avif'].includes(String(asset.mime_type)) || typeof asset.storage_path!=='string' || !asset.storage_path.startsWith(prefix) || asset.storage_path.split('/').includes('..')) throw new MoodboardError(422,'SWATCH_ASSET_NOT_ALLOWED','Choose an authorized saved project reference image.');
  const access=await client.storage.from('project-assets').createSignedUrl(asset.storage_path,60);
  if(access.error || !access.data?.signedUrl) throw new MoodboardError(503,'SWATCH_ASSET_UNAVAILABLE','Image access could not be verified.');
  const metadata=material.metadata && typeof material.metadata==='object' && !Array.isArray(material.metadata)?material.metadata:{};
  let update=client.from('material_library_items').update({texture_asset_id:input.assetId,updated_at:new Date().toISOString(),metadata:{...metadata,swatchSource:'uploaded-sample',sampleNotColorCalibrated:true,swatchRightsConfirmed:true}}).eq('id',input.materialId).eq('organization_id',context.project.organization_id);
  update=input.expectedTextureAssetId===null?update.is('texture_asset_id',null):update.eq('texture_asset_id',input.expectedTextureAssetId);
  update=material.updated_at?update.eq('updated_at',material.updated_at):update.is('updated_at',null);
  const result=await update.select('*').maybeSingle();
  checked(result);
  if(!result.data) throw new MoodboardError(409,'SWATCH_REVISION_CONFLICT','The material changed during this save. Refresh before retrying.');
  return {material:result.data};
}

/** Compare-and-set prevents a concurrent invalidation from being overwritten. */
export function approveUnchangedDraft(client: any, projectId: string, sceneVersionId: string, scene: any) {
  return client.from('scene_versions').update({ status: 'approved', scene: { ...scene, metadata: { ...(scene.metadata ?? {}), status: 'approved' } } })
    .eq('project_id', projectId).eq('id', sceneVersionId).eq('status', 'draft')
    .select('id,status,version_number,scene,created_at').maybeSingle();
}

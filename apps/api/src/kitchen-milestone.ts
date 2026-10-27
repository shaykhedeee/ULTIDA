/** ULTIDA measured-kitchen milestone. Pure, read-only release gate; never approves work. */
export type MilestoneStatus = 'pass' | 'blocked';
export type MilestoneCheck = { id: string; label: string; status: MilestoneStatus; evidence: string; nextAction: string };
export type KitchenProofInput = {
  projectId: string;
  roomId: string;
  sceneVersionId: string;
  plan: { id?: string; status?: string; canonical_model?: unknown; approved_at?: string | null } | null;
  room: { id?: string; room_type?: string; space_id?: string; name?: string } | null;
  layouts: Array<{ id?: string; status?: string }>;
  modules: Array<{ id?: string; space_id?: string; template_id?: string; layout_id?: string; config_json?: unknown; position_json?: unknown }>;
  catalogTemplateIds: string[];
  /** Future persisted, approved AI proposal; a chat message or image is not evidence. */
  aiSelection: { proposalId?: string; roomId?: string; sourcePlanVersionId?: string; approved?: boolean; templateIds?: string[] } | null;
  assignments: Array<{ material_id?: string; module_instance_id?: string; target_kind?: string; target_id?: string; semantic_slot?: string; status?: string; revision?: number }>;
  materials: Array<{ id?: string; brand?: string | null; supplier?: string | null; code?: string | null; category?: string; metadata?: Record<string, unknown> | null }>;
  scene: { id?: string; status?: string; floor_plan_version_id?: string; scene?: unknown } | null;
  renders: Array<{ id?: string; kind?: string; status?: string; stale?: boolean; scene_version_id?: string; provenance?: Record<string, unknown> | null }>;
  productionReview: { status?: string; approved_part_ids?: string[] } | null;
  cutlist: { parts: Array<{ partInstanceId?: string }>; excludedModules?: unknown[]; warnings?: unknown[] } | null;
  /** Only persisted, authenticated, scene-linked quotation evidence may satisfy this. */
  quote: { sceneVersionId?: string; status?: string; lines?: Array<{ sourcePartId?: string; unitRateInr?: number }> } | null;
};

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const verifiedScale = (canonical: unknown) => {
  const plan = object(canonical);
  const scale = object(plan?.scale);
  // Only an explicitly verified canonical scale is manufacturing evidence.
  return scale?.verified === true;
};
const validSourceUrl = (value: unknown) => typeof value === 'string' && /^https:\/\/[^\s]+$/i.test(value);

export function evaluateKitchenMilestone(input: KitchenProofInput) {
  const checks: MilestoneCheck[] = [];
  const add = (id: string, label: string, ok: boolean, evidence: string, nextAction: string) =>
    checks.push({ id, label, status: ok ? 'pass' : 'blocked', evidence, nextAction });

  const planOk = !!input.plan?.id && input.plan.status === 'approved' && !!input.plan.approved_at && verifiedScale(input.plan.canonical_model);
  add('calibrated_plan', 'Approved measured plan', planOk,
    planOk ? `Plan ${input.plan?.id}: designer-approved with verified scale` : 'No approved, explicitly verified canonical plan with approval timestamp',
    'Calibrate using real reference measurements, independently cross-check, review openings and approve the active plan.');

  const roomOk = input.room?.id === input.roomId && input.room?.room_type === 'kitchen';
  add('kitchen_room', 'Persisted kitchen room', roomOk,
    roomOk ? `Kitchen room ${input.roomId}` : 'Requested room is not a persisted kitchen',
    'Select and configure a kitchen space saved against the approved plan.');

  const approvedLayouts = new Set(input.layouts.filter(x => x.status === 'approved' && x.id).map(x => x.id!));
  const catalog = new Set(input.catalogTemplateIds);
  const modulesOk = roomOk && input.modules.length > 0 && input.modules.every(module =>
    !!module.id && module.space_id === input.roomId && !!module.template_id && catalog.has(module.template_id) &&
    !!module.layout_id && approvedLayouts.has(module.layout_id));
  add('library_modules', 'Real Ultida modular kitchen instances', modulesOk,
    modulesOk ? `${input.modules.length} persisted module(s), real catalog templates, approved layout lineage` : 'Missing module instances, unknown template IDs, wrong room or unapproved layout',
    'Save kitchen modules using actual Ultida catalog template IDs and approve their measured layout.');

  const aiIds = new Set(input.aiSelection?.templateIds ?? []);
  const aiOk = modulesOk && !!input.aiSelection?.proposalId && input.aiSelection.approved === true &&
    input.aiSelection.roomId === input.roomId && input.aiSelection.sourcePlanVersionId === input.plan?.id &&
    input.modules.every(m => !!m.template_id && aiIds.has(m.template_id)) &&
    [...new Set(input.modules.map(m=>m.template_id))].every(id=>input.modules.filter(m=>m.template_id===id).length <= (input.aiSelection?.templateIds ?? []).filter(template=>template===id).length);
  add('approved_ai_selection', 'Designer-approved AI module selection', aiOk,
    aiOk ? `Approved AI proposal ${input.aiSelection?.proposalId} selected the saved catalog templates` :
      'No persisted designer-approved AI proposal matching this room, approved plan and saved module template IDs',
    'Create a plan-grounded AURA kitchen preview and approve its saved proposal before accepting module selection.');

  const scenePayload = object(input.scene?.scene);
  const sceneModules = Array.isArray(scenePayload?.modules) ? scenePayload.modules.map(object).filter((x): x is Obj => x !== null) : [];
  const sceneIds = new Set(sceneModules.map(x => x.id).filter((x): x is string => typeof x === 'string'));
  const sceneOk = !!input.scene && input.scene.id === input.sceneVersionId && ['approved', 'locked'].includes(input.scene.status ?? '') &&
    planOk && input.scene.floor_plan_version_id === input.plan?.id && modulesOk && input.modules.every(x => !!x.id && sceneIds.has(x.id));
  add('approved_scene', 'Approved, version-locked 3D scene', sceneOk,
    sceneOk ? `Scene ${input.sceneVersionId} includes saved kitchen modules from plan ${input.plan?.id}` : 'Scene missing, unapproved, wrong plan lineage or saved modules not represented',
    'Compile the room from approved plan/layout and persisted modules, then review and approve the exact scene version.');

  const materials = new Map(input.materials.filter(m => m.id).map(m => [m.id!, m]));
  const moduleIds = new Set(input.modules.map(m => m.id).filter((v): v is string => !!v));
  // Latest version only; a later draft supersedes older approved material evidence.
  const latest = new Map<string, typeof input.assignments[number]>();
  for (const a of input.assignments) {
    if (!((a.module_instance_id && moduleIds.has(a.module_instance_id)) || (a.target_kind === 'room' && a.target_id === input.roomId))) continue;
    const key = `${a.module_instance_id || a.target_id}|${a.semantic_slot}`;
    const old = latest.get(key);
    if (!old || Number(a.revision ?? 0) >= Number(old.revision ?? 0)) latest.set(key, a);
  }
  const currentApproved = [...latest.values()].filter(a => a.status === 'approved');
  const chosenMaterials = currentApproved.flatMap(a => {const m = materials.get(a.material_id ?? ''); return m ? [{a, m}] : [];});
  const merino = chosenMaterials.filter(({m}) => /\bmerino\b/i.test(`${m.brand ?? ''} ${m.supplier ?? ''}`) &&
    !!m.code?.trim() && !!m.metadata && validSourceUrl(m.metadata.sourceUrl));
  const fitted = chosenMaterials.filter(({a,m}) => a.semantic_slot === 'hardware' && /\b(hettich|ebco)\b/i.test(`${m.brand ?? ''} ${m.supplier ?? ''}`) &&
    !!m.code?.trim() && !!m.metadata && validSourceUrl(m.metadata.sourceUrl));
  const sourceOk = sceneOk && merino.length > 0 && fitted.length > 0;
  add('verified_finishes_hardware', 'Merino and Ebco/Hettich assignments', sourceOk,
    sourceOk ? `${merino.length} source-linked Merino finish(es); ${fitted.length} source-linked fitting(s)` :
      `Approved source-linked Merino: ${merino.length}; approved source-linked Ebco/Hettich hardware: ${fitted.length}`,
    'Assign real manufacturer codes and source URLs to modules; approve the latest finish/hardware revisions and recompile the scene.');

  const sceneRenders = input.renders.filter(r => r.kind === 'render' && r.scene_version_id === input.sceneVersionId && !r.stale &&
    (r.status === 'ready' || r.status === 'approved') && r.provenance?.qaStatus === 'measured_passed');
  const renderOk = sceneOk && sceneRenders.length > 0;
  add('render_provenance', 'Scene-linked render with measured QA', renderOk,
    renderOk ? `${sceneRenders.length} non-stale, measured-QA render artifact(s)` : 'No non-stale render from this exact approved scene with measured QA passed',
    'Render this exact scene with Cloudflare, check camera/geometry fidelity and approve the image during review.');

  const partIds = new Set((input.cutlist?.parts ?? []).map(part => part.partInstanceId).filter((v): v is string => !!v));
  const reviewIds = new Set(input.productionReview?.approved_part_ids ?? []);
  const productionOk = sceneOk && input.productionReview?.status === 'approved' && partIds.size > 0 &&
    partIds.size === (input.cutlist?.parts.length ?? -1) && [...partIds].every(id => reviewIds.has(id)) &&
    (input.cutlist?.excludedModules ?? []).length === 0;
  add('production_snapshot', 'Reviewed cutlist and production parts', productionOk,
    productionOk ? `${partIds.size} exact part(s) approved for scene ${input.sceneVersionId}` : 'Production review or exact part identity incomplete, or modules excluded',
    'Resolve factory validation, open the scene-linked cutlist/elevations and approve every exact panel part.');

  const quoteOk = sceneOk && !!input.quote && input.quote.sceneVersionId === input.sceneVersionId && input.quote.status === 'approved' &&
    Array.isArray(input.quote.lines) && input.quote.lines.length > 0 && input.quote.lines.every(l => !!l.sourcePartId && partIds.has(l.sourcePartId) &&
    typeof l.unitRateInr === 'number' && Number.isFinite(l.unitRateInr) && l.unitRateInr >= 0);
  add('scene_quotation', 'Priced and approved scene-linked quotation', quoteOk,
    quoteOk ? `Quoted ${input.quote?.lines?.length} scene-linked part(s)` : 'No approved quotation that traces every priced line to a part in this exact scene',
    'Save a scene-linked quotation revision with supplier rate evidence and explicitly approve it after exact production parts review.');

  return {
    schema: 'ultida.kitchen-milestone.v1' as const,
    projectId: input.projectId,
    roomId: input.roomId,
    sceneVersionId: input.sceneVersionId,
    completed: checks.filter(c => c.status === 'pass').length,
    total: checks.length,
    ready: checks.every(c => c.status === 'pass'),
    checks,
    note: 'Evidence audit only. It does not create or approve a plan, module, scene, render, production package or quotation.'
  };
}

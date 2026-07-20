import { ArrowRight, CheckCircle2, CircleDashed, FileUp, Image, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PlanReviewWorkspace } from './components/plan/PlanReviewWorkspace';
import { DesignFlowWorkspace } from './components/design/DesignFlowWorkspace';
import { BriefWorkspace, ClientBrief, emptyBrief } from './components/brief/BriefWorkspace';
import { DeliveryWorkspace } from './components/delivery/DeliveryWorkspace';
import { CommercialWorkspace } from './components/commercial/CommercialWorkspace';
import { Badge, Button, Card, CardContent, CardHeader, Separator } from './components/ui/primitives';
import { supabase, supabaseConfigured } from './lib/supabase';
import './intake.css';

const stages = [
  ['Brief', 'Capture scope, budget and client decisions.'],
  ['Plan', 'Upload, calibrate and approve measured geometry.'],
  ['Design', 'Place modular furniture against the approved plan.'],
  ['Visualize', 'Generate and refine scene-linked AI proposals.'],
  ['Document', 'Issue elevations, DXF, cutlists and quotations.'],
  ['Commercial', 'Price approved scope with catalog, labour, tax and margin controls.'],
  ['Deliver', 'Approve, install, hand over and support.']
] as const;
type ProviderStatus = { id: string; configured: boolean; operations: string[] };
type AuraTool = { id: string; label: string; group: 'plan' | 'scene' | 'visual' | 'production' | 'commercial'; description: string; mode: 'read' | 'propose' | 'confirm'; requires: string[] };
type AuraPreview = { toolId: string; text: string; requiresConfirmation: boolean } | null;
const auraGroups: Array<[AuraTool['group'], string]> = [['plan', 'Plan'], ['scene', 'Scene'], ['visual', 'Visual'], ['production', 'Production'], ['commercial', 'Commercial']];

export function App() {
  const [showIntake, setShowIntake] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [message, setMessage] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  const [approvedPlanVersionId, setApprovedPlanVersionId] = useState<string | null>(null);
  const [sceneVersionNumber, setSceneVersionNumber] = useState(0);
  const [activeStage, setActiveStage] = useState<(typeof stages)[number][0]>('Brief');
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState('No plan uploaded');
  const [planAnalysed, setPlanAnalysed] = useState(false);
  const [planProposals, setPlanProposals] = useState<Array<{ id: string; kind: string; confidence: number; status: string; note: string }>>([]);
  const [planApproved, setPlanApproved] = useState(false);
  const [reviewSnapshot, setReviewSnapshot] = useState<unknown>(null);
  const [sceneVersionId, setSceneVersionId] = useState<string | null>(null);
  const [sceneModules, setSceneModules] = useState<Array<{ id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number }>>([]);
  const [auraNextAction, setAuraNextAction] = useState('Create a project to activate readiness checks.');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [brief, setBrief] = useState<ClientBrief>(emptyBrief);
  const [briefSaved, setBriefSaved] = useState(false);
  const [auraTools, setAuraTools] = useState<AuraTool[]>([]);
  const [auraPreview, setAuraPreview] = useState<AuraPreview>(null);
  const [auraState, setAuraState] = useState('Loading AURA tools...');
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSessionEmail(next?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/aura/tools`)
      .then((response) => response.json())
      .then((payload) => { const tools = Array.isArray(payload.tools) ? payload.tools : []; setAuraTools(tools); setAuraState(tools.length ? '' : 'No AURA tools are available.'); })
      .catch(() => setAuraState('AURA tool registry unavailable.'));
  }, []);

  function requirementReady(requirement: string) {
    return { source_asset: Boolean(sourceAssetId || planFile), approved_plan: planApproved, scene: Boolean(sceneVersionId), selected_modules: sceneModules.length > 0, room: Boolean(sceneVersionId), production_ready: false, catalog_prices: false }[requirement as keyof Record<string, boolean>] ?? false;
  }

  async function previewAuraTool(tool: AuraTool) {
    if (!tool.requires.every(requirementReady)) return;
    if (!['generate_tv_unit', 'change_laminate'].includes(tool.id)) {
      if (tool.id === 'analyze_plan') setActiveStage('Plan');
      if (tool.id === 'generate_visual_proposal') setActiveStage('Visualize');
      if (tool.id === 'generate_elevations' || tool.id === 'generate_cutlist' || tool.id === 'calculate_quote') setActiveStage('Document');
      return;
    }
    setAuraState(`Preparing ${tool.label} preview...`);
    try {
      const body = tool.id === 'generate_tv_unit'
        ? { projectId: activeProjectId ?? 'demo-project', sceneVersionId, roomId: 'living', widthMm: 1800, style: 'professional modular interior' }
        : { projectId: activeProjectId ?? 'demo-project', sceneVersionId, roomId: 'living', laminate: 'warm oak matte', style: 'coordinated modular interior' };
      const response = await fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/aura/tools/${tool.id}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok || !payload.success) { setAuraPreview(null); setAuraState(payload.message ?? 'Preview unavailable.'); return; }
      setAuraPreview({ toolId: tool.id, text: JSON.stringify(payload.proposal), requiresConfirmation: Boolean(payload.proposal?.requiresConfirmation) }); setAuraState('Preview ready. No scene mutation has been made.');
    } catch { setAuraPreview(null); setAuraState('Preview service unavailable. The scene is unchanged.'); }
  }

  function confirmAuraPreview() {
    setAuraState('Confirmation recorded. Mutation is not available from this preview endpoint; the scene is unchanged.');
    setAuraPreview(null);
  }

  useEffect(() => {
    if (!activeProjectId) { setAuraNextAction('Create a project to activate readiness checks.'); return; }
    let cancelled = false;
    fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/aura/project-readiness?projectId=${encodeURIComponent(activeProjectId)}`)
      .then((response) => response.json())
      .then((payload) => { if (!cancelled && payload.success) setAuraNextAction(payload.nextAction ?? 'Review the current project.'); })
      .catch(() => { if (!cancelled) setAuraNextAction('Readiness service unavailable. The project data is unchanged.'); });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/providers`)
      .then((response) => response.json())
      .then((payload) => setProviderStatuses(Array.isArray(payload.providers) ? payload.providers : []))
      .catch(() => setProviderStatuses([]));
  }, []);

  function selectPlan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'application/pdf', 'application/dxf', 'application/acad', 'application/octet-stream'].includes(file.type) && !/\.(dxf|dwg)$/i.test(file.name)) return setPlanStatus('Use PNG, JPEG, PDF, DXF or DWG.');
    setPlanFile(file); setPlanAnalysed(false); setPlanStatus('Ready for plan intake');
    setPlanPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  }

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return setMessage('Supabase is not configured. Add the publishable workspace keys first.');
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email: authEmail, password: authPassword })
      : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (result.error) return setMessage(result.error.message);
    setMessage(authMode === 'signup' ? 'Check your email to confirm access, then sign in.' : 'Signed in. You can now create the project.');
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectName.trim()) return setMessage('Give the project a name first.');
    if (!supabaseConfigured || !supabase) return setMessage('Supabase is not configured.');
    const { data: userData } = await supabase.auth.getUser(); const user = userData.user;
    if (!user) return setMessage('Your session expired. Sign in again.');
    const orgName = organizationName.trim() || `${user.email?.split('@')[0] ?? 'Studio'} Studio`;
    const slug = `${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
    const org = await supabase.from('organizations').insert({ name: orgName, slug, created_by: user.id }).select('id').single();
    if (org.error) return setMessage(org.error.message);
    const member = await supabase.from('organization_members').insert({ organization_id: org.data.id, user_id: user.id, role: 'owner' });
    if (member.error) return setMessage(member.error.message);
    const project = await supabase.from('projects').insert({ organization_id: org.data.id, name: projectName.trim(), client_name: clientName.trim(), created_by: user.id }).select('id').single();
    if (project.error) return setMessage(project.error.message);
    setActiveOrganizationId(org.data.id); setActiveProjectId(project.data.id); setBrief((current) => ({ ...current, clientName: clientName.trim(), projectName: projectName.trim() })); setShowIntake(false); setMessage(''); setActiveStage('Brief');
  }

  async function saveBrief(nextBrief: ClientBrief) {
    if (supabase && activeProjectId) {
      const saved = await supabase.from('projects').update({ brief: nextBrief, client_name: nextBrief.clientName, name: nextBrief.projectName, updated_at: new Date().toISOString() }).eq('id', activeProjectId);
      if (saved.error) throw new Error(saved.error.message);
    }
    setBrief(nextBrief); setBriefSaved(true);
  }

  async function analysePlan() {
    if (!planFile) return setPlanStatus('Choose a floor plan first.');
    setPlanStatus('Uploading and preparing review...');
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(planFile); });
    if (supabase && activeProjectId && activeOrganizationId) {
      const path = `${activeOrganizationId}/${activeProjectId}/${crypto.randomUUID()}-${planFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const stored = await supabase.storage.from('project-assets').upload(path, planFile, { contentType: planFile.type, upsert: false });
      if (stored.error) return setPlanStatus(stored.error.message);
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const asset = await supabase.from('project_assets').insert({ project_id: activeProjectId, kind: 'floor_plan', storage_path: path, mime_type: planFile.type, metadata: { originalName: planFile.name, size: planFile.size }, created_by: userId }).select('id').single();
      if (asset.error) return setPlanStatus(asset.error.message);
      setSourceAssetId(asset.data.id);
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/plan/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: activeProjectId ?? 'demo-project', fileName: planFile.name, mimeType: planFile.type, dataUrl }) });
      const payload = await response.json();
      if (!response.ok) return setPlanStatus(payload.message ?? 'Plan intake failed.');
      setPlanProposals(payload.analysis?.proposals ?? []); setPlanAnalysed(true); setPlanStatus('Intake complete. Review geometry before approval.');
    } catch { setPlanStatus('Plan service is unavailable. Check the API, then try again.'); }
  }

  async function approvePlan(snapshot: unknown) {
    setReviewSnapshot(snapshot);
    if (supabase && activeProjectId && activeOrganizationId) {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return setPlanStatus('Your session expired. Sign in again before approval.');
      const plan = await supabase.from('floor_plan_versions').insert({ project_id: activeProjectId, version_number: 1, status: 'review', source_asset_id: sourceAssetId, interpretation: snapshot, confidence: 1, created_by: userId }).select('id').single();
      if (plan.error) return setPlanStatus(`Plan approval could not be saved: ${plan.error.message}`);
      const approved = await supabase.from('floor_plan_versions').update({ status: 'approved', change_reason: 'Designer approved reviewed floor plan' }).eq('id', plan.data.id).select('id').single();
      if (approved.error) return setPlanStatus(`Plan approval could not be finalized: ${approved.error.message}`);
      setApprovedPlanVersionId(plan.data.id);
    } else setApprovedPlanVersionId(crypto.randomUUID());
    setPlanApproved(true); setPlanStatus('Reviewed plan approved. The next step is modular design.'); setActiveStage('Design');
  }
  async function saveScene(id: string, modules: typeof sceneModules) {
    const nextNumber = sceneVersionNumber + 1;
    if (supabase && activeProjectId && activeOrganizationId && approvedPlanVersionId) {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return setMessage('Your session expired. Sign in again before saving scene changes.');
      const reviewed = (reviewSnapshot ?? {}) as { zones?: Array<{ id: string; name: string; x: number; y: number }>; walls?: Array<{ id: string; start: { x: number; y: number }; end: { x: number; y: number } }> };
      const rooms = (reviewed.zones ?? []).map((zone) => ({ id: zone.id, name: zone.name, type: 'other' as const, boundary: [{ xMm: zone.x, yMm: zone.y }, { xMm: zone.x + 170, yMm: zone.y }, { xMm: zone.x + 170, yMm: zone.y + 120 }, { xMm: zone.x, yMm: zone.y + 120 }] }));
      const walls = (reviewed.walls ?? []).map((wall) => ({ id: wall.id, start: { xMm: wall.start.x, yMm: wall.start.y }, end: { xMm: wall.end.x, yMm: wall.end.y }, thicknessMm: 150, heightMm: 2700 }));
      const scene = { schema: 'scene.v1', units: 'mm', projectId: activeProjectId, floorPlanVersionId: approvedPlanVersionId, rooms, walls, openings: [], modules: modules.map((module) => ({ id: module.id, roomId: module.roomId, family: module.family, widthMm: module.widthMm, depthMm: module.depthMm, heightMm: module.heightMm, position: { xMm: 0, yMm: 0 }, rotationDeg: 0 })), materials: [], metadata: { branch: 'main', status: 'draft', changeReason: nextNumber === 1 ? 'Create modular scene' : 'Update modular placement' } };
      const saved = await supabase.from('scene_versions').insert({ project_id: activeProjectId, floor_plan_version_id: approvedPlanVersionId, version_number: nextNumber, branch_name: 'main', status: 'draft', scene, change_reason: scene.metadata.changeReason, created_by: userId }).select('id').single();
      if (saved.error) return setMessage(`Scene could not be saved: ${saved.error.message}`);
      await supabase.from('artifacts').update({ status: 'stale' }).eq('project_id', activeProjectId).neq('status', 'stale');
      id = saved.data.id;
    }
    setSceneVersionId(id); setSceneVersionNumber(nextNumber); setSceneModules(modules);
  }
  const stageDetail = stages.find(([name]) => name === activeStage)?.[1] ?? '';

  return <div className={`app-shell${navCollapsed ? ' nav-collapsed' : ''}`}><aside><div className="brand"><span>U</span><div><strong>ULTIDA</strong><small>Interior Design OS</small></div><button className="rail-toggle" aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setNavCollapsed((value) => !value)}>{navCollapsed ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}</button></div><nav><Button className="active"><LayoutDashboard size={15}/><span>Command center</span></Button><div className="nav-label">PROJECT LIFECYCLE</div>{stages.map(([name], index) => <Button variant="ghost" className={activeStage === name ? 'stage-active' : ''} onClick={() => setActiveStage(name)} key={name}><span>{String(index + 1).padStart(2, '0')}</span>{name}</Button>)}</nav><div className="system"><CheckCircle2 size={15}/><span>Foundation ready</span></div></aside><main>
    <header className="command-header"><div className="command-header-title"><button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setNavCollapsed((value) => !value)}><Menu size={18}/></button><div><small>COMMAND CENTER / {activeStage.toUpperCase()}</small><h1>{activeProjectId ? (brief.projectName || projectName || 'Current project') : 'Studio command center'}</h1><p className="lede">{stageDetail}</p></div></div><div className="header-actions"><Badge tone={supabaseConfigured ? 'success' : 'neutral'}>{supabaseConfigured ? 'Connected' : 'Local preview'}</Badge><Badge tone={planApproved ? 'success' : briefSaved ? 'accent' : 'neutral'}>{planApproved ? 'Approved plan' : briefSaved ? 'Needs review' : 'Brief required'}</Badge>{sessionEmail && <Button variant="outline" onClick={() => supabase?.auth.signOut()}>Sign out</Button>}</div></header>
    <Card className="project-band"><CardContent><small>ACTIVE PROJECT</small><h2>{activeProjectId ? projectName || 'Current project' : 'Set up your first project'}</h2><p>{activeProjectId ? 'The workflow is now tied to this project.' : 'Start with a client brief. Every later output inherits its approved plan and scene.'}</p></CardContent><Button onClick={() => setShowIntake(true)}><Plus size={16}/> {activeProjectId ? 'New project' : 'Create project'}</Button></Card>
    <section className="readiness-grid"><Card><small>PROJECTS</small><strong>{activeProjectId ? '1' : '0'}</strong><span>{activeProjectId ? 'Active workspace' : 'Ready to begin'}</span></Card><Card><small>PLAN READINESS</small><strong>{planApproved ? 'Approved' : planAnalysed ? 'Review' : '--'}</strong><span>{planApproved ? 'Geometry can drive the scene' : planStatus}</span></Card><Card><small>SCENE OUTPUTS</small><strong>{sceneVersionId ? String(sceneModules.length) : '0'}</strong><span>{sceneVersionId ? 'Modules linked to current scene' : 'Create an approved scene first'}</span></Card><Card><small>AI PROVIDERS</small><strong>{providerStatuses.filter((provider) => provider.configured).length}/{providerStatuses.length || '--'}</strong><span>{providerStatuses.length ? providerStatuses.filter((provider) => provider.configured).map((provider) => provider.id).join(', ') || 'No provider configured' : 'Gateway status pending'}</span></Card></section>
    <section className="aura-shelf"><div className="section-title"><div><small>AURA TOOL SHELF</small><h2>Context-aware studio tools</h2></div><Badge tone={auraTools.length ? 'success' : 'neutral'}>{auraTools.length ? `${auraTools.length} tools` : 'Unavailable'}</Badge></div>{auraState && <p className="aura-state" role="status">{auraState}</p>}{auraPreview && <div className="aura-preview"><strong>Preview from {auraPreview.toolId}</strong><code>{auraPreview.text}</code>{auraPreview.requiresConfirmation && <Button onClick={confirmAuraPreview}>Confirm preview</Button>}</div>}<div className="aura-groups">{auraGroups.map(([group, label]) => <div className="aura-group" key={group}><small>{label}</small><div className="aura-tool-grid">{auraTools.filter((tool) => tool.group === group).map((tool) => { const missing = tool.requires.filter((requirement) => !requirementReady(requirement)); return <Card className={`aura-tool${missing.length ? ' aura-tool-disabled' : ''}`} key={tool.id}><CardContent><div className="aura-tool-head"><strong>{tool.label}</strong><Badge>{tool.mode}</Badge></div><p>{tool.description}</p><span className="aura-requirement">{missing.length ? `Requires ${missing.join(', ')}` : `Ready: ${tool.requires.join(', ') || 'project context'}`}</span><Button variant="outline" disabled={Boolean(missing.length)} onClick={() => previewAuraTool(tool)}>{tool.id === 'generate_tv_unit' || tool.id === 'change_laminate' ? 'Preview' : 'Open tool'} <ArrowRight size={14} /></Button></CardContent></Card>; })}</div></div>)}</div></section>
    {activeStage === 'Brief' ? <BriefWorkspace initialBrief={brief} onSave={saveBrief}/> : activeStage === 'Plan' ? <PlanReviewWorkspace fileName={planFile?.name} preview={planPreview} status={planStatus} analysed={planAnalysed} proposals={planProposals} onFile={selectPlan} onAnalyze={analysePlan} onApprove={approvePlan}/> : activeStage === 'Design' || activeStage === 'Visualize' || activeStage === 'Document' ? <DesignFlowWorkspace stage={activeStage} projectId={activeProjectId} planApproved={planApproved} briefComplete={briefSaved} sceneVersionId={sceneVersionId} modules={sceneModules} onSceneCreated={saveScene}/> : activeStage === 'Commercial' ? <CommercialWorkspace briefSaved={briefSaved} planApproved={planApproved} sceneVersionId={sceneVersionId} moduleCount={sceneModules.length}/> : activeStage === 'Deliver' ? <DeliveryWorkspace briefSaved={briefSaved} planApproved={planApproved} sceneVersionId={sceneVersionId} moduleCount={sceneModules.length} providerReady={providerStatuses.some((provider) => provider.configured)}/> : <section className="content-grid"><Card className="workflow"><CardHeader className="section-title"><div><small>DESIGN JOURNEY</small><h2>Keep the project moving.</h2></div><span>{activeProjectId ? '1 of 7 active' : '0 of 7 ready'}</span></CardHeader><CardContent>{stages.map(([name, detail], index) => <article className={activeStage === name ? 'selected-row' : ''} onClick={() => setActiveStage(name)} key={name}><div className="step-icon">{index === 0 ? <CircleDashed size={18}/> : <span>{index + 1}</span>}</div><div><h3>{name}</h3><p>{detail}</p></div><button aria-label={`Open ${name}`}><ArrowRight size={16}/></button></article>)}</CardContent></Card><Card className="side-panel"><small>NEXT BEST ACTION</small><FileUp size={24}/><h2>{activeProjectId ? 'Continue current stage' : 'Create a project'}</h2><p>{activeProjectId ? stageDetail : 'Record the client, budget and scope before the plan workspace opens.'}</p><Button className="full" onClick={() => activeProjectId ? setActiveStage('Plan') : setShowIntake(true)}>{activeProjectId ? 'Open plan review' : 'Open brief intake'} <ArrowRight size={16}/></Button><Separator/><small>QUICK ACCESS</small><div className="quick-tools"><Button variant="outline" onClick={() => setActiveStage('Plan')}><Upload size={16}/><span>Plan intake</span></Button><Button variant="outline" onClick={() => setActiveStage('Visualize')}><Image size={16}/><span>AI visual proposal</span></Button></div><Separator/><small>AURA</small><div className="aura"><Sparkles size={18}/><p>AURA proposes actions only after project context is available.</p></div></Card></section>}
    {showIntake && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={sessionEmail ? createProject : authenticate}><div className="modal-head"><div><small>{sessionEmail ? 'CLIENT INTAKE' : 'WORKSPACE ACCESS'}</small><h2>{sessionEmail ? 'Create a project' : 'Sign in to ULTIDA'}</h2></div><button type="button" className="icon-button" aria-label="Close intake" onClick={() => setShowIntake(false)}><X size={18}/></button></div>{!sessionEmail && <><label>Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@studio.com" autoFocus /></label><label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 8 characters" /></label></>}{sessionEmail && <><label>Studio / organization<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="e.g. Atelier North" autoFocus /></label><label>Project name<input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Mehta Residence" /></label><label>Client name<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client or family name" /></label></>}{message && <div className="inline-message">{message}</div>}<button className="primary full" type="submit">{sessionEmail ? <><Plus size={16}/> Create project</> : authMode === 'signin' ? 'Sign in' : 'Create account'}</button>{!sessionEmail && <button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>{authMode === 'signin' ? 'Need a studio account? Create one' : 'Already have access? Sign in'}</button>}</form></div>}
  </main></div>;
}

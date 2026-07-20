import { ArrowRight, CheckCircle2, CircleDashed, FileUp, Sparkles, Plus, X, LayoutDashboard, Upload, Ruler, Image, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { Badge, Button, Card, CardContent, CardHeader, Separator } from './components/ui/primitives';
import './intake.css';

const stages = [
  ['Brief', 'Capture scope, budget and client decisions.'],
  ['Plan', 'Upload, calibrate and approve measured geometry.'],
  ['Design', 'Place modular furniture against the approved plan.'],
  ['Visualize', 'Generate and refine scene-linked AI proposals.'],
  ['Document', 'Issue elevations, DXF, cutlists and quotations.'],
  ['Deliver', 'Approve, install, hand over and support.']
];

export function App() {
  const [showIntake, setShowIntake] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [message, setMessage] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [organizationName, setOrganizationName] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState('Brief');
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState('No plan uploaded');
  const [planResult, setPlanResult] = useState<{ message: string; confidence: number; fileName: string } | null>(null);
  const [reviewTool, setReviewTool] = useState<'select' | 'wall' | 'zone'>('select');
  const [reviewPoints, setReviewPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [zoneCount, setZoneCount] = useState(0);
  const [knownWallMm, setKnownWallMm] = useState('3000');
  const [calibrationScale, setCalibrationScale] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSessionEmail(next?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectName.trim()) return setMessage('Give the project a name first.');
    if (!supabaseConfigured || !supabase) return setMessage('Supabase is not configured. Add the publishable workspace keys first.');
    if (!sessionEmail) return setMessage('Sign in before creating a workspace project.');
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return setMessage('Your session expired. Sign in again.');
    const orgName = organizationName.trim() || `${user.email?.split('@')[0] ?? 'Studio'} Studio`;
    const slug = `${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
    const org = await supabase.from('organizations').insert({ name: orgName, slug, created_by: user.id }).select('id').single();
    if (org.error) return setMessage(org.error.message);
    const member = await supabase.from('organization_members').insert({ organization_id: org.data.id, user_id: user.id, role: 'owner' });
    if (member.error) return setMessage(member.error.message);
    const project = await supabase.from('projects').insert({ organization_id: org.data.id, name: projectName.trim(), client_name: clientName.trim(), created_by: user.id }).select('id').single();
    if (project.error) return setMessage(project.error.message);
    setActiveOrganizationId(org.data.id); setActiveProjectId(project.data.id); setShowIntake(false); setMessage(''); setActiveStage('Plan');
  }

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return setMessage('Supabase is not configured.');
    const result = authMode === 'signup' ? await supabase.auth.signUp({ email: authEmail, password: authPassword }) : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (result.error) return setMessage(result.error.message);
    setMessage(authMode === 'signup' ? 'Check your email to confirm access, then sign in.' : 'Signed in. You can now create the project.');
  }

  async function signOut() {
    await supabase?.auth.signOut(); setSessionEmail(null); setActiveProjectId(null); setActiveOrganizationId(null);
  }

  function selectPlan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) return setPlanStatus('Use PNG, JPEG or PDF.');
    setPlanFile(file); setPlanResult(null); setPlanStatus('Ready to analyse');
    if (file.type.startsWith('image/')) setPlanPreview(URL.createObjectURL(file)); else setPlanPreview(null);
  }

  function markPlan(event: React.MouseEvent<HTMLDivElement>) {
    if (!planPreview || reviewTool === 'select') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
    if (reviewTool === 'zone') setZoneCount((count) => count + 1);
    else setReviewPoints((points) => [...points, point]);
  }

  function calibrate() {
    const px = reviewPoints.length >= 2 ? Math.hypot(reviewPoints[1].x - reviewPoints[0].x, reviewPoints[1].y - reviewPoints[0].y) : 0;
    if (!px || !Number(knownWallMm)) return setPlanStatus('Mark two points along a known wall first.');
    setCalibrationScale(Number(knownWallMm) / px); setPlanStatus('Scale calibrated');
  }

  async function analysePlan() {
    if (!planFile) return setPlanStatus('Choose a floor plan first.');
    setPlanStatus('Uploading and preparing review...');
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(planFile); });
    if (supabase && activeProjectId && activeOrganizationId) {
      const storagePath = `${activeOrganizationId}/${activeProjectId}/${crypto.randomUUID()}-${planFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const stored = await supabase.storage.from('project-assets').upload(storagePath, planFile, { contentType: planFile.type, upsert: false });
      if (stored.error) return setPlanStatus(stored.error.message);
      const asset = await supabase.from('project_assets').insert({ organization_id: activeOrganizationId, project_id: activeProjectId, kind: 'floor_plan_source', storage_path: storagePath, mime_type: planFile.type, metadata: { originalName: planFile.name, size: planFile.size }, created_by: (await supabase.auth.getUser()).data.user?.id }).select('id').single();
      if (asset.error) return setPlanStatus(asset.error.message);
    }
    const response = await fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/plan/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: activeProjectId ?? 'demo-project', fileName: planFile.name, mimeType: planFile.type, dataUrl }) });
    const payload = await response.json();
    if (!response.ok) return setPlanStatus(payload.message ?? 'Plan upload failed.');
    setPlanResult(payload.analysis); setPlanStatus('Review required');
  }

  return <div className="app-shell">
    <aside>
      <div className="brand"><span>U</span><div><strong>ULTIDA</strong><small>Interior Design OS</small></div></div>
      <nav><Button className="active"><LayoutDashboard size={15}/><span>Command center</span></Button><div className="nav-label">PROJECT LIFECYCLE</div>{stages.map(([name], index) => <Button variant="ghost" className={activeStage === name ? 'stage-active' : ''} onClick={() => setActiveStage(name)} key={name}><span>{String(index + 1).padStart(2, '0')}</span>{name}</Button>)}</nav>
      <div className="system"><CheckCircle2 size={15}/> Foundation ready</div>
    </aside>
    <main>
      <header><div><small>COMMAND CENTER / {activeStage.toUpperCase()}</small><h1>Design work, in the right order.</h1><p className="lede">One measured project moving from brief to build-ready delivery.</p></div><div className="header-actions"><Badge tone={supabaseConfigured ? 'success' : 'neutral'}>{supabaseConfigured ? 'Supabase connected' : 'Local preview'}</Badge><Button variant="outline">Provider status</Button></div></header>
      <Card className="project-band"><CardContent><small>ACTIVE PROJECT</small><h2>Set up your first project</h2><p>Start with the client brief. Every later output will inherit its approved plan and scene.</p></CardContent><Button onClick={() => setShowIntake(true)}><Plus size={16}/> New project</Button></Card>
      <section className="readiness-grid"><Card><small>PROJECTS</small><strong>0</strong><span>Ready to begin</span></Card><Card><small>PLAN READINESS</small><strong>--</strong><span>Upload a floor plan</span></Card><Card><small>OUTPUTS</small><strong>0</strong><span>Nothing stale yet</span></Card><Card><small>AI PROVIDERS</small><strong>2</strong><span>Gateway monitored</span></Card></section>
      {activeStage === 'Plan' ? <section className="plan-workspace"><Card className="plan-upload"><CardHeader><small>PLAN INTAKE</small><h2>Bring in the measured floor plan.</h2><p>Upload the source drawing first. ULTIDA will preserve it before proposing geometry.</p></CardHeader><CardContent><label className="dropzone"><Upload size={22}/><strong>{planFile ? planFile.name : 'Choose a PNG, JPEG or PDF'}</strong><span>{planFile ? `${Math.round(planFile.size / 1024)} KB · ${planStatus}` : 'Maximum 25 MB'}</span><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={selectPlan}/></label>{planPreview && <img className="plan-preview" src={planPreview} alt="Uploaded floor plan preview"/>}<Button onClick={analysePlan} disabled={!planFile}>{planStatus === 'Uploading and preparing review...' ? 'Preparing...' : 'Run plan intake'}</Button>{planResult && <div className="analysis-result"><Badge>Review required</Badge><h3>{planResult.fileName}</h3><p>{planResult.message}</p><span>Confidence: {planResult.confidence}% · Walls: 0 · Rooms: 0 · Openings: 0</span></div>}</CardContent></Card><Card className="plan-next"><small>REVIEW GATE</small><h2>What happens next</h2><div className="review-step"><span>01</span><p><strong>Calibrate</strong> Mark one known wall dimension.</p></div><div className="review-step"><span>02</span><p><strong>Detect</strong> Propose rooms, walls, doors and windows.</p></div><div className="review-step"><span>03</span><p><strong>Approve</strong> Resolve low-confidence geometry before scene generation.</p></div></Card></section> : <section className="content-grid">
        <Card className="workflow"><CardHeader className="section-title"><div><small>DESIGN JOURNEY</small><h2>Keep the project moving.</h2></div><span>0 of 6 ready</span></CardHeader><CardContent>
          {stages.map(([name, detail], index) => <article className={activeStage === name ? 'selected-row' : ''} onClick={() => setActiveStage(name)} key={name}><div className="step-icon">{index === 0 ? <CircleDashed size={18}/> : <span>{index + 1}</span>}</div><div><h3>{name}</h3><p>{detail}</p></div><button aria-label={`Open ${name}`}><ArrowRight size={16}/></button></article>)}
        </CardContent></Card>
        <Card className="side-panel"><small>NEXT BEST ACTION</small><FileUp size={24}/><h2>{activeStage === 'Plan' ? 'Upload the floor plan' : 'Add the client brief'}</h2><p>{activeStage === 'Plan' ? 'Bring in a PDF, image or CAD file. Then calibrate one known wall before analysis.' : 'Record intent, budget and room priorities before the plan workspace opens.'}</p><Button className="full" onClick={() => setShowIntake(true)}>{activeStage === 'Plan' ? 'Open plan intake' : 'Open brief intake'} <ChevronRight size={16}/></Button><Separator/><small>QUICK ACCESS</small><div className="quick-tools"><Button variant="outline" onClick={() => setActiveStage('Plan')}><Upload size={16}/><span>Plan intake</span></Button><Button variant="outline" onClick={() => setActiveStage('Plan')}><Ruler size={16}/><span>Review geometry</span></Button><Button variant="outline" onClick={() => setActiveStage('Visualize')}><Image size={16}/><span>AI visual proposal</span></Button></div><Separator/><small>AURA</small><div className="aura"><Sparkles size={18}/><p>Suggestions appear after the project has approved context.</p></div></Card>
      </section>}
      {showIntake && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={sessionEmail ? createProject : authenticate}><div className="modal-head"><div><small>{sessionEmail ? 'CLIENT INTAKE' : 'WORKSPACE ACCESS'}</small><h2>{sessionEmail ? 'Create a project' : 'Sign in to ULTIDA'}</h2></div><button type="button" className="icon-button" aria-label="Close intake" onClick={() => setShowIntake(false)}><X size={18}/></button></div>{!sessionEmail && <><label>Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@studio.com" autoFocus /></label><label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 8 characters" /></label></>}{sessionEmail && <><label>Studio / organization<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="e.g. Atelier North" autoFocus /></label><label>Project name<input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Mehta Residence" /></label><label>Client name<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client or family name" /></label></>}{message && <div className="inline-message">{message}</div>}<button className="primary full" type="submit">{sessionEmail ? <><Plus size={16}/> Create project</> : authMode === 'signin' ? 'Sign in' : 'Create account'}</button>{!sessionEmail && <button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>{authMode === 'signin' ? 'Need a studio account? Create one' : 'Already have access? Sign in'}</button>}</form></div>}
    </main>
  </div>;
}

import { ArrowRight, CheckCircle2, CircleDashed, FileUp, Sparkles, Plus, X, LayoutDashboard, Upload, Ruler, Image, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './lib/supabase';
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
  const [activeStage, setActiveStage] = useState('Brief');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSessionEmail(next?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectName.trim()) return setMessage('Give the project a name first.');
    if (!supabaseConfigured || !supabase || !sessionEmail) {
      setMessage('Project intake is ready, but sign in to save it to your workspace.');
      return;
    }
    setMessage('Your organization setup is the next required step before saving projects.');
  }

  return <div className="app-shell">
    <aside>
      <div className="brand"><span>U</span><div><strong>ULTIDA</strong><small>Interior Design OS</small></div></div>
      <nav><button className="active"><LayoutDashboard size={15}/><span>Command center</span></button><div className="nav-label">PROJECT LIFECYCLE</div>{stages.map(([name], index) => <button className={activeStage === name ? 'stage-active' : ''} onClick={() => setActiveStage(name)} key={name}><span>{String(index + 1).padStart(2, '0')}</span>{name}</button>)}</nav>
      <div className="system"><CheckCircle2 size={15}/> Foundation ready</div>
    </aside>
    <main>
      <header><div><small>COMMAND CENTER / {activeStage.toUpperCase()}</small><h1>Design work, in the right order.</h1><p className="lede">One measured project moving from brief to build-ready delivery.</p></div><div className="header-actions"><span className={supabaseConfigured ? 'status ready' : 'status'}>{supabaseConfigured ? 'Supabase connected' : 'Local preview'}</span><button className="quiet">Provider status</button></div></header>
      <section className="project-band"><div><small>ACTIVE PROJECT</small><h2>Set up your first project</h2><p>Start with the client brief. Every later output will inherit its approved plan and scene.</p></div><button className="primary" onClick={() => setShowIntake(true)}><Plus size={16}/> New project</button></section>
      <section className="readiness-grid"><div><small>PROJECTS</small><strong>0</strong><span>Ready to begin</span></div><div><small>PLAN READINESS</small><strong>--</strong><span>Upload a floor plan</span></div><div><small>OUTPUTS</small><strong>0</strong><span>Nothing stale yet</span></div><div><small>AI PROVIDERS</small><strong>2</strong><span>Gateway monitored</span></div></section>
      <section className="content-grid">
        <div className="workflow"><div className="section-title"><div><small>DESIGN JOURNEY</small><h2>Keep the project moving.</h2></div><span>0 of 6 ready</span></div>
          {stages.map(([name, detail], index) => <article className={activeStage === name ? 'selected-row' : ''} onClick={() => setActiveStage(name)} key={name}><div className="step-icon">{index === 0 ? <CircleDashed size={18}/> : <span>{index + 1}</span>}</div><div><h3>{name}</h3><p>{detail}</p></div><button aria-label={`Open ${name}`}><ArrowRight size={16}/></button></article>)}
        </div>
        <div className="side-panel"><small>NEXT BEST ACTION</small><FileUp size={24}/><h2>{activeStage === 'Plan' ? 'Upload the floor plan' : 'Add the client brief'}</h2><p>{activeStage === 'Plan' ? 'Bring in a PDF, image or CAD file. Then calibrate one known wall before analysis.' : 'Record intent, budget and room priorities before the plan workspace opens.'}</p><button className="primary full" onClick={() => setShowIntake(true)}>{activeStage === 'Plan' ? 'Open plan intake' : 'Open brief intake'} <ChevronRight size={16}/></button><hr/><small>QUICK ACCESS</small><div className="quick-tools"><button onClick={() => setActiveStage('Plan')}><Upload size={16}/><span>Plan intake</span></button><button onClick={() => setActiveStage('Plan')}><Ruler size={16}/><span>Review geometry</span></button><button onClick={() => setActiveStage('Visualize')}><Image size={16}/><span>AI visual proposal</span></button></div><hr/><small>AURA</small><div className="aura"><Sparkles size={18}/><p>Suggestions appear after the project has approved context.</p></div></div>
      </section>
      {showIntake && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={createProject}><div className="modal-head"><div><small>CLIENT INTAKE</small><h2>Create a project</h2></div><button type="button" className="icon-button" aria-label="Close intake" onClick={() => setShowIntake(false)}><X size={18}/></button></div><label>Project name<input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Mehta Residence" autoFocus /></label><label>Client name<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client or family name" /></label><p className="modal-note">The project will begin in Brief. Plan upload and review unlock after this step.</p>{message && <div className="inline-message">{message}</div>}<button className="primary full" type="submit"><Plus size={16}/> Create project</button></form></div>}
    </main>
  </div>;
}

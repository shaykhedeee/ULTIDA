import { ArrowRight, CheckCircle2, CircleDashed, FileUp, Sparkles, Plus, X } from 'lucide-react';
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
      <nav>{stages.map(([name], index) => <button className={index === 0 ? 'active' : ''} key={name}><span>{String(index + 1).padStart(2, '0')}</span>{name}</button>)}</nav>
      <div className="system"><CheckCircle2 size={15}/> Foundation ready</div>
    </aside>
    <main>
      <header><div><small>ACTIVE WORKSPACE</small><h1>From measured plan to delivered interior.</h1></div><div className="header-actions"><span className={supabaseConfigured ? 'status ready' : 'status'}>{supabaseConfigured ? 'Supabase connected' : 'Local preview'}</span><button className="quiet">Provider status</button></div></header>
      <section className="project-band"><div><small>NEW PROJECT</small><h2>Start with a client brief</h2><p>Record intent and budget before the plan workspace opens.</p></div><button className="primary" onClick={() => setShowIntake(true)}>Start brief <ArrowRight size={16}/></button></section>
      <section className="content-grid">
        <div className="workflow"><div className="section-title"><div><small>PROJECT WORKFLOW</small><h2>One truth, every output.</h2></div><span>0 of 6 ready</span></div>
          {stages.map(([name, detail], index) => <article key={name}><div className="step-icon">{index === 0 ? <CircleDashed size={18}/> : <span>{index + 1}</span>}</div><div><h3>{name}</h3><p>{detail}</p></div><button aria-label={`Open ${name}`}><ArrowRight size={16}/></button></article>)}
        </div>
        <div className="side-panel"><small>NEXT ACTION</small><FileUp size={24}/><h2>Add the client brief</h2><p>The plan workspace stays locked until project intent and known measurements are recorded.</p><button className="primary full" onClick={() => setShowIntake(true)}>Open intake</button><hr/><small>AURA</small><div className="aura"><Sparkles size={18}/><p>Suggestions will appear here when a project has enough approved context.</p></div></div>
      </section>
      {showIntake && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={createProject}><div className="modal-head"><div><small>CLIENT INTAKE</small><h2>Create a project</h2></div><button type="button" className="icon-button" aria-label="Close intake" onClick={() => setShowIntake(false)}><X size={18}/></button></div><label>Project name<input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Mehta Residence" autoFocus /></label><label>Client name<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client or family name" /></label><p className="modal-note">The project will begin in Brief. Plan upload and review unlock after this step.</p>{message && <div className="inline-message">{message}</div>}<button className="primary full" type="submit"><Plus size={16}/> Create project</button></form></div>}
    </main>
  </div>;
}

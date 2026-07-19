import { ArrowRight, CheckCircle2, CircleDashed, FileUp, Sparkles } from 'lucide-react';

const stages = [
  ['Brief', 'Capture scope, budget and client decisions.'],
  ['Plan', 'Upload, calibrate and approve measured geometry.'],
  ['Design', 'Place modular furniture against the approved plan.'],
  ['Visualize', 'Generate and refine scene-linked AI proposals.'],
  ['Document', 'Issue elevations, DXF, cutlists and quotations.'],
  ['Deliver', 'Approve, install, hand over and support.']
];

export function App() {
  return <div className="app-shell">
    <aside>
      <div className="brand"><span>U</span><div><strong>ULTIDA</strong><small>Interior Design OS</small></div></div>
      <nav>{stages.map(([name], index) => <button className={index === 0 ? 'active' : ''} key={name}><span>{String(index + 1).padStart(2, '0')}</span>{name}</button>)}</nav>
      <div className="system"><CheckCircle2 size={15}/> Foundation ready</div>
    </aside>
    <main>
      <header><div><small>ACTIVE WORKSPACE</small><h1>From measured plan to delivered interior.</h1></div><button className="quiet">Provider status</button></header>
      <section className="project-band"><div><small>FIRST GOLDEN PROJECT</small><h2>Modular kitchen</h2><p>Complete the brief, then upload the measured plan.</p></div><button className="primary">Start brief <ArrowRight size={16}/></button></section>
      <section className="content-grid">
        <div className="workflow"><div className="section-title"><div><small>PROJECT WORKFLOW</small><h2>One truth, every output.</h2></div><span>0 of 6 ready</span></div>
          {stages.map(([name, detail], index) => <article key={name}><div className="step-icon">{index === 0 ? <CircleDashed size={18}/> : <span>{index + 1}</span>}</div><div><h3>{name}</h3><p>{detail}</p></div><button aria-label={`Open ${name}`}><ArrowRight size={16}/></button></article>)}
        </div>
        <div className="side-panel"><small>NEXT ACTION</small><FileUp size={24}/><h2>Add the client brief</h2><p>The plan workspace stays locked until project intent and known measurements are recorded.</p><button className="primary full">Open intake</button><hr/><small>AURA</small><div className="aura"><Sparkles size={18}/><p>Suggestions will appear here when a project has enough approved context.</p></div></div>
      </section>
    </main>
  </div>;
}

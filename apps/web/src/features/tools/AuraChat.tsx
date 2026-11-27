import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, Compass, Loader2, MessageSquareText, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import { loadProjectProgress, saveProjectProgress } from '../pipeline/project-progress-api';
import type { ProjectPipeline } from '../pipeline/PipelineWorkspace';
import './aura-chat.css';

const apiBase = getApiBase();
type Project = { id: string; name: string };
type Tool = { id: string; label: string; mode: string; requires: string[] };
type NextAction = { method: string; path: string; body: Record<string, unknown> };
type ProgressProposal = { projectId: string; pipeline: ProjectPipeline };
type Message = { role: 'aura' | 'designer'; text: string; tools?: Tool[]; next?: NextAction | null; recovery?: string; progressProposal?: ProgressProposal; safety?: { geometryAuthority?: string; requiresApproval?: boolean; rollback?: boolean } };

const prompts = [
  { label: 'Check workflow', text: 'Explain the current blockers and the next safe action for this project.' },
  { label: 'Suggest modules', text: 'Propose suitable modular furniture for the selected room using the approved project context.' },
  { label: 'Review materials', text: 'Suggest a laminate and hardware direction as a reviewable proposal.' },
  { label: 'Prepare render', text: 'Explain what is required to prepare a scene-locked render revision.' },
];

async function authHeaders(): Promise<Record<string, string>> {
  const session = await supabase?.auth.getSession();
  return session?.data.session?.access_token ? { Authorization: `Bearer ${session.data.session.access_token}` } : {};
}

export function AuraChat() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'aura', text: 'I am AURA, ULTIDA’s supervised project assistant. I can inspect workflow state and prepare reviewable proposals for modules, materials and renders. I never change geometry, quotes, cutlists, or production status on my own.' }]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projects, projectId]);

  useEffect(() => {
    void (async () => {
      const result = await supabase?.from('projects').select('id,name').neq('project_status', 'archived').order('updated_at', { ascending: false });
      const next = (result?.data ?? []) as Project[];
      setProjects(next);
      setProjectId((current) => current || next[0]?.id || '');
    })();
  }, []);

  async function send(requestText = input) {
    const text = requestText.trim();
    if (!text || !projectId || busy) return;
    setInput('');
    setMessages((current) => [...current, { role: 'designer', text }]);
    setBusy(true);
    try {
      const actionRequest = /^set next action for\s+(.+?)\s*\/\s*(.+?)\s+to:\s*(.+)$/i.exec(text);
      if (actionRequest) {
        const [, room, title, action] = actionRequest;
        const matches = (value: string | undefined | null, query: string) => value?.trim().toLowerCase() === query.trim().toLowerCase();
        const pipeline = await loadProjectProgress(projectId, await authHeaders());
        const files = pipeline.files.filter(file => file.round && matches(file.roomName, room) &&
          (matches(file.title, title) || matches(`${file.title} [${file.round} v${file.sequence}]`, title)));
        const file = files.length === 1 ? files[0] : undefined;
        let reply: Message;
        if (!file || action.length > 400) {
          reply = { role: 'aura', text: files.length > 1
            ? 'More than one revision matches. Add the round and version after the file title, for example Elevation [R02 v3].'
            : action.length > 400 ? 'Use up to 400 characters for the next action.' : 'No revision matches that room and file title. Check the names in Project Progress.' };
        } else {
          reply = { role: 'aura', text: `Update ${file.roomName} / ${file.title} · ${file.round} v${file.sequence} to “${action}”?`,
            progressProposal: { projectId, pipeline: { ...pipeline, files: pipeline.files.map(item =>
              item.id === file.id ? { ...item, nextAction: action } : item) } } };
        }
        setMessages(current => [...current, reply]);
        return;
      }
      if (/^what changed in project progress\??$/i.test(text)) {
        const pipeline = await loadProjectProgress(projectId, await authHeaders());
        const recent = pipeline.files
          .filter(file => file.round)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 5)
          .map(file =>
            `${file.roomName} / ${file.title} · ${file.round} v${file.sequence} — ${file.notes} Next: ${file.nextAction}`);
        setMessages(current => [...current, { role: 'aura', text: recent.join('\n') || 'This project has no recorded revision rounds yet.' }]);
        return;
      }
      const response = await fetch(`${apiBase}/projects/${projectId}/aura/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ message: text }) });
      const payload = await response.json().catch(() => ({}));
      setMessages((current) => [...current, {
        role: 'aura',
        text: payload.message ?? payload.error ?? 'AURA could not prepare a response.',
        tools: Array.isArray(payload.tools) ? payload.tools : [],
        next: payload.next ?? null,
        recovery: payload.recovery,
        safety: payload.safety,
      }]);
    } catch {
      setMessages((current) => [...current, { role: 'aura', text: 'AURA is temporarily unavailable. Your project was not changed.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmProgress(proposal: ProgressProposal) {
    if (busy || proposal.projectId !== projectId) return;
    setBusy(true);
    try {
      await saveProjectProgress(proposal.projectId, proposal.pipeline, await authHeaders());
      setMessages(current => [
        ...current.map(message => message.progressProposal === proposal ? { ...message, progressProposal: undefined } : message),
        { role: 'aura', text: 'Next action saved in Project Progress.' },
      ]);
    } catch (error) {
      setMessages(current => [...current, {
        role: 'aura', text: error instanceof Error ? error.message : 'The next action could not be saved.',
        recovery: 'Ask again to review the latest revision before confirming.',
      }]);
    } finally {
      setBusy(false);
    }
  }

  async function preview(message: Message, tool: Tool) {
    if (!message.next || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}${message.next.path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ ...message.next.body, projectId, toolId: tool.id }) });
      const payload = await response.json().catch(() => ({}));
      setMessages((current) => [...current, { role: 'aura', text: payload.success ? `${tool.label} proposal is ready for designer review. No project data was changed.` : (payload.message ?? 'AURA could not prepare that proposal.'), recovery: payload.recovery }]);
    } catch {
      setMessages((current) => [...current, { role: 'aura', text: 'The proposal request failed safely. No project data was changed.' }]);
    } finally {
      setBusy(false);
    }
  }

  return <main className="aura-workspace">
    <header className="aura-hero">
      <div>
        <p><Sparkles size={14} /> SUPERVISED DESIGN AGENT</p>
        <h1>AURA workspace</h1>
        <span>Ask for guidance, not automation. Every proposal stays attached to project context and awaits designer approval.</span>
      </div>
      <div className="aura-safety-card"><ShieldCheck size={19} /><div><strong>Review-gated</strong><small>scene.v1 remains authoritative</small></div></div>
    </header>

    <section className="aura-context" aria-label="AURA project context">
      <div><Compass size={17} /><div><small>WORKING PROJECT</small><strong>{selectedProject?.name ?? 'Choose a project'}</strong></div></div>
      <label>Project<select value={projectId} onChange={(event) => {
        setProjectId(event.target.value);
        setMessages(current => current.slice(0, 1));
      }} disabled={busy}>{!projects.length && <option value="">Create a project first</option>}{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    </section>

    <section className="aura-layout">
      <aside className="aura-guide">
        <div><small>WHAT AURA CAN DO</small><h2>Guide the next step.</h2><p>Review design suggestions and confirm updates to Project Progress.</p></div>
        <div className="aura-guide-list">
          <span><CheckCircle2 size={14} /> Explain blockers and readiness</span>
          <span><CheckCircle2 size={14} /> Propose modules and finishes</span>
          <span><CheckCircle2 size={14} /> Prepare scene-linked render revisions</span>
          <span><CheckCircle2 size={14} /> Navigate the safe workflow</span>
        </div>
        <small className="aura-guardrail">AURA cannot silently alter approved geometry, production outputs, costs, or release state.</small>
      </aside>

      <section className="aura-chat-panel" aria-label="AURA conversation">
        <div className="aura-chat-topline"><div><MessageSquareText size={17} /><strong>Project conversation</strong></div><span>{busy ? 'Working' : 'Ready'}</span></div>
        <div className="aura-messages" aria-live="polite">
          {messages.map((message, index) => <article className={`aura-message ${message.role}`} key={`${message.role}-${index}`}>
            <div className="aura-message-label">{message.role === 'aura' ? <><Bot size={14} /> AURA</> : 'YOU'}</div>
            <p>{message.text}</p>
            {message.progressProposal && <button type="button" disabled={busy}
              onClick={() => { if (message.progressProposal) void confirmProgress(message.progressProposal); }}>Confirm next action</button>}
            {message.tools?.length ? <div className="aura-tool-actions">{message.tools.map((tool) => <div className="aura-tool-action" key={tool.id}><div><strong>{tool.label}</strong><small>{tool.mode} · {tool.requires.join(', ') || 'project context'}</small></div>{message.next ? <button type="button" onClick={() => void preview(message, tool)} disabled={busy}>Prepare preview <ArrowRight size={13} /></button> : null}</div>)}</div> : null}
            {message.recovery ? <small className="aura-recovery">Next: {message.recovery}</small> : null}
            {message.safety ? <small className="aura-safety-line">{message.safety.requiresApproval ? 'Approval required' : 'Read-only'} · {message.safety.geometryAuthority ?? 'Project context'}{message.safety.rollback ? ' · rollback available' : ''}</small> : null}
          </article>)}
          {busy ? <div className="aura-working"><Loader2 size={15} className="ultida-spinner" /> AURA is reading the permitted project context…</div> : null}
        </div>
        <div className="aura-suggestions" aria-label="Suggested AURA requests"><button type="button" disabled={!projectId || busy} onClick={() => void send('What changed in Project Progress?')}>Recent project revisions</button><button type="button" disabled={!projectId || busy} onClick={() => setInput('Set next action for ROOM / FILE to: ACTION')}>Set revision next action</button>{prompts.map((prompt) => <button key={prompt.label} type="button" onClick={() => void send(prompt.text)} disabled={!projectId || busy}>{prompt.label}</button>)}</div>
        <form className="aura-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={projectId ? 'Ask AURA about this project…' : 'Select a project to begin'} disabled={!projectId || busy} /><button type="submit" disabled={!projectId || !input.trim() || busy}><Send size={16} /><span>Send</span></button></form>
      </section>
    </section>
  </main>;
}

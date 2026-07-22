import {
  FolderKanban, MapPin, Home, Calendar, User,
  Plus, X, MoreHorizontal, ChevronRight, RefreshCw,
  Building2, Clock, AlertCircle, Sparkles
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './projects.css';

// ─── Types ────────────────────────────────────────────────────────
type Project = {
  id: string;
  name: string;
  client_name: string;
  location: string | null;
  property_type: string | null;
  workflow_stage: string;
  project_status: string;
  created_at: string;
  updated_at: string;
  assigned_designer: string | null;
};

type WorkflowStage = {
  id: string;
  status: 'done' | 'active' | 'locked';
};

const STAGE_ORDER = [
  'brief','plan','spaces','layouts','modules',
  'materials','3d','renders','drawings','estimate','presentation'
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  plan_processing: 'Processing Plan',
  plan_review: 'Plan Review',
  designing: 'Designing',
  client_review: 'Client Review',
  technical: 'Technical',
  approved: 'Approved',
  archived: 'Archived',
};

// ─── Helpers ──────────────────────────────────────────────────────
function getProgressPercent(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
}

function getStageStatuses(currentStage: string): WorkflowStage[] {
  const current = STAGE_ORDER.indexOf(currentStage);
  return STAGE_ORDER.map((id, i) => ({
    id,
    status: i < current ? 'done' : i === current ? 'active' : 'locked',
  }));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getThumbBg(index: number): string {
  const gradients = [
    'linear-gradient(135deg, #1a1208 0%, #3d2a1a 100%)',
    'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
    'linear-gradient(135deg, #0f2d1c 0%, #14532d 100%)',
    'linear-gradient(135deg, #1e1a2e 0%, #312e4d 100%)',
  ];
  return gradients[index % gradients.length];
}

// ─── New Project Modal ────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    name: '', client_name: '', location: '', property_type: 'apartment',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.client_name.trim()) {
      setError('Project name and client name are required.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (!supabase) throw new Error('Supabase not configured');

      // Get user and org
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      let organizationId = membership?.organization_id as string | undefined;
      if (!organizationId) {
        const slugBase = `${form.name}-${user.id.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const { data: organization, error: organizationError } = await supabase
          .from('organizations')
          .insert({ name: `${form.client_name.trim()} Studio`, slug: slugBase, created_by: user.id })
          .select('id')
          .single();
        if (organizationError || !organization) throw organizationError ?? new Error('Could not create the studio organization.');
        const { error: membershipError } = await supabase
          .from('organization_members')
          .insert({ organization_id: organization.id, user_id: user.id, role: 'owner' });
        if (membershipError) throw membershipError;
        organizationId = organization.id;
      }

      const { data: project, error: insertErr } = await supabase
        .from('projects')
        .insert({
          // The deployed legacy schema stores IDs as text and did not have a
          // database default. Supplying a UUID keeps every downstream project_id
          // reference stable while the database default protects non-browser inserts.
          id: crypto.randomUUID(),
          organization_id: organizationId,
          name: form.name.trim(),
          client_name: form.client_name.trim(),
          location: form.location.trim() || null,
          property_type: form.property_type,
          created_by: user.id,
          workflow_stage: 'brief',
          project_status: 'draft',
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      onCreated(project.id);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <small>New Project</small>
            <h2>Start a New Design Project</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Project Name *</label>
              <input
                type="text"
                placeholder="e.g. Sharma Residence — 3BHK"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label>Client Name *</label>
              <input
                type="text"
                placeholder="e.g. Priya Sharma"
                value={form.client_name}
                onChange={(e) => update('client_name', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Property Type</label>
              <select value={form.property_type} onChange={(e) => update('property_type', e.target.value)}>
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="bungalow">Bungalow</option>
                <option value="rowhouse">Row House</option>
                <option value="penthouse">Penthouse</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Location (City / Area)</label>
              <input
                type="text"
                placeholder="e.g. Bandra West, Mumbai"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
              />
            </div>
          </div>

          {error && <div className="inline-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating Project…' : 'Create Project & Open Brief →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────
function ProjectCard({ project, index, onClick }: { project: Project; index: number; onClick: () => void }) {
  const stages = getStageStatuses(project.workflow_stage);
  const progress = getProgressPercent(project.workflow_stage);

  return (
    <div className="project-card" onClick={onClick}>
      {/* Thumbnail */}
      <div className="card-thumb" style={{ background: getThumbBg(index) }}>
        <div className="card-thumb-placeholder">
          <Building2 size={36} style={{ opacity: .4 }} />
          <span style={{ fontSize: 12, opacity: .5 }}>No renders yet</span>
        </div>
        <div className="card-status-chip">
          <span className={`status-badge ${project.project_status === 'approved' ? 'approved' : project.project_status === 'designing' ? 'active' : 'draft'}`}>
            {STATUS_LABELS[project.project_status] ?? project.project_status}
          </span>
        </div>
        <div className="card-progress-bar">
          <div className="card-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="card-project-name">{project.name}</div>
        <div className="card-client-name">{project.client_name}</div>

        <div className="card-meta-row">
          {project.location && (
            <div className="card-meta-item">
              <MapPin size={11} /> {project.location}
            </div>
          )}
          {project.property_type && (
            <div className="card-meta-item">
              <Home size={11} /> {project.property_type}
            </div>
          )}
          <div className="card-meta-item">
            <Sparkles size={11} />
            <span style={{ textTransform: 'capitalize' }}>{project.workflow_stage.replace('-', ' ')}</span>
          </div>
        </div>

        {/* Stage dots */}
        <div className="card-stages" title={`Stage: ${project.workflow_stage} — ${progress}% complete`}>
          {stages.map((s) => (
            <div key={s.id} className={`card-stage-dot ${s.status}`} title={s.id} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="card-footer">
        <div className="card-footer-left">
          <Clock size={11} />
          <span>{timeAgo(project.updated_at)}</span>
        </div>
        <div className="card-footer-actions">
          <button className="card-action-btn" onClick={(e) => { e.stopPropagation(); }}>
            <MoreHorizontal size={12} />
          </button>
          <button className="card-action-btn primary" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            Open <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="project-card project-card-skeleton">
      <div className="card-thumb" />
      <div className="card-body">
        <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 13, width: '45%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 10, width: '100%', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 6, height: 6, borderRadius: '50%' }} />
          ))}
        </div>
      </div>
      <div className="card-footer">
        <div className="skeleton" style={{ height: 12, width: 60 }} />
        <div className="skeleton" style={{ height: 28, width: 70, borderRadius: 6 }} />
      </div>
    </div>
  );
}

// ─── Main ProjectDashboard ────────────────────────────────────────
const STATUS_FILTERS = ['all', 'draft', 'designing', 'client_review', 'approved', 'archived'];

export function ProjectDashboard({ sessionEmail, orgName }: { sessionEmail?: string | null; orgName?: string | null }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('projects')
        .select('id, name, client_name, location, property_type, workflow_stage, project_status, created_at, updated_at, assigned_designer')
        .order('updated_at', { ascending: false });
      if (err) throw err;
      setProjects((data ?? []) as Project[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.location ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.project_status === statusFilter;
    return matchSearch && matchStatus;
  });

  function openProject(project: Project) {
    navigate(`/projects/${project.id}/brief`);
  }

  return (
    <>
      <div className="projects-dashboard">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-text">
            <small>Interior Design OS</small>
            <h1>Projects</h1>
            <p>
              {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''} — ${orgName ?? 'your organisation'}`}
            </p>
          </div>
          <div className="page-header-actions">
            <button
              onClick={load}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => setShowNew(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'var(--brown-mid)', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={15} /> New Project
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <input
            className="filter-search"
            type="text"
            placeholder="Search projects, clients, locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-pill${statusFilter === f ? ' active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f] ?? f}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid var(--error-line)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)', fontSize: 13 }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Project grid */}
        <div className="project-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filtered.length === 0 ? (
            <div className="projects-empty">
              <div className="projects-empty-icon">
                <FolderKanban size={36} />
              </div>
              <h2>{search || statusFilter !== 'all' ? 'No matching projects' : 'No projects yet'}</h2>
              <p>
                {search || statusFilter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Create your first project to start designing with AI-assisted modular interior design.'}
              </p>
              {!search && statusFilter === 'all' && (
                <button
                  onClick={() => setShowNew(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--brown-mid)', color: '#fff', border: 0, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
                >
                  <Plus size={15} /> Create First Project
                </button>
              )}
            </div>
          ) : (
            filtered.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} onClick={() => openProject(p)} />
            ))
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            navigate(`/projects/${id}/brief`);
          }}
        />
      )}
    </>
  );
}

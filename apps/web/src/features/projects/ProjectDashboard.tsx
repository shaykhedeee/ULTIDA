import {
  FolderKanban, MapPin, Home, Calendar, User,
  Plus, X, ChevronRight, RefreshCw,
  Building2, Clock, AlertCircle, Sparkles, CheckCircle2, ArrowUpRight,
  Archive, ArchiveRestore, LayoutGrid, Table, Crown
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  workflow_blocker?: string | null;
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

function getNextStep(stage: string): string {
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0) return 'Start project brief';
  return index >= STAGE_ORDER.length - 1 ? 'Ready for delivery' : `Continue ${STAGE_ORDER[index + 1]}`;
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
          {/* Quick-Start Templates */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
              ✨ Quick-Start Project Templates
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { name: 'Singhania Royal Villa (5BHK)', client: 'Rajesh & Gayatri Singhania', loc: 'Greenways Road, Alibaug / Chennai', type: 'villa', featured: true },
                { name: 'Sharma Residence (3BHK)', client: 'Rohit & Ananya Sharma', loc: 'Pali Hill, Bandra West, Mumbai', type: 'apartment' },
                { name: 'Skyline Penthouse (4BHK)', client: 'Dr. Sameer Roy', loc: 'Indiranagar, Bengaluru', type: 'penthouse' },
                { name: 'Japandi Villa Minimalist', client: 'Ayesha Mehta', loc: 'Golf Links, New Delhi', type: 'villa' },
              ].map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setForm({ name: tmpl.name, client_name: tmpl.client, location: tmpl.loc, property_type: tmpl.type })}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: tmpl.featured ? '1px solid rgba(197,156,45,0.5)' : '1px solid #e7e5e4',
                    background: tmpl.featured ? 'rgba(197,156,45,0.08)' : '#fafaf9',
                    fontSize: 11.5,
                    fontWeight: tmpl.featured ? 750 : 600,
                    color: tmpl.featured ? '#8a6512' : '#44403c',
                    cursor: 'pointer',
                  }}
                >
                  {tmpl.featured ? `👑 ${tmpl.name}` : tmpl.name}
                </button>
              ))}
            </div>
          </div>

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
function ProjectCard({ project, index, onClick, onArchive }: { project: Project; index: number; onClick: () => void; onArchive: () => void }) {
  const stages = getStageStatuses(project.workflow_stage);
  const progress = getProgressPercent(project.workflow_stage);
  const isVilla = project.property_type?.toLowerCase() === 'villa' || project.name.toLowerCase().includes('villa');
  const estArea = isVilla ? '8,500 sq.ft · 5BHK Villa' : project.property_type?.toLowerCase() === 'penthouse' ? '4,200 sq.ft · 4BHK Penthouse' : '2,400 sq.ft · 3BHK Flat';

  return (
    <div
      className="project-card"
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      aria-label={`Open ${project.name}`}
    >
      {/* Thumbnail */}
      <div className="card-thumb" style={{ background: getThumbBg(index) }}>
        <div className="card-thumb-placeholder">
          {isVilla ? (
            <Crown size={34} style={{ opacity: 0.65, color: '#f8e7be' }} />
          ) : (
            <Building2 size={36} style={{ opacity: 0.4 }} />
          )}
          <span style={{ fontSize: 12, opacity: 0.6 }}>{isVilla ? 'Luxury Villa CAD Model' : 'No renders yet'}</span>
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
        <div className="card-header-line">
          <span className={`card-typology-badge ${project.property_type || 'apartment'}`}>
            {isVilla && <Crown size={11} style={{ marginRight: 3, display: 'inline' }} />}
            {project.property_type || 'Apartment'}
          </span>
          <span className="card-area-hint">{estArea}</span>
        </div>
        <div className="card-project-name">{project.name}</div>
        <div className="card-client-name">{project.client_name}</div>

        <div className="card-meta-row">
          {project.location && (
            <div className="card-meta-item">
              <MapPin size={11} /> {project.location}
            </div>
          )}
          <div className="card-meta-item">
            <Sparkles size={11} />
            <span style={{ textTransform: 'capitalize' }}>{project.workflow_stage.replace('-', ' ')}</span>
          </div>
        </div>

        <div className="card-owner-row">
          <div className="designer-avatar"><User size={12} /></div>
          <span>{project.assigned_designer || 'Studio team · unassigned'}</span>
          <span className="card-next-step">{project.workflow_blocker ? project.workflow_blocker : `Next: ${getNextStep(project.workflow_stage)}`}</span>
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
          <button className={`card-action-btn archive${project.project_status === 'archived' ? ' restore' : ''}`} onClick={(e) => { e.stopPropagation(); onArchive(); }}>
            {project.project_status === 'archived' ? <ArchiveRestore size={12} /> : <Archive size={12} />}
            {project.project_status === 'archived' ? 'Restore' : 'Trash'}
          </button>
          <button className="card-action-btn primary" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            Open <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Schedule Table ───────────────────────────────────────
function ProjectScheduleTable({
  projects,
  onOpen,
  onArchive,
}: {
  projects: Project[];
  onOpen: (p: Project) => void;
  onArchive: (p: Project) => void;
}) {
  return (
    <div className="projects-schedule-table-wrap">
      <table className="projects-schedule-table">
        <thead>
          <tr>
            <th className="schedule-th">Project &amp; Client</th>
            <th className="schedule-th">Typology &amp; Location</th>
            <th className="schedule-th">Stage &amp; Progress</th>
            <th className="schedule-th">Est. Footprint</th>
            <th className="schedule-th">Lead Designer</th>
            <th className="schedule-th">Last Activity</th>
            <th className="schedule-th text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p, idx) => {
            const progress = getProgressPercent(p.workflow_stage);
            const isVilla = p.property_type?.toLowerCase() === 'villa' || p.name.toLowerCase().includes('villa');
            const estArea = isVilla ? '8,500 sq.ft' : p.property_type?.toLowerCase() === 'penthouse' ? '4,200 sq.ft' : '2,400 sq.ft';
            const roomEstimate = isVilla ? '5BHK Suites' : p.property_type?.toLowerCase() === 'penthouse' ? '4BHK Penthouse' : '3BHK Flat';

            return (
              <tr key={p.id} className="schedule-row" onClick={() => onOpen(p)}>
                <td className="schedule-td">
                  <div className="schedule-proj-cell">
                    <div className="schedule-avatar" style={{ background: getThumbBg(idx) }}>
                      {isVilla ? <Crown size={14} color="#f8e7be" /> : <Building2 size={14} color="#e5e7eb" />}
                    </div>
                    <div>
                      <strong className="schedule-proj-name">{p.name}</strong>
                      <span className="schedule-client-name">{p.client_name}</span>
                    </div>
                  </div>
                </td>
                <td className="schedule-td">
                  <div className="schedule-typology-cell">
                    <span className={`schedule-typology-badge ${p.property_type || 'apartment'}`}>
                      {p.property_type || 'Apartment'}
                    </span>
                    <span className="schedule-loc-text">{p.location || 'Site unassigned'}</span>
                  </div>
                </td>
                <td className="schedule-td">
                  <div className="schedule-stage-cell">
                    <div className="schedule-stage-header">
                      <span className="schedule-stage-name">{p.workflow_stage.replace('-', ' ')}</span>
                      <span className="schedule-stage-pct">{progress}%</span>
                    </div>
                    <div className="schedule-prog-bar">
                      <div className="schedule-prog-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </td>
                <td className="schedule-td">
                  <div className="schedule-area-cell">
                    <strong className="schedule-area-val">{estArea}</strong>
                    <span className="schedule-area-sub">{roomEstimate}</span>
                  </div>
                </td>
                <td className="schedule-td">
                  <span className="schedule-designer-text">{p.assigned_designer || 'Studio Team'}</span>
                </td>
                <td className="schedule-td">
                  <span className="schedule-time-text">{timeAgo(p.updated_at)}</span>
                </td>
                <td className="schedule-td text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="schedule-actions">
                    <button
                      className={`card-action-btn archive${p.project_status === 'archived' ? ' restore' : ''}`}
                      onClick={() => onArchive(p)}
                      title={p.project_status === 'archived' ? 'Restore Project' : 'Archive Project'}
                    >
                      {p.project_status === 'archived' ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                    </button>
                    <button
                      className="card-action-btn primary"
                      onClick={() => onOpen(p)}
                    >
                      Open <ChevronRight size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function apiBase() {
  const configured = String(import.meta.env.VITE_API_BASE ?? '').trim();
  const isLocalTarget = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/?$/i.test(configured);
  if (typeof window !== 'undefined' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(window.location.origin) && isLocalTarget) return '/api';
  return configured || '/api';
}

export function ProjectDashboard({ sessionEmail, orgName }: { sessionEmail?: string | null; orgName?: string | null }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const placingPreparedModule = searchParams.get('placeModule') === '1';
  const attachingRoomDraft = searchParams.get('attachRoom') === '1';

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
      const projectRows = (data ?? []) as Project[];
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token || !projectRows.length) {
        setProjects(projectRows);
        return;
      }
      const hydrated = await Promise.all(projectRows.map(async (project) => {
        try {
          const response = await fetch(`${apiBase()}/projects/${project.id}/workflow-status`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.success || typeof payload.stages !== 'object') return project;
          const stage = STAGE_ORDER.find((id) => !payload.stages[id]) ?? STAGE_ORDER.at(-1)!;
          return { ...project, workflow_stage: stage, workflow_blocker: payload.stageLockReasons?.[stage] ?? null };
        } catch {
          return project;
        }
      }));
      setProjects(hydrated);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [loadingDemo, setLoadingDemo] = useState<'3bhk' | '5bhk' | null>(null);

  const handleLoadDemoProject = async (type: '3bhk' | '5bhk' = '5bhk') => {
    setLoadingDemo(type);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase not configured');
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
        const { data: organization } = await supabase
          .from('organizations')
          .insert({ name: 'ULTIDA Studio', slug: `studio-${user.id.slice(0, 8)}`, created_by: user.id })
          .select('id')
          .single();
        if (organization) {
          await supabase.from('organization_members').insert({ organization_id: organization.id, user_id: user.id, role: 'owner' });
          organizationId = organization.id;
        }
      }

      const projectName = type === '5bhk' ? 'Singhania Royal Villa (5BHK)' : 'Sharma Luxury Residence (3BHK)';
      const clientName = type === '5bhk' ? 'Rajesh & Gayatri Singhania' : 'Rohit & Ananya Sharma';
      const location = type === '5bhk' ? 'Greenways Road, Alibaug / Chennai' : 'Pali Hill, Bandra West, Mumbai';
      const propType = type === '5bhk' ? 'villa' : 'apartment';

      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('name', projectName)
        .limit(1)
        .maybeSingle();

      let demoProjectId = existing?.id;

      if (!demoProjectId) {
        demoProjectId = crypto.randomUUID();
        const { error: insertErr } = await supabase.from('projects').insert({
          id: demoProjectId,
          organization_id: organizationId,
          name: projectName,
          client_name: clientName,
          location,
          property_type: propType,
          created_by: user.id,
          workflow_stage: 'plan',
          project_status: 'draft',
        });
        if (insertErr) throw insertErr;
      }

      // Seed scene version if not exists
      const { data: existingScene } = await supabase
        .from('scene_versions')
        .select('id')
        .eq('project_id', demoProjectId)
        .limit(1)
        .maybeSingle();

      if (!existingScene) {
        const villaScene = {
          schema: 'scene.v1',
          units: 'mm',
          rooms: [
            {
              id: 'room-grand-living',
              name: 'Double-Height Formal Living & Foyer',
              boundary: [
                { xMm: 0, yMm: 0 },
                { xMm: 10200, yMm: 0 },
                { xMm: 10200, yMm: 6800 },
                { xMm: 0, yMm: 6800 },
                { xMm: 0, yMm: 0 },
              ],
            },
            {
              id: 'room-show-kitchen',
              name: 'Show Kitchen & Breakfast Island',
              boundary: [
                { xMm: 10500, yMm: 0 },
                { xMm: 17169, yMm: 0 },
                { xMm: 17169, yMm: 4500 },
                { xMm: 10500, yMm: 4500 },
                { xMm: 10500, yMm: 0 },
              ],
            },
            {
              id: 'room-pooja-mandir',
              name: 'Walk-In Sacred Pooja Mandir',
              boundary: [
                { xMm: 10500, yMm: 4800 },
                { xMm: 12275, yMm: 4800 },
                { xMm: 12275, yMm: 7050 },
                { xMm: 10500, yMm: 7050 },
                { xMm: 10500, yMm: 4800 },
              ],
            },
            {
              id: 'room-master-suite',
              name: 'Master Suite & Walk-In Wardrobe',
              boundary: [
                { xMm: 0, yMm: 7200 },
                { xMm: 7500, yMm: 7200 },
                { xMm: 7500, yMm: 12600 },
                { xMm: 0, yMm: 12600 },
                { xMm: 0, yMm: 7200 },
              ],
            },
            {
              id: 'room-guest-suite',
              name: 'Garden Guest Suite',
              boundary: [
                { xMm: 7800, yMm: 7200 },
                { xMm: 13000, yMm: 7200 },
                { xMm: 13000, yMm: 11600 },
                { xMm: 7800, yMm: 11600 },
                { xMm: 7800, yMm: 7200 },
              ],
            },
          ],
          walls: [
            { id: 'wv-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 10200, yMm: 0 }, thicknessMm: 230, heightMm: 3229 },
            { id: 'wv-2', start: { xMm: 10200, yMm: 0 }, end: { xMm: 10200, yMm: 6800 }, thicknessMm: 230, heightMm: 3229 },
            { id: 'wv-3', start: { xMm: 10200, yMm: 6800 }, end: { xMm: 0, yMm: 6800 }, thicknessMm: 150, heightMm: 3229 },
            { id: 'wv-4', start: { xMm: 0, yMm: 6800 }, end: { xMm: 0, yMm: 0 }, thicknessMm: 230, heightMm: 3229 },
            { id: 'wv-5', start: { xMm: 10500, yMm: 0 }, end: { xMm: 17169, yMm: 0 }, thicknessMm: 230, heightMm: 3000 },
            { id: 'wv-6', start: { xMm: 17169, yMm: 0 }, end: { xMm: 17169, yMm: 4500 }, thicknessMm: 230, heightMm: 3000 },
            { id: 'wv-7', start: { xMm: 10500, yMm: 4800 }, end: { xMm: 12275, yMm: 4800 }, thicknessMm: 150, heightMm: 3000 },
          ],
          openings: [
            { id: 'opv-1', wallId: 'wv-4', offsetMm: 2500, widthMm: 1500, heightMm: 2700, kind: 'door' },
            { id: 'opv-2', wallId: 'wv-1', offsetMm: 3600, widthMm: 3000, heightMm: 2400, sillHeightMm: 300, kind: 'window' },
          ],
          modules: [
            { id: 'modv-tv-wall', family: 'tv-console', widthMm: 5030, depthMm: 450, heightMm: 3229, position: { xMm: 2500, yMm: 300 }, rotationDeg: 0, materialId: 'mat-fluted-walnut' },
            { id: 'modv-wardrobe', family: 'wardrobe', widthMm: 2977, depthMm: 650, heightMm: 2690, position: { xMm: 3000, yMm: 7500 }, rotationDeg: 0, materialId: 'mat-smoked-oak' },
            { id: 'modv-mandir', family: 'mandir-altar', widthMm: 1775, depthMm: 600, heightMm: 3000, position: { xMm: 10600, yMm: 5100 }, rotationDeg: 0, materialId: 'mat-backlit-onyx' },
            { id: 'modv-kitchen', family: 'kitchen-tall', widthMm: 6669, depthMm: 650, heightMm: 3000, position: { xMm: 10500, yMm: 300 }, rotationDeg: 0, materialId: 'mat-acrylic-pearl' },
          ],
          moduleParts: [],
          materials: [
            { id: 'mat-fluted-walnut', name: 'Architectural Fluted Walnut & Onyx', code: 'FLT-WL-01', finish: 'Woodgrain & PU Stone' },
            { id: 'mat-smoked-oak', name: 'Smoked Crown Oak & Profile Glass', code: 'LAM-WD-04', finish: 'Velvet Matte & Glass' },
            { id: 'mat-backlit-onyx', name: 'Translucent Backlit Onyx & Brass', code: 'STN-OX-02', finish: 'Backlit Stone & Polished Brass' },
            { id: 'mat-acrylic-pearl', name: 'High-Gloss Pearl White Acrylic', code: 'LAM-HG-01', finish: 'High Gloss' },
          ],
          cameras: [
            { id: 'cam-v1', name: 'Grand Living Perspective', position: { xMm: 5100, yMm: 4500, zMm: 1800 }, target: { xMm: 5100, yMm: 0, zMm: 1200 }, lensMm: 24 },
          ],
        };

        const sharmaScene = {
          schema: 'scene.v1',
          units: 'mm',
          rooms: [
            { id: 'room-living', name: 'Living & Dining Room', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 6300, yMm: 0 }, { xMm: 6300, yMm: 4800 }, { xMm: 0, yMm: 4800 }, { xMm: 0, yMm: 0 }] },
            { id: 'room-master-bed', name: 'Master Bedroom', boundary: [{ xMm: 6600, yMm: 0 }, { xMm: 11400, yMm: 0 }, { xMm: 11400, yMm: 4800 }, { xMm: 6600, yMm: 4800 }, { xMm: 6600, yMm: 0 }] },
            { id: 'room-kitchen', name: 'Modular Kitchen', boundary: [{ xMm: 0, yMm: 5100 }, { xMm: 4500, yMm: 5100 }, { xMm: 4500, yMm: 9000 }, { xMm: 0, yMm: 9000 }, { xMm: 0, yMm: 5100 }] },
          ],
          walls: [
            { id: 'w1', start: { xMm: 0, yMm: 0 }, end: { xMm: 6300, yMm: 0 }, thicknessMm: 230, heightMm: 2700 },
            { id: 'w2', start: { xMm: 0, yMm: 0 }, end: { xMm: 0, yMm: 4800 }, thicknessMm: 230, heightMm: 2700 },
            { id: 'w3', start: { xMm: 0, yMm: 4800 }, end: { xMm: 6300, yMm: 4800 }, thicknessMm: 150, heightMm: 2700 },
            { id: 'w4', start: { xMm: 6300, yMm: 0 }, end: { xMm: 6300, yMm: 4800 }, thicknessMm: 150, heightMm: 2700 },
            { id: 'w5', start: { xMm: 6600, yMm: 0 }, end: { xMm: 11400, yMm: 0 }, thicknessMm: 230, heightMm: 2700 },
            { id: 'w6', start: { xMm: 11400, yMm: 0 }, end: { xMm: 11400, yMm: 4800 }, thicknessMm: 230, heightMm: 2700 },
            { id: 'w7', start: { xMm: 6600, yMm: 4800 }, end: { xMm: 11400, yMm: 4800 }, thicknessMm: 230, heightMm: 2700 },
            { id: 'w8', start: { xMm: 0, yMm: 5100 }, end: { xMm: 0, yMm: 9000 }, thicknessMm: 230, heightMm: 2700 },
            { id: 'w9', start: { xMm: 0, yMm: 9000 }, end: { xMm: 4500, yMm: 9000 }, thicknessMm: 230, heightMm: 2700 },
            { id: 'w10', start: { xMm: 4500, yMm: 5100 }, end: { xMm: 4500, yMm: 9000 }, thicknessMm: 150, heightMm: 2700 },
          ],
          openings: [
            { id: 'op-1', wallId: 'w2', offsetMm: 1200, widthMm: 1050, heightMm: 2400, kind: 'door' },
            { id: 'op-2', wallId: 'w1', offsetMm: 2400, widthMm: 1800, heightMm: 1800, sillHeightMm: 600, kind: 'window' },
            { id: 'op-3', wallId: 'w6', offsetMm: 1500, widthMm: 1500, heightMm: 1500, sillHeightMm: 900, kind: 'window' },
          ],
          modules: [
            { id: 'mod-kit-base-1', family: 'kitchen-base', widthMm: 2400, depthMm: 600, heightMm: 860, position: { xMm: 1200, yMm: 8700 }, rotationDeg: 0, materialId: 'mat-acrylic-pearl' },
            { id: 'mod-wardrobe-1', family: 'wardrobe', widthMm: 2100, depthMm: 600, heightMm: 2400, position: { xMm: 9000, yMm: 300 }, rotationDeg: 0, materialId: 'mat-smoked-oak' },
            { id: 'mod-bed-1', family: 'bed-king', widthMm: 1950, depthMm: 2100, heightMm: 1100, position: { xMm: 9000, yMm: 2600 }, rotationDeg: 0, materialId: 'mat-linen-warm' },
            { id: 'mod-tv-1', family: 'tv-console', widthMm: 2400, depthMm: 400, heightMm: 450, position: { xMm: 3150, yMm: 300 }, rotationDeg: 0, materialId: 'mat-fluted-walnut' },
          ],
          moduleParts: [],
          materials: [
            { id: 'mat-acrylic-pearl', name: 'High-Gloss Pearl White Acrylic', code: 'LAM-HG-01', finish: 'High Gloss' },
            { id: 'mat-smoked-oak', name: 'Smoked Crown Oak Veneer', code: 'LAM-WD-04', finish: 'Velvet Matte' },
            { id: 'mat-linen-warm', name: 'Warm Beige Bouclé Upholstery', code: 'FAB-BC-01', finish: 'Fabric' },
            { id: 'mat-fluted-walnut', name: 'Architectural Fluted Walnut Panel', code: 'FLT-WL-01', finish: 'Woodgrain' },
          ],
          cameras: [
            { id: 'cam-1', name: 'Living Perspective', position: { xMm: 3150, yMm: 3000, zMm: 1600 }, target: { xMm: 3150, yMm: 0, zMm: 900 }, lensMm: 28 },
          ],
        };

        try {
          await supabase.from('scene_versions').insert({
            id: crypto.randomUUID(),
            project_id: demoProjectId,
            version_number: 1,
            status: 'approved',
            scene: type === '5bhk' ? villaScene : sharmaScene,
          });
        } catch {
          // ignore
        }
      }

      navigate(`/projects/${demoProjectId}/plan`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load demo project');
    } finally {
      setLoadingDemo(null);
    }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (searchParams.get('new') === '1') setShowNew(true); }, [searchParams]);

  const filtered = projects.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.location ?? '').toLowerCase().includes(search.toLowerCase());
    // Archived work is recoverable, but deliberately kept out of the active
    // portfolio until the user chooses the Archived filter.
    const matchStatus = statusFilter === 'all'
      ? p.project_status !== 'archived'
      : p.project_status === statusFilter;
    return matchSearch && matchStatus;
  });

  function openProject(project: Project) {
    if (placingPreparedModule) {
      navigate(`/projects/${project.id}/design?pendingModule=1`);
      return;
    }
    if (attachingRoomDraft) {
      navigate(`/projects/${project.id}/spaces?roomDraft=1`);
      return;
    }
    if (project.project_status === 'archived') {
      setArchiveTarget(project);
      return;
    }
    const stage = STAGE_ORDER.includes(project.workflow_stage) ? project.workflow_stage : 'brief';
    navigate(`/projects/${project.id}/${stage}`);
  }

  async function updateProjectArchive(project: Project) {
    if (!supabase) { setError('Supabase is not configured.'); return; }
    const nextStatus = project.project_status === 'archived' ? 'draft' : 'archived';
    setUpdatingProjectId(project.id);
    setError('');
    try {
      const { error: updateError } = await supabase.from('projects').update({ project_status: nextStatus }).eq('id', project.id);
      if (updateError) throw updateError;
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, project_status: nextStatus, updated_at: new Date().toISOString() } : item));
      setArchiveTarget(null);
      if (nextStatus === 'archived' && statusFilter !== 'archived') setStatusFilter('all');
    } catch (updateError: any) {
      setError(updateError?.message ?? 'Project status could not be updated.');
    } finally {
      setUpdatingProjectId(null);
    }
  }

  return (
    <>
      <div className="projects-dashboard">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-text">
            <small>Interior Design OS</small>
            <h1>Projects &amp; Estates</h1>
            <p>
              {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''} — ${orgName ?? 'your organisation'}`}
            </p>
          </div>
          <div className="page-header-actions">
            <button
              onClick={() => handleLoadDemoProject('5bhk')}
              disabled={loadingDemo !== null}
              className="projects-villa-btn"
              title="Instant 1-click launcher with pre-configured 5BHK Royal Villa Residence"
            >
              <Crown size={14} /> {loadingDemo === '5bhk' ? 'Launching 5BHK…' : '👑 5BHK Royal Villa'}
            </button>
            <button
              onClick={() => handleLoadDemoProject('3bhk')}
              disabled={loadingDemo !== null}
              className="projects-sample-btn"
              title="Launch sample 3BHK apartment demo"
            >
              <Sparkles size={14} /> {loadingDemo === '3bhk' ? 'Launching…' : '3BHK Sample'}
            </button>
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

        {attachingRoomDraft && (
          <div className="projects-room-draft-note" role="status">
            <strong>Measured Room Builder draft ready.</strong> Choose a project to open Spaces. The draft remains editable and will never overwrite an approved plan automatically.
          </div>
        )}

        {/* Filter bar with View Switcher */}
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

          {/* View Mode Toggle: Grid vs Schedule Table */}
          <div className="projects-view-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Luxury Visual Grid View"
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Architectural Schedule Table View"
            >
              <Table size={14} /> Schedule
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid var(--error-line)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)', fontSize: 13 }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Main Projects Display (Grid or Schedule Table) */}
        {loading ? (
          <div className="project-grid">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="projects-empty">
            <div className="projects-empty-icon">
              <FolderKanban size={36} />
            </div>
            <h2>{search || statusFilter !== 'all' ? 'No matching projects' : 'No projects yet'}</h2>
            <p>
              {search || statusFilter !== 'all'
                ? 'Try a different search or filter.'
                : 'Create your first project or launch our calibrated 5BHK Royal Villa residence.'}
            </p>
            {!search && statusFilter === 'all' && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                <button
                  onClick={() => setShowNew(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--brown-mid)', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Plus size={15} /> Create Custom Project
                </button>
                <button
                  onClick={() => handleLoadDemoProject('5bhk')}
                  disabled={loadingDemo !== null}
                  className="projects-villa-btn"
                  style={{ padding: '10px 20px', fontSize: 13.5 }}
                >
                  <Crown size={15} /> {loadingDemo === '5bhk' ? 'Preparing 5BHK Villa…' : '👑 Launch 5BHK Royal Villa'}
                </button>
                <button
                  onClick={() => handleLoadDemoProject('3bhk')}
                  disabled={loadingDemo !== null}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#fafaf9', border: '1px solid var(--line)', color: '#444', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Sparkles size={14} /> Sample 3BHK Flat
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="project-grid">
            {filtered.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} onClick={() => openProject(p)} onArchive={() => setArchiveTarget(p)} />
            ))}
          </div>
        ) : (
          <ProjectScheduleTable projects={filtered} onOpen={openProject} onArchive={setArchiveTarget} />
        )}
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

      {archiveTarget && <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingProjectId) setArchiveTarget(null); }}>
        <section className="modal-card project-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="project-archive-title">
          <div className="modal-header"><div><small>{archiveTarget.project_status === 'archived' ? 'Restore project' : 'Move project to trash'}</small><h2 id="project-archive-title">{archiveTarget.project_status === 'archived' ? 'Restore this project?' : 'Archive this project?'}</h2></div><button className="modal-close" onClick={() => setArchiveTarget(null)} disabled={!!updatingProjectId}><X size={18} /></button></div>
          <p className="project-archive-copy">{archiveTarget.project_status === 'archived' ? `${archiveTarget.name} will return to your active portfolio as a draft. Its history, files, scene versions and approvals remain intact.` : `${archiveTarget.name} will leave your active dashboard but remain recoverable from the Archived filter. No project files, plans, scene versions, renders, or production records will be deleted.`}</p>
          <div className="project-archive-actions"><button type="button" className="btn-secondary" onClick={() => setArchiveTarget(null)} disabled={!!updatingProjectId}>Cancel</button><button type="button" className={archiveTarget.project_status === 'archived' ? 'btn-primary' : 'btn-danger'} onClick={() => void updateProjectArchive(archiveTarget)} disabled={!!updatingProjectId}>{updatingProjectId ? 'Saving…' : archiveTarget.project_status === 'archived' ? 'Restore project' : 'Move to trash'}</button></div>
        </section>
      </div>}
    </>
  );
}

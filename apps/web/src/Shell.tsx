import {
  LayoutDashboard, FolderKanban, Library, BookOpen,
  Palette, Settings, Users, Ruler, ChevronRight, Box, Home, Wand2, CalendarDays, Receipt, Compass,
  PanelLeftClose, PanelLeftOpen, Menu, Plus, LogOut,
  CheckCircle2, Circle, Lock, Clock, AlertTriangle, Loader2
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './shell.css';

// ─── Types ────────────────────────────────────────────────────────
export type WorkflowStageStatus = 'not_started' | 'in_progress' | 'done' | 'locked' | 'needs_review';

export type WorkflowStageConfig = {
  id: string;
  label: string;
  path: string;
  status: WorkflowStageStatus;
  lockReason?: string;
  icon?: any;
};

type Props = {
  children: ReactNode;
  sessionEmail?: string | null;
  orgName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  workflowStages?: WorkflowStageConfig[];
  onNewProject?: () => void;
};

// ─── Primary navigation items ─────────────────────────────────────
const PRIMARY_NAV = [
  { id: 'dashboard', label: 'Dashboard',      path: '/',            icon: LayoutDashboard },
  { id: 'projects',  label: 'Projects',       path: '/projects',    icon: FolderKanban },
  { id: 'library',   label: 'Design Library', path: '/library',     icon: Library },
  { id: 'rules',     label: 'Company Rules',  path: '/rules',       icon: Ruler },
  { id: 'team',      label: 'Team',           path: '/team',        icon: Users },
  { id: 'settings',  label: 'Settings',       path: '/settings',    icon: Settings },
];

const TOOL_NAV = [
  { label: 'Design tools', items: [
    { id: 'room-builder', label: 'Room Builder', path: '/tools/room-builder', icon: Home },
    { id: 'module-planner', label: 'Module Planner', path: '/tools/modules', icon: Box },
    { id: 'render-studio', label: 'Render Studio', path: '/tools/render', icon: Wand2 },
  ] },
  { label: 'Production tools', items: [
    { id: 'cnc-studio', label: 'CNC Patterns', path: '/tools/cnc', icon: Compass },
    { id: 'measurements', label: 'Measurements', path: '/tools/measurements', icon: Ruler },
  ] },
  { label: 'Studio operations', items: [
    { id: 'calendar', label: 'Calendar', path: '/tools/calendar', icon: CalendarDays },
    { id: 'invoices', label: 'Invoices', path: '/tools/invoices', icon: Receipt },
  ] },
];

// ─── Default workflow stages ──────────────────────────────────────
export const DEFAULT_WORKFLOW_STAGES: WorkflowStageConfig[] = [
  { id: 'brief',        label: 'Brief',         path: 'brief',        icon: BookOpen, status: 'not_started' },
  { id: 'plan',         label: 'Floor Plan',    path: 'plan',         icon: Compass, status: 'locked', lockReason: 'Complete brief first' },
  { id: 'spaces',       label: 'Room Design',   path: 'spaces',       icon: Home, status: 'locked', lockReason: 'Approve floor plan first' },
  { id: '3d',           label: 'Visualize',     path: '3d',           icon: Wand2, status: 'locked', lockReason: 'Approve a room design first' },
  { id: 'drawings',     label: 'Drawings',      path: 'drawings',     icon: Ruler, status: 'locked', lockReason: 'Approve renders first' },
  { id: 'estimate',     label: 'Estimate',      path: 'estimate',     icon: Receipt, status: 'locked', lockReason: 'Approve drawings first' },
  { id: 'presentation', label: 'Presentation',  path: 'presentation', icon: Palette, status: 'locked', lockReason: 'Complete estimate first' },
];

// ─── Stage status icon ─────────────────────────────────────────────
function StageIcon({ status }: { status: WorkflowStageStatus }) {
  if (status === 'done')         return <CheckCircle2 size={13} style={{ color: '#34d399' }} />;
  if (status === 'in_progress')  return <Loader2 size={13} style={{ color: 'var(--gold-light)', animation: 'spin .9s linear infinite' }} />;
  if (status === 'needs_review') return <AlertTriangle size={13} style={{ color: '#f59e0b' }} />;
  if (status === 'locked')       return <Lock size={13} style={{ color: 'rgba(255,255,255,.15)' }} />;
  return <Circle size={13} style={{ color: 'rgba(255,255,255,.2)' }} />;
}

function stageStatusLabel(status: WorkflowStageStatus) {
  return status.replaceAll('_', ' ');
}

// ─── Shell Component ──────────────────────────────────────────────
export function Shell({
  children,
  sessionEmail,
  orgName,
  projectId,
  projectName,
  workflowStages = DEFAULT_WORKFLOW_STAGES,
  onNewProject,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('ultida-sidebar-collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  async function signOut() {
    await supabase?.auth.signOut();
    navigate('/');
  }

  const inProject = Boolean(projectId);

  useEffect(() => {
    window.localStorage.setItem('ultida-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <div className={`ultida-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* ─── Primary Sidebar ─── */}
      <aside className={`primary-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-mark">U</div>
          <div className="brand-text">
            <strong>ULTIDA</strong>
            <span>Interior Design OS</span>
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Primary nav */}
        <div className="primary-nav">
          <span className="nav-label">Navigation</span>
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`nav-item${isActive ? ' active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="nav-icon"><Icon size={16} /></span>
                <span>{item.label}</span>
                {item.id === 'projects' && <span className="nav-badge">•</span>}
              </Link>
            );
          })}
        </div>

        {!inProject && <div className="sidebar-tool-groups">
          {TOOL_NAV.map(group => <div className="sidebar-tool-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(item => { const Icon = item.icon; const active = location.pathname === item.path; return <Link key={item.id} to={item.path} className={`nav-item compact${active ? ' active' : ''}`} onClick={() => setMobileOpen(false)}><span className="nav-icon"><Icon size={15} /></span><span>{item.label}</span></Link>; })}</div>)}
        </div>}

        {/* Project workflow nav */}
        {inProject && (
          <div className="workflow-nav">
            <div className="workflow-nav-header">
              <span className="workflow-nav-title">
                {projectName ? projectName.slice(0, 18) : 'Current Project'}
              </span>
              <span className="workflow-count" aria-label={`${workflowStages.filter((stage) => stage.status === 'done').length} of ${workflowStages.length} stages complete`}>
                {workflowStages.filter((stage) => stage.status === 'done').length}/{workflowStages.length}
              </span>
            </div>
            {workflowStages.map((stage, i) => {
              const isActive = location.pathname.includes(`/${stage.path}`);
              const isLocked = stage.status === 'locked';
              const StageItemIcon = stage.icon ?? Home;
              return (
                <button
                  key={stage.id}
                  className={`workflow-stage${isActive ? ' active' : ''} ${stage.status === 'done' ? 'done' : ''} ${isLocked ? 'locked' : ''} ${stage.status === 'needs_review' ? 'needs_review' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`${stage.label}: ${isLocked ? stage.lockReason ?? 'locked' : stageStatusLabel(stage.status)}`}
                  disabled={isLocked}
                  onClick={() => {
                    if (!isLocked) {
                      navigate(`/projects/${projectId}/${stage.path}`);
                      setMobileOpen(false);
                    }
                  }}
                  title={isLocked ? stage.lockReason : stage.label}
                >
                  <span className="stage-nav-icon"><StageItemIcon size={14} /></span>
                  <span className="stage-label-text">{stage.label}</span>
                  <span className="stage-num"><StageIcon status={stage.status} /></span>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          {sessionEmail ? (
            <>
              <div className="user-avatar">{sessionEmail[0].toUpperCase()}</div>
              <div className="user-info">
                <span className="user-email">{sessionEmail}</span>
                <span className="user-org">{orgName ?? 'No organization'}</span>
              </div>
              <button
                style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,.3)', display: 'flex', padding: '4px' }}
                onClick={signOut}
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <div className="user-info">
              <span className="user-email">Not signed in</span>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="shell-main">
        {/* Command bar */}
        <div className="command-bar">
          <button
            className="mobile-nav-trigger"
            onClick={() => setMobileOpen((m) => !m)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="command-bar-breadcrumb">
            <span>Projects</span>
            {projectName && (
              <>
                <ChevronRight size={14} className="command-bar-sep" />
                <strong>{projectName}</strong>
              </>
            )}
            {location.pathname.split('/').filter(Boolean).length > 2 && (
              <>
                <ChevronRight size={14} className="command-bar-sep" />
                <span style={{ textTransform: 'capitalize' }}>
                  {location.pathname.split('/').at(-1)?.replace('-', ' ')}
                </span>
              </>
            )}
          </div>
          <div className="command-bar-actions">
            {!inProject && onNewProject && (
              <button
                onClick={onNewProject}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--brown-mid)', color: '#fff', border: '0', borderRadius: '7px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                <Plus size={15} /> New Project
              </button>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="shell-content">
          {children}
        </div>
      </main>
    </div>
  );
}

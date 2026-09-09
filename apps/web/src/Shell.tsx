import {
  LayoutDashboard, FolderKanban, Library, BookOpen,
  Palette, Settings, Users, Ruler, ChevronRight, Box, Home, Wand2, CalendarDays, Receipt, Compass,
  PanelLeftClose, PanelLeftOpen, Menu, Plus, LogOut, Sparkles, Layers,
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
  { id: 'team',      label: 'Team',           path: '/team',        icon: Users },
  { id: 'settings',  label: 'Settings & Rules', path: '/settings',   icon: Settings },
];

const TOOL_NAV = [
  { label: 'AI & Design Tools', items: [
    { id: 'aura-ai', label: 'AURA Design AI', path: '/tools/aura', icon: Sparkles },
    { id: 'skp-generator', label: 'SketchUp Studio', path: '/tools/skp', icon: Layers },
    { id: 'room-builder', label: 'Room Builder', path: '/tools/room-builder', icon: Home },
    { id: 'module-planner', label: 'Module Planner', path: '/tools/modules', icon: Box },
    { id: 'render-studio', label: 'Render Studio', path: '/tools/render', icon: Wand2 },
  ] },
  { label: 'Production & CNC', items: [
    { id: 'cnc-studio', label: 'CNC Patterns', path: '/tools/cnc', icon: Compass },
    { id: 'measurements', label: 'Measurements', path: '/tools/measurements', icon: Ruler },
  ] },
  { label: 'Studio Operations', items: [
    { id: 'calendar', label: 'Calendar', path: '/tools/calendar', icon: CalendarDays },
    { id: 'invoices', label: 'Invoices', path: '/tools/invoices', icon: Receipt },
  ] },
];

// ─── Default workflow stages ──────────────────────────────────────
export const DEFAULT_WORKFLOW_STAGES: WorkflowStageConfig[] = [
  { id: 'brief',        label: 'Project Brief', path: 'brief',        icon: BookOpen, status: 'not_started' },
  { id: 'plan',         label: 'Measured Plan', path: 'plan',         icon: Compass, status: 'locked', lockReason: 'Complete project brief first' },
  { id: 'spaces',       label: 'Rooms & Modules', path: 'spaces',     icon: Home, status: 'locked', lockReason: 'Approve measured plan first' },
  { id: '3d',           label: 'Scene Studio',  path: '3d',           icon: Wand2, status: 'locked', lockReason: 'Save a room design first' },
  { id: 'drawings',     label: 'Production Docs', path: 'drawings',   icon: Ruler, status: 'locked', lockReason: 'Compile a scene first' },
  { id: 'estimate',     label: 'Costing',       path: 'estimate',     icon: Receipt, status: 'locked', lockReason: 'Approve production documents first' },
  { id: 'presentation', label: 'Presentation',  path: 'presentation', icon: Palette, status: 'locked', lockReason: 'Complete costing first' },
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
  const doneStagesCount = workflowStages.filter((stage) => stage.status === 'done').length;
  const totalStagesCount = workflowStages.length;
  const workflowProgressPct = totalStagesCount > 0 ? Math.round((doneStagesCount / totalStagesCount) * 100) : 0;

  useEffect(() => {
    window.localStorage.setItem('ultida-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <div className={`ultida-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Mobile Drawer Backdrop Overlay */}
      <div
        className={`sidebar-backdrop${mobileOpen ? ' active' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ─── Primary Sidebar ─── */}
      <aside className={`primary-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-mark" title="ULTIDA Studio OS">U</div>
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
                title={collapsed ? item.label : undefined}
                data-tooltip={item.label}
              >
                <span className="nav-icon"><Icon size={16} /></span>
                <span className="nav-label-text">{item.label}</span>
                {item.id === 'projects' && <span className="nav-badge">•</span>}
              </Link>
            );
          })}
        </div>

        {!inProject && (
          <div className="sidebar-tool-groups">
            {TOOL_NAV.map(group => (
              <div className="sidebar-tool-group" key={group.label}>
                <span className="nav-label">{group.label}</span>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`nav-item compact${active ? ' active' : ''}`}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      data-tooltip={item.label}
                    >
                      <span className="nav-icon"><Icon size={15} /></span>
                      <span className="nav-label-text">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Project workflow nav */}
        {inProject && (
          <div className="workflow-nav">
            <div className="workflow-nav-header">
              <span className="workflow-nav-title">
                {projectName || 'Current Project'}
              </span>
              <span className="workflow-count" aria-label={`${doneStagesCount} of ${totalStagesCount} stages complete`}>
                {doneStagesCount}/{totalStagesCount}
              </span>
            </div>

            {/* Workflow Progress Bar */}
            <div className="workflow-progress-track" title={`${workflowProgressPct}% complete`}>
              <div className="workflow-progress-bar" style={{ width: `${workflowProgressPct}%` }} />
            </div>

            {workflowStages.map((stage) => {
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
                  title={collapsed ? stage.label : (isLocked ? stage.lockReason : stage.label)}
                  data-tooltip={stage.label}
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
              <div className="user-avatar" title={sessionEmail}>{sessionEmail[0].toUpperCase()}</div>
              <div className="user-info">
                <span className="user-email">{sessionEmail}</span>
                <span className="user-org">{orgName ?? 'No organization'}</span>
              </div>
              <button
                className="user-signout-btn"
                onClick={signOut}
                title="Sign out of ULTIDA"
                aria-label="Sign out"
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <div className="user-info">
              <span className="user-email">Guest Session</span>
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
            <Link to="/projects" className="breadcrumb-link">Projects</Link>
            {projectName && (
              <>
                <ChevronRight size={14} className="command-bar-sep" />
                {projectId ? (
                  <Link to={`/projects/${projectId}/brief`} className="breadcrumb-link active">
                    <strong>{projectName}</strong>
                  </Link>
                ) : (
                  <strong>{projectName}</strong>
                )}
              </>
            )}
            {location.pathname.split('/').filter(Boolean).length > 2 && (
              <>
                <ChevronRight size={14} className="command-bar-sep" />
                <span className="breadcrumb-active-stage">
                  {location.pathname.split('/').at(-1)?.replace('-', ' ')}
                </span>
              </>
            )}
          </div>

          <div className="command-bar-actions">
            {/* Studio status pill */}
            <div className="command-bar-status" title="Studio Engine Connected">
              <span className="status-pulse-dot" />
              <span className="status-pulse-label">Studio Active</span>
            </div>

            {/* Quick AI tool launcher */}
            <Link to="/tools/aura" className="command-bar-ai-btn" title="Launch AURA Design Assistant">
              <Sparkles size={14} />
              <span className="ai-btn-text">AURA AI</span>
            </Link>

            {!inProject && onNewProject && (
              <button
                onClick={onNewProject}
                className="command-bar-primary-btn"
              >
                <Plus size={15} /> <span>New Project</span>
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

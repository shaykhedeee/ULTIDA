/**
 * App.tsx — Ultida root router and auth orchestrator.
 *
 * Architecture:
 *   <App> manages authentication state only.
 *   Authenticated users see <Shell> + <Routes>.
 *   Unauthenticated users see the sign-in screen.
 *
 * Existing feature components (Brief, Plan, Design, etc.) are preserved
 * and reached through routes.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { X, Plus, ChevronRight } from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { Shell, DEFAULT_WORKFLOW_STAGES, type WorkflowStageConfig } from './Shell';
const ProjectDashboard = lazy(() => import('./features/projects/ProjectDashboard').then((module) => ({ default: module.ProjectDashboard })));
const StudioDashboard = lazy(() => import('./features/dashboard/StudioDashboard').then((module) => ({ default: module.StudioDashboard })));
const CncPatternStudio = lazy(() => import('./features/tools/CncPatternStudio').then((module) => ({ default: module.CncPatternStudio })));
const ModularUnitPlanner = lazy(() => import('./features/tools/ModularUnitPlanner').then((module) => ({ default: module.ModularUnitPlanner })));
const StudioOperations = lazy(() => import('./features/tools/StudioOperations').then((module) => ({ default: module.StudioOperations })));
const AuraChat = lazy(() => import('./features/tools/AuraChat').then((module) => ({ default: module.AuraChat })));
const RenderLauncher = lazy(() => import('./features/tools/RenderLauncher').then((module) => ({ default: module.RenderLauncher })));
const MeasurementConverter = lazy(() => import('./features/tools/MeasurementConverter').then((module) => ({ default: module.MeasurementConverter })));
const RoomBuilder = lazy(() => import('./features/tools/RoomBuilder').then((module) => ({ default: module.RoomBuilder })));

// Existing feature components — preserved
import { type ClientBrief, emptyBrief } from './features/project-types';
import { type LayoutConfig } from './components/layout/LayoutConfigWorkspace';
import type { LayoutCandidate } from '@ultida/layout-core';
const BriefWorkspace = lazy(() => import('./components/brief/BriefWorkspace').then((module) => ({ default: module.BriefWorkspace })));
const PlanReviewWorkspace = lazy(() => import('./components/plan/PlanReviewWorkspace').then((module) => ({ default: module.PlanReviewWorkspace })));
const LayoutConfigWorkspace = lazy(() => import('./components/layout/LayoutConfigWorkspace').then((module) => ({ default: module.LayoutConfigWorkspace })));
const DesignFlowWorkspace = lazy(() => import('./components/design/DesignFlowWorkspace').then((module) => ({ default: module.DesignFlowWorkspace })));
const CommercialWorkspace = lazy(() => import('./components/commercial/CommercialWorkspace').then((module) => ({ default: module.CommercialWorkspace })));
const DeliveryWorkspace = lazy(() => import('./components/delivery/DeliveryWorkspace').then((module) => ({ default: module.DeliveryWorkspace })));
const ReferenceLibraryWorkspace = lazy(() => import('./components/library/ReferenceLibraryWorkspace').then((module) => ({ default: module.ReferenceLibraryWorkspace })));
const SpacesWorkspace = lazy(() => import('./features/spaces/SpacesWorkspace').then((module) => ({ default: module.SpacesWorkspace })));
const SceneStudio = lazy(() => import('./features/scene/SceneStudio').then((module) => ({ default: module.SceneStudio })));
const ProductionWorkspace = lazy(() => import('./features/production/ProductionWorkspace').then((module) => ({ default: module.ProductionWorkspace })));
const TeamWorkspace = lazy(() => import('./features/studio/StudioAdminScreens').then((module) => ({ default: module.TeamWorkspace })));
const RulesWorkspace = lazy(() => import('./features/studio/StudioAdminScreens').then((module) => ({ default: module.RulesWorkspace })));
const SettingsWorkspace = lazy(() => import('./features/studio/StudioAdminScreens').then((module) => ({ default: module.SettingsWorkspace })));

import './intake.css';

// ─── Authenticated project mode ───────────────────────────────────
// Every persisted project action requires a real Supabase session.
const localDemoMode = false;

// ─── Types ────────────────────────────────────────────────────────
type ProviderStatus = { id: string; configured: boolean; operations: string[] };
type LayoutRoomContext = {
  id: string;
  name: string;
  roomType: import('./components/layout/LayoutConfigWorkspace').RoomCategory;
  ceilingHeightMm?: number;
  requirements: Record<string, unknown>;
  dimensions: { lengthMm: number; widthMm: number; heightMm: number } | null;
};

function toLayoutRoomCategory(roomType: unknown): import('./components/layout/LayoutConfigWorkspace').RoomCategory {
  const normalized = String(roomType ?? '').toLowerCase();
  if (normalized === 'kitchen') return 'kitchen';
  if (normalized === 'living') return 'living';
  if (normalized === 'tv_unit' || normalized === 'tv unit' || normalized === 'entertainment') return 'tv_unit';
  if (normalized === 'wardrobe' || normalized === 'storage') return 'wardrobe';
  if (normalized === 'bedroom' || normalized === 'master_bedroom' || normalized === 'kids_bedroom') return 'bedroom';
  return 'other';
}

function inferLayoutCategory(roomType: unknown, requirements: Record<string, unknown>): LayoutRoomContext['roomType'] {
  const direct = toLayoutRoomCategory(roomType);
  if (direct !== 'other') return direct;
  const furniture = Array.isArray(requirements.requiredFurniture) ? requirements.requiredFurniture.map(String) : [];
  if (furniture.some((item) => item.includes('wardrobe'))) return 'wardrobe';
  if (furniture.some((item) => item.includes('tv_unit'))) return 'tv_unit';
  return direct;
}

function roomDimensionsFromPolygon(polygon: unknown, ceilingHeightMm?: number) {
  if (!Array.isArray(polygon)) return null;
  const points = polygon.map((point: any) => ({ x: Number(point?.xMm ?? point?.x), y: Number(point?.yMm ?? point?.y) })).filter((point: { x: number; y: number }) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < 3) return null;
  const lengthMm = Math.round(Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)));
  const widthMm = Math.round(Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)));
  if (lengthMm <= 0 || widthMm <= 0) return null;
  return { lengthMm, widthMm, heightMm: Math.round(ceilingHeightMm ?? 2700) };
}

// ─── Auth / Sign-in screen ────────────────────────────────────────
function SignInScreen({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error');
  const [busy, setBusy] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  const redirectUrl = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin.replace(/\/$/, '')
    : 'https://ultida.vercel.app';

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : search);

    const errorCode = params.get('error_code');
    const errorDesc = params.get('error_description');
    const messageParam = params.get('message');

    if (errorCode || errorDesc) {
      if (errorCode === 'otp_expired') {
        setMessage('That verification link was already used or has expired. Sign in first. If that fails, send a new confirmation email below.');
        setCanResendConfirmation(true);
      } else {
        setMessage(decodeURIComponent(errorDesc || errorCode || 'Authentication error occurred.'));
      }
      setMessageKind('error');
      window.history.replaceState(null, '', window.location.pathname);
    } else if (messageParam) {
      setMessage(decodeURIComponent(messageParam));
      setMessageKind('success');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setMessageKind('error');

    if (password.length < 8) {
      setMessage('Use a password with at least 8 characters.');
      setBusy(false);
      return;
    }

    if (!supabase || !supabaseConfigured) {
      setMessage('Authentication is not configured for this environment. Configure Supabase before creating or opening projects.');
      setBusy(false);
      return;
    }

    const result = mode === 'signup'
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl }
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setMessage(result.error.message);
    } else if (result.data.session?.user.email) {
      onSuccess(result.data.session.user.email);
    } else if (mode === 'signup') {
      setMessage('Account created. Confirm the verification email, then sign in.');
      setMessageKind('success');
    }
    setBusy(false);
  }

  async function resendConfirmation() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage('Enter the email address used to create the account, then resend the confirmation email.');
      setMessageKind('error');
      return;
    }
    if (!supabase || !supabaseConfigured) {
      setMessage('Supabase is not configured, so a confirmation email cannot be sent.');
      setMessageKind('error');
      return;
    }

    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: { emailRedirectTo: redirectUrl }
    });

    if (error) {
      setMessage(error.message);
      setMessageKind('error');
    } else {
      setMessage('A fresh confirmation email was sent. Open only its newest link once, in this browser.');
      setMessageKind('success');
      setCanResendConfirmation(false);
    }
    setBusy(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #111218 0%, #1a1208 100%)',
      display: 'grid', placeItems: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #c59c2d, #a2533c)',
            display: 'grid', placeItems: 'center',
            fontSize: 24, fontWeight: 900, color: '#fff', margin: '0 auto 16px'
          }}>U</div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: '.04em', margin: '0 0 6px' }}>ULTIDA</h1>
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, margin: 0 }}>AI-Assisted Modular Interior Design</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} style={{
          background: '#fff', borderRadius: 16, padding: 32,
          boxShadow: '0 24px 64px rgba(0,0,0,.4)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
            {mode === 'signin' ? 'Sign in to your studio' : 'Create a studio account'}
          </h2>
          {!supabaseConfigured && (
            <div style={{
              padding: '8px 12px', background: '#fef3c7', borderRadius: 7, fontSize: 12,
              marginBottom: 16, color: '#92400e', fontWeight: 600, border: '1px solid #fde68a'
            }}>
              Supabase is not configured. Project data cannot be saved until authentication is configured.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div className="form-field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                placeholder="you@studio.com" autoFocus style={{ padding: '10px 12px', border: '1px solid #e8e0d4', borderRadius: 7, fontSize: 14 }} />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters" style={{ padding: '10px 12px', border: '1px solid #e8e0d4', borderRadius: 7, fontSize: 14 }} />
            </div>
          </div>

          {message && (
            <div style={{ padding: '10px 12px', background: messageKind === 'error' ? '#fef2f2' : '#ecfdf5', border: `1px solid ${messageKind === 'error' ? '#fecaca' : '#a7f3d0'}`, borderRadius: 7, fontSize: 12, color: messageKind === 'error' ? '#dc2626' : '#047857', marginBottom: 14, fontWeight: 600 }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%', padding: 12, background: '#3d2a1a', color: '#fff',
              border: 0, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? .6 : 1, marginBottom: 12
            }}
          >
            {busy ? 'Signing in…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'signin' && canResendConfirmation && (
            <button
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={busy}
              style={{
                width: '100%', padding: 10, background: '#f5f2eb', border: '1px solid #d4c5b2',
                borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? .6 : 1, marginBottom: 12, color: '#3d2a1a'
              }}
            >
              Resend confirmation email
            </button>
          )}


          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            style={{ background: 'transparent', border: 0, fontSize: 12, color: '#8a7762', cursor: 'pointer', width: '100%', padding: '4px 0' }}
          >
            {mode === 'signin' ? 'Need a studio account? Create one' : 'Already have access? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Placeholder screens for new stages ──────────────────────────
function PlaceholderScreen({ title, description, icon }: { title: string; description: string; icon?: string }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '80px 32px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon ?? '🔧'}</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 15, color: '#8a7762', lineHeight: 1.6 }}>{description}</p>
      <div style={{ marginTop: 24, padding: '12px 18px', background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#92400e', fontWeight: 600, border: '1px solid #fde68a', display: 'inline-block' }}>
        Coming in Phase {title === 'Spaces' ? '3' : title === 'Layouts' ? '4' : title === 'Modules' ? '5' : '6'}
      </div>
    </div>
  );
}

// ─── Project Workspace ────────────────────────────────────────────
// Hosts all the per-project stage screens, wraps them in the Shell.
function ProjectWorkspace({ sessionEmail, orgName, setSessionEmail, localDemoMode }: { sessionEmail: string; orgName: string; setSessionEmail: (email: string | null) => void; localDemoMode: boolean }) {
  const { projectId, stage } = useParams<{ projectId: string; stage: string }>();
  const navigate = useNavigate();

  // Project state
  const [projectName, setProjectName] = useState('');
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);

  // Plan state
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState('No plan uploaded');
  const [planAnalysed, setPlanAnalysed] = useState(false);
  const [planProposals, setPlanProposals] = useState<any[]>([]);
  const [analysisGuides, setAnalysisGuides] = useState<Array<{ id: string; label: string; x: number; y: number; width: number; height: number }>>([]);
  const [planAnalysisIssues, setPlanAnalysisIssues] = useState<Array<{ code: string; severity: 'warning' | 'critical'; entityId?: string; message: string }>>([]);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisRetryAvailable, setAnalysisRetryAvailable] = useState(false);
  const [analysisRefreshNonce, setAnalysisRefreshNonce] = useState(0);
  const [planApproved, setPlanApproved] = useState(false);
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  const [approvedPlanVersionId, setApprovedPlanVersionId] = useState<string | null>(null);
  const [reviewSnapshot, setReviewSnapshot] = useState<unknown>(null);
  const [demoSnapshot, setDemoSnapshot] = useState<any>(null);

  // Scene state
  const [sceneVersionId, setSceneVersionId] = useState<string | null>(null);
  const [sceneVersionNumber, setSceneVersionNumber] = useState(0);
  const [sceneModules, setSceneModules] = useState<any[]>([]);
  const [sceneMaterials, setSceneMaterials] = useState<any[]>([]);
  const [sceneApproved, setSceneApproved] = useState(false);
  const [layoutApproved, setLayoutApproved] = useState(false);

  // Brief & layout
  const [brief, setBrief] = useState<ClientBrief>(emptyBrief);
  const [briefSaved, setBriefSaved] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);
  const [layoutRooms, setLayoutRooms] = useState<LayoutRoomContext[]>([]);
  const [selectedLayoutSpaceId, setSelectedLayoutSpaceId] = useState<string | null>(null);

  // Provider status
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

  // Server-validated access token. Unlike getSession() (which reads a possibly
  // stale localStorage token), this rejects expired/corrupt sessions and clears
  // client state so protected project writes never use a false identity.
  const getValidToken = async (): Promise<string | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        void supabase.auth.signOut().catch(() => {});
        setSessionEmail(null);
        return null;
      }
      return (await supabase.auth.getSession()).data.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  // Load project from Supabase
  useEffect(() => {
    if (!supabase || !projectId) return;
    supabase.from('projects')
      .select('name, client_name, organization_id, workflow_stage')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProjectName(data.name);
          setActiveOrganizationId(data.organization_id);
          setBrief((b) => ({ ...b, clientName: data.client_name, projectName: data.name }));
        }
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    if (localDemoMode) {
      try {
        const raw = localStorage.getItem(`ultida-brief-${projectId}`);
        if (raw) {
          const saved = JSON.parse(raw) as ClientBrief & { isComplete?: boolean };
          setBrief({ ...emptyBrief, ...saved });
          setBriefSaved(Boolean(saved.isComplete));
        }
        const planDraft = localStorage.getItem(`ultida-plan-draft-${projectId}`);
        if (planDraft) {
          const savedDraft = JSON.parse(planDraft) as { draft?: unknown; analysisId?: string | null };
          if (savedDraft.draft && typeof savedDraft.draft === 'object') {
            setDemoSnapshot(savedDraft.draft);
            const draft = savedDraft.draft as { elements?: unknown[]; issues?: unknown[] };
            if (Array.isArray(draft.elements) && draft.elements.length) {
              setPlanProposals(draft.elements);
              setPlanAnalysisIssues(Array.isArray(draft.issues)
                ? draft.issues.map((issue: any) => ({
                    code: String(issue.id ?? issue.code ?? 'LOCAL_REVIEW'),
                    severity: issue.severity === 'critical' ? 'critical' : 'warning',
                    message: String(issue.question ?? issue.message ?? 'Review this item.'),
                  }))
                : []);
              setPlanAnalysed(true);
            }
          }
          if (savedDraft.analysisId) setAnalysisJobId(savedDraft.analysisId);
        }
      } catch {
        localStorage.removeItem(`ultida-brief-${projectId}`);
        localStorage.removeItem(`ultida-plan-draft-${projectId}`);
      }
      return () => { cancelled = true; };
    }
    if (!supabase) return;
    void (async () => {
      const accessToken = await getValidToken();
      if (!accessToken) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/plan-draft`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => null);
      if (!cancelled && response.ok && payload?.draft) setDemoSnapshot(payload.draft);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const savePlanDraft = useCallback(async (draft: unknown) => {
    if (!projectId) return;
    setDemoSnapshot(draft);
    if (localDemoMode) {
      localStorage.setItem(`ultida-plan-draft-${projectId}`, JSON.stringify({
        draft,
        analysisId: analysisJobId,
        savedAt: new Date().toISOString(),
        persistence: 'local-review-only',
      }));
      return;
    }
    if (!supabase) return;
    const accessToken = await getValidToken();
    if (!accessToken) return;
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    // Persist the editable review draft produced by the real pipeline.
    await fetch(`${apiBase}/projects/${projectId}/plan-analysis/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ draft, analysisId: analysisJobId })
    }).catch(() => null);
  }, [projectId, analysisJobId, localDemoMode]);

  useEffect(() => {
    if (!supabase || !projectId) return;
    let cancelled = false;
    void (async () => {
      const accessToken = await getValidToken();
      if (!accessToken) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/brief`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => null);
      if (cancelled || !response.ok || !payload?.brief) return;
      setBrief({ ...emptyBrief, ...payload.brief });
      setBriefSaved(Boolean(payload.isComplete));
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Reload a previously saved plan-analysis draft so the designer can resume review.
  useEffect(() => {
    if (!supabase || !projectId) return;
    let cancelled = false;
    void (async () => {
      const accessToken = await getValidToken();
      if (!accessToken) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/plan-analysis/draft`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => null);
      if (cancelled || !response.ok || !payload?.draft) return;
      const d = payload.draft;
      if (Array.isArray(d.elements) && d.elements.length) {
        setPlanProposals(d.elements);
        setPlanAnalysisIssues(Array.isArray(d.issues) ? d.issues.map((i: any) => ({ code: i.id, severity: 'warning', message: i.question })) : []);
        setPlanAnalysed(true);
        if (d.analysisId ?? d.analysis_uuid) setAnalysisJobId(d.analysisId ?? d.analysis_uuid);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Rehydrate only production-valid records. Older demo records without an
  // immutable source asset must not silently unlock scene creation or rendering.
  useEffect(() => {
    if (!supabase || !projectId) return;
    let cancelled = false;
    void (async () => {
      const [planResult, sceneResult] = await Promise.all([
        supabase.from('floor_plan_versions').select('id,source_asset_id,interpretation,canonical_model,status,review_status,created_at').eq('project_id', projectId).eq('status', 'approved').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('scene_versions').select('id,version_number,status,scene,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ]);
      if (cancelled) return;
      const plan = planResult.data;
      if (plan?.source_asset_id) {
        setApprovedPlanVersionId(plan.id);
        setSourceAssetId(plan.source_asset_id);
        setReviewSnapshot(plan.interpretation ?? plan.canonical_model ?? null);
        setPlanApproved(true);
      } else if (plan) {
        setPlanApproved(false);
        setPlanStatus('This older plan approval has no immutable source file. Upload and analyse the plan again before creating a scene.');
      }
      const sceneRow = sceneResult.data;
      if (sceneRow?.scene && ['approved', 'locked'].includes(String(sceneRow.status))) {
        const storedScene = sceneRow.scene as { modules?: Array<any>; materials?: Array<any> };
        setSceneVersionId(sceneRow.id);
        setSceneVersionNumber(Number(sceneRow.version_number ?? 1));
        setSceneModules((storedScene.modules ?? []).map((module) => ({ ...module, label: module.label ?? module.family })));
        setSceneMaterials(storedScene.materials ?? []);
        setSceneApproved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Provider status
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/providers`)
      .then((r) => r.json())
      .then((p) => setProviderStatuses(Array.isArray(p.providers) ? p.providers : []))
      .catch(() => setProviderStatuses([]));
  }, []);

  // Server-backed project stage completion flags
  const [serverStages, setServerStages] = useState<Record<string, boolean> | null>(null);
  const fetchProjectStatus = async () => {
    if (!projectId) return;
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/projects/${projectId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.success && typeof payload?.stages === 'object') setServerStages(payload.stages as Record<string, boolean>);
      }
    } catch {
      // fallback to local booleans if API is unavailable
    }
  };
  useEffect(() => { void fetchProjectStatus(); }, [projectId]);

  // Realtime shortens job and workflow updates while the polling loop below remains
  // the durable recovery path for reconnects and suspended browser tabs.
  useEffect(() => {
    if (!supabase || !projectId) return;
    const realtimeClient = supabase;

    const channel = realtimeClient
      .channel(`ultida-project-${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'jobs', filter: `project_id=eq.${projectId}`
      }, () => setAnalysisRefreshNonce((value) => value + 1))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'workflow_stage_status', filter: `project_id=eq.${projectId}`
      }, () => void fetchProjectStatus())
      .subscribe();

    return () => { void realtimeClient.removeChannel(channel); };
  }, [projectId]);

  useEffect(() => {
    if (!analysisJobId || !projectId || planAnalysed) return;
    let stopped = false;
    const poll = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
        const token = supabase ? (await getValidToken() ?? '') : '';
        const response = await fetch(`${apiBase}/plan/analyze/${analysisJobId}?projectId=${encodeURIComponent(projectId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const payload = await response.json();
        if (stopped) return;
        if (payload.status === 'succeeded' && payload.analysis?.proposals) {
          setPlanProposals(payload.analysis.proposals);
          setPlanAnalysisIssues(payload.analysis.topologyIssues ?? []);
          setPlanAnalysed(true);
          setPlanStatus('Provider analysis complete. Review and calibrate every proposal.');
          if (stage === 'brief') navigate(`/projects/${projectId}/plan`);
        } else if (payload.status === 'failed') {
          setPlanStatus(payload.error?.message ?? 'Provider analysis failed. No geometry was generated.');
          setAnalysisJobId(null);
          } else {
            // `updatedAt` is a server-owned heartbeat. Use it so a live job is
            // never retried simply because the original claim is old.
            const activityAt = payload.updatedAt ?? (payload.status === 'running' ? payload.processingAt : payload.queuedAt);
            const stateAgeMs = activityAt ? Date.now() - new Date(activityAt).getTime() : 0;
            const deadlineMs = payload.deadlineAt ? new Date(payload.deadlineAt).getTime() : Number.NaN;
            const exhausted = Number.isFinite(Number(payload.attempts)) && Number.isFinite(Number(payload.maxAttempts)) && Number(payload.attempts) >= Number(payload.maxAttempts);
            const deadlineReached = Number.isFinite(deadlineMs) && Date.now() >= deadlineMs;
            if (deadlineReached || exhausted || (payload.status === 'queued' && stateAgeMs > 45_000) || (payload.status === 'running' && stateAgeMs > 150_000)) {
              // The queue processor exclusively owns retries. Re-dispatching
              // from a polling browser caused concurrent duplicate analysis jobs
              // and made a slow provider path look permanently stuck.
              setAnalysisRetryAvailable(true);
              setPlanStatus(deadlineReached
                ? 'Analysis exceeded its safe processing deadline. No geometry was marked complete; use Retry analysis to start a bounded attempt.'
                : 'The analysis worker has not reported progress. It will reach a safe terminal state; you can then use Retry analysis for this exact source file.');
              return;
            }
          const labels: Record<string, string> = { queued: 'queued', running: 'analysing', processing: 'analysing', review_required: 'ready for review' };
          const progressStage = typeof payload.progressStage === 'string'
            ? payload.progressStage
            : (typeof payload.analysis?.progress?.stage === 'string' ? payload.analysis.progress.stage : '');
          const progressMessage = typeof payload.progressMessage === 'string'
            ? payload.progressMessage
            : (typeof payload.analysis?.progress?.message === 'string' ? payload.analysis.progress.message : '');
          const progressLabels: Record<string, string> = {
            queued: 'Queued securely...',
            preprocessing: 'Preparing the source...',
            tracing: 'Tracing likely walls and rooms...',
            awaiting_guidance: 'Ready for your calibration and room guides.',
            review_required: 'Ready for review.',
            preparing: 'Preparing the source…',
            analysing: 'Reading rooms, walls and openings…',
            reconciling: 'Reconciling drawing evidence…',
            saving: 'Saving the review model…',
          };
          setPlanStatus(payload.recovery ?? (progressMessage || progressLabels[progressStage] || `Analysis ${labels[payload.status] ?? 'processing'}…`));
        }
      } catch {
        if (!stopped) setPlanStatus('Analysis status could not be refreshed. Retrying...');
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [analysisJobId, analysisRefreshNonce, planAnalysed, projectId, stage, navigate]);

  // Determine workflow stages statuses
  const serverStageMap: Record<string, boolean> = serverStages ?? {};
  const useServerStages = Object.keys(serverStageMap).length > 0;
  const stageStatuses: WorkflowStageConfig[] = DEFAULT_WORKFLOW_STAGES.map((s) => {
    const currentIdx = DEFAULT_WORKFLOW_STAGES.findIndex((x) => x.id === (stage ?? 'brief'));
    const thisIdx = DEFAULT_WORKFLOW_STAGES.findIndex((x) => x.id === s.id);
    const stageKey = s.id;

    let status: WorkflowStageConfig['status'] = 'not_started';
    if (useServerStages) {
      if (serverStageMap[stageKey]) status = 'done';
      else if (stageKey === (stage ?? 'brief')) status = 'in_progress';
      else if (s.status === 'locked' || thisIdx > currentIdx + 1) status = 'locked';
    } else {
      if (s.id === 'brief' && briefSaved) status = 'done';
      else if (s.id === 'plan' && planApproved) status = 'done';
      else if (stageKey === (stage ?? 'brief')) status = 'in_progress';
      else if (thisIdx > currentIdx + 1) status = 'locked';
    }

    let lockReason: string | undefined;
    if (s.id === 'plan' && !(useServerStages ? serverStageMap['brief'] : briefSaved)) { status = 'locked'; lockReason = 'Complete brief first'; }
    if (s.id === 'spaces' && !(useServerStages ? serverStageMap['plan'] : planApproved)) { status = 'locked'; lockReason = 'Approve floor plan first'; }
    if (s.id === 'layouts' && !(useServerStages ? serverStageMap['spaces'] : planApproved)) { status = 'locked'; lockReason = 'Configure and approve spaces first'; }
    if (s.id === 'modules' && !(useServerStages ? serverStageMap['layouts'] : layoutApproved)) { status = 'locked'; lockReason = 'Approve a layout first'; }
    if (['materials','3d','renders','drawings','estimate','presentation'].includes(s.id) && !(useServerStages ? (serverStageMap['3d'] || serverStageMap['layouts'] || serverStageMap['modules']) : sceneVersionId)) {
      status = 'locked'; lockReason = s.lockReason;
    }

    return { ...s, status, lockReason };
  });

  // Plan file selection
  function selectPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPlanFile(file);
    setPlanAnalysed(false);
    setAnalysisJobId(null);
    setPlanProposals([]);
    setAnalysisGuides([]);
    setPlanAnalysisIssues([]);
    setPlanStatus(`Attached ${file.name}. Run analysis to process.`);
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (file.type.startsWith('image/') || ['.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff','.avif','.heic','.heif','.svg'].includes(ext)) {
      setPlanPreview(URL.createObjectURL(file));
    } else {
      setPlanPreview(null);
    }
  }

  function floorPlanMimeType(file: File) {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const byExtension: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
      '.avif': 'image/avif', '.heic': 'image/heic', '.heif': 'image/heif', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    };
    return byExtension[extension] ?? file.type;
  }

  async function analysePlan(startAnalysis = true) {
    if (!planFile) return setPlanStatus('Choose a floor plan first.');
    if (!projectId) return setPlanStatus('Create or open a project before analysing a floor plan.');
    if (localDemoMode) {
      const localAssetId = `local-asset-${projectId}`;
      setSourceAssetId(localAssetId);
      setAnalysisJobId(`local-plan-${projectId}`);
      setPlanProposals([]);
      setPlanAnalysisIssues([{ code: 'LOCAL_REVIEW_ONLY', severity: 'warning', message: 'Local demo review is not AI analysis. Connect Supabase and a vision provider to produce authoritative wall geometry.' }]);
      setPlanAnalysed(true);
      setPlanStatus('Local review draft ready. AI wall analysis is unavailable in demo mode; no measurements were invented.');
      localStorage.setItem(`ultida-plan-${projectId}`, JSON.stringify({ fileName: planFile.name, status: 'local_review_only', assetId: localAssetId, updatedAt: new Date().toISOString() }));
      return;
    }
    if (!supabase) return setPlanStatus('Supabase is required for professional plan analysis. Sign in and try again.');
    setPlanStatus(startAnalysis ? 'Uploading and preparing review...' : 'Uploading plan for guided review...');
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    let uploadedAssetId: string | null = null;
    let accessToken: string | null = null;

    if (supabase && projectId) {
      try {
        // A cached session may contain an expired access token even while the
        // interface still looks signed in. Reuse the server-validated helper
        // so signed upload URLs and the durable analysis request never start
        // with a stale bearer token.
        accessToken = await getValidToken();
        if (!accessToken) return setPlanStatus('Your session has expired. Sign in again before uploading a floor plan.');
        const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };
        const mimeType = floorPlanMimeType(planFile);
        setPlanStatus('Preparing a secure upload...');
        const initiated = await fetch(`${apiBase}/projects/${projectId}/floor-plans/initiate`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ fileName: planFile.name, mimeType, fileSize: planFile.size })
        });
        const initiation = await initiated.json().catch(() => null);
        if (!initiated.ok || !initiation?.token || !initiation?.storagePath) return setPlanStatus(initiation?.message ?? `Secure floor-plan upload could not be initiated (HTTP ${initiated.status}).`);
        setPlanStatus('Uploading original floor plan...');
        const stored = await supabase.storage.from(initiation.bucket ?? 'project-assets').uploadToSignedUrl(initiation.storagePath, initiation.token, planFile, { contentType: initiation.mimeType ?? mimeType });
      if (stored.error) return setPlanStatus(`Upload failed: ${stored.error.message}`);
      setPlanStatus('Verifying upload and registering analysis...');
        // Signed uploads can take long enough for a cached JWT to expire.
        // Refresh immediately before server-side verification/job creation.
        accessToken = await getValidToken();
        if (!accessToken) return setPlanStatus('The file uploaded, but your session expired before analysis could be registered. Sign in again and retry analysis.');
        const completionHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };
        const completed = await fetch(`${apiBase}/projects/${projectId}/floor-plans/complete`, {
        method: 'POST', headers: completionHeaders,
        body: JSON.stringify({ assetId: initiation.assetId, storagePath: initiation.storagePath, fileName: planFile.name, mimeType: initiation.mimeType ?? mimeType, fileSize: planFile.size, analysisGuides, startAnalysis })
      });
      const completion = await completed.json().catch(() => null);
       // A 202 is an accepted durable-job response. Older/local API processes
       // can omit the echoed asset object, but the signed-upload initiation
       // already supplied its immutable asset id. Do not strand the designer
       // after a successful 202 just because that optional echo is absent.
       const registeredAssetId = completion?.asset?.id ?? (completed.status === 202 && completion?.jobId ? initiation.assetId : null);
       if (!completed.ok || !registeredAssetId) {
         const prefix = completion?.code ? `[${completion.code}] ` : `HTTP ${completed.status}: `;
         return setPlanStatus(`${prefix}${completion?.message ?? 'The uploaded floor plan could not be registered.'}`);
       }
       uploadedAssetId = registeredAssetId;
      setSourceAssetId(uploadedAssetId);
      if (!startAnalysis) {
        setPlanProposals([]);
        setPlanAnalysisIssues([{ code: 'GUIDED_REVIEW', severity: 'warning', message: 'Guided tracing is active. Manually traced geometry is provisional until verified on site.' }]);
        setPlanAnalysed(true);
        setPlanStatus(completion?.message ?? 'Plan stored for guided review. Calibrate one visible dimension, then trace or confirm the rooms and walls.');
        return;
      }
      if (!completion.jobId) return setPlanStatus('The plan was stored, but no durable analysis job was created.');
      setAnalysisJobId(completion.jobId);
      setAnalysisRetryAvailable(false);
      setPlanAnalysed(false);
       setPlanStatus(completion.status === 'failed'
         ? `Floor plan uploaded, but analysis failed: ${completion.error?.message ?? 'Open the retry action to run it again.'}`
         : completion.dispatch?.dispatched === false
         ? 'Plan analysis is queued. Cloudflare worker dispatch is not configured yet.'
         : 'Plan analysis is queued with the real vision provider.');
        return;
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Network request failed.';
        return setPlanStatus(`Secure floor-plan upload could not be initiated. ${detail}`);
      }
    }

    /* Legacy synchronous data-URL path intentionally disabled. Durable jobs
       are the only supported analysis path. */
    /* try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers.authorization = `Bearer ${accessToken}`;
      // Real pipeline: submit the actual raster (or PDF) to a configured
      // multimodal vision model, run deterministic CV/OCR, reconcile, and
      // return a review draft with full provenance. Never synthesizes geometry.
      const dataUrl = await readFileAsDataUrl(planFile);
      const response = await fetch(`${apiBase}/projects/${projectId}/plan-analysis`, {
        method: 'POST', headers,
        body: JSON.stringify({
          fileName: planFile.name,
          mimeType: planFile.type,
          dataUrl,
          assetId: uploadedAssetId ?? null,
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : `Plan analysis failed with HTTP ${response.status}.`;
        return setPlanStatus(detail);
      }
      // Map the provider+reconciled result into the reviewable proposal shape.
      const elements: any[] = Array.isArray(payload.elements) ? payload.elements : [];
      const issues: any[] = Array.isArray(payload.issues) ? payload.issues : [];
      setPlanProposals(elements);
      setPlanAnalysisIssues(issues.map((i) => ({ code: i.id, severity: 'warning', message: i.question })));
      if (payload.analysisId) setAnalysisJobId(payload.analysisId);
      setPlanAnalysed(true);
      const provenance = payload.provenance
        ? ` (provider=${payload.provenance.provider} model=${payload.provenance.model}, ${payload.provenance.latencyMs}ms)`
        : '';
      const persistNote = payload.persisted === false ? ' Draft not saved to DB (migration pending).' : '';
      setPlanStatus(`Provider analysis complete${provenance}. Review and calibrate every proposal.${persistNote}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Network request failed.';
      setPlanStatus(`Plan service could not be reached at ${apiBase}. ${detail}`);
    } */
  }

  async function retryPlanAnalysis() {
    if (!analysisJobId || !projectId || !supabase) return;
    const token = await getValidToken();
    if (!token) return setPlanStatus('Your session has expired. Sign in again before retrying analysis.');
    setAnalysisRetryAvailable(false);
    setPlanStatus('Re-dispatching the existing floor-plan analysis…');
    try {
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/plan/analyze/${analysisJobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        setAnalysisRetryAvailable(true);
        return setPlanStatus(payload?.message ?? 'Analysis could not be re-dispatched. Please try again.');
      }
      setPlanStatus('Analysis re-dispatched to the vision worker…');
    } catch {
      setAnalysisRetryAvailable(true);
      setPlanStatus('Analysis could not be re-dispatched because the service could not be reached.');
    }
  }

  async function approvePlan(snapshot: unknown) {
    if (!sourceAssetId) {
      setPlanStatus('Upload and analyse an immutable floor-plan source before approval.');
      return;
    }
    setReviewSnapshot(snapshot);
    setPlanStatus('Saving the reviewed plan model…');
    let serverVersionId = approvedPlanVersionId;
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accessToken = supabase ? (await getValidToken() ?? '') : '';
      if (accessToken) headers.authorization = `Bearer ${accessToken}`;
      const canonicalModel = snapshot;
      const response = await fetch(`${apiBase}/projects/${projectId}/plan/approve`, {
        method: 'POST', headers,
        body: JSON.stringify({ projectId, sourceAssetId, canonicalModel, approvedBy: null, floorPlanVersionId: approvedPlanVersionId ?? undefined })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message ?? 'Plan approval failed.');
      serverVersionId = payload.floorPlanVersionId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Plan approval failed.';
      setPlanStatus(message);
      throw new Error(message);
    }
    if (!serverVersionId) {
      const message = 'Plan approval requires an authenticated Supabase project.';
      setPlanStatus(message);
      throw new Error(message);
    }
    setApprovedPlanVersionId(serverVersionId);
    setPlanApproved(true);
    setPlanStatus('Plan approved. Proceed to Spaces.');
    navigate(`/projects/${projectId}/spaces`);
    void fetchProjectStatus();
  }

  async function downloadPlanDxf(snapshot: { elements: any[]; issues: any[]; scale: any; ceilingHeightMm: number | null; geometryMode: 'initial_design' | 'final_production' }) {
    if (!projectId || !snapshot.scale || !snapshot.elements?.length) {
      setPlanStatus('Calibrate one visible dimension and accept at least one wall or room before exporting DXF.');
      return;
    }
    if (localDemoMode || !supabase) {
      setPlanStatus('Sign in to download the plan DXF. Local review drafts are not downloadable production files.');
      return;
    }
    const token = await getValidToken();
    if (!token) {
      setPlanStatus('Your session has expired. Sign in again before downloading the plan DXF.');
      return;
    }
    setPlanStatus('Preparing calibrated plan DXF…');
    try {
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/drawings/plan.dxf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          planVersionId: approvedPlanVersionId ?? analysisJobId ?? sourceAssetId ?? 'plan-review',
          geometryMode: snapshot.geometryMode,
          mmPerPixel: snapshot.scale.mmPerPixel,
          ceilingHeightMm: snapshot.ceilingHeightMm,
          elements: snapshot.elements,
          warnings: snapshot.issues.map((issue: any) => issue.question ?? issue.message ?? issue.id).filter(Boolean),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `DXF export failed (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = snapshot.geometryMode === 'initial_design' ? 'ultida-plan-initial-design.dxf' : 'ultida-plan-final-production.dxf';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(href);
      setPlanStatus(snapshot.geometryMode === 'initial_design'
        ? 'Plan DXF downloaded as a provisional Initial Design review file. Verify geometry before production release.'
        : 'Plan DXF downloaded. Production exports remain linked to the approved scene.');
    } catch (error) {
      setPlanStatus(error instanceof Error ? error.message : 'Plan DXF export failed.');
    }
  }

  async function saveBrief(nextBrief: ClientBrief, isComplete = true) {
    if (localDemoMode && projectId) {
      localStorage.setItem(`ultida-brief-${projectId}`, JSON.stringify({
        ...nextBrief,
        isComplete,
        savedAt: new Date().toISOString(),
      }));
      setBrief(nextBrief);
      setBriefSaved(isComplete);
      if (isComplete) navigate(`/projects/${projectId}/plan`);
      return;
    }
    if (projectId && supabase) {
      const accessToken = await getValidToken();
      if (!accessToken) throw new Error('Your session expired. Sign in again before saving the brief.');
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/brief`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ brief: nextBrief, isComplete })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const fieldDetails = payload?.fieldErrors ? ` ${Object.values(payload.fieldErrors).join(' ')}` : '';
        const detail = payload?.code ? ` [${payload.code}]` : '';
        throw new Error(`${payload?.message ?? 'Brief could not be saved.'}${detail}${fieldDetails}`);
      }
    }
    setBrief(nextBrief);
    setBriefSaved(isComplete);
    if (isComplete) navigate(`/projects/${projectId}/plan`);
    void fetchProjectStatus();
  }

  function handleLayoutGenerate(config: LayoutConfig) {
    setLayoutConfig(config);
    localStorage.setItem('ultida-layout-config', JSON.stringify(config));
    navigate(`/projects/${projectId}/design`);
  }

  async function handleLayoutApprove(candidate: LayoutCandidate, config: LayoutConfig) {
    if (!projectId || !supabase) {
      setLayoutConfig(config);
      return;
    }
    const accessToken = await getValidToken();
    if (!accessToken) throw new Error('Sign in before approving a layout.');
    const spaceId = selectedLayoutSpaceId;
    if (!spaceId || !layoutRooms.some((room) => room.id === spaceId)) throw new Error('Select a configured room before approving a layout.');
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };
    const created = await fetch(`${apiBase}/projects/${projectId}/layouts`, {
      method: 'POST', headers,
      body: JSON.stringify({ spaceId, layoutShape: candidate.shape, label: candidate.candidateType, candidate, score: candidate.score })
    });
    const createdPayload = await created.json();
    if (!created.ok) throw new Error(createdPayload?.message ?? 'Layout could not be saved.');
    const approved = await fetch(`${apiBase}/projects/${projectId}/layouts/${createdPayload.layout.id}/approve`, { method: 'POST', headers, body: JSON.stringify({ config }) });
    const approvedPayload = await approved.json();
    if (!approved.ok) throw new Error(approvedPayload?.message ?? 'Layout could not be approved.');
    setLayoutConfig(config);
    setLayoutApproved(true);
    void fetchProjectStatus();
  }

  useEffect(() => {
    if (!projectId || !planApproved || !supabase) return;
    void (async () => {
      const token = await getValidToken();
      if (!token) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const [spacesResponse, planResponse] = await Promise.all([
        fetch(`${apiBase}/projects/${projectId}/spaces`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/projects/${projectId}/floor-plan/active`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const payload = await spacesResponse.json().catch(() => null);
      const activePlan = await planResponse.json().catch(() => null);
      const planRoomBySpaceId = new Map<string, any>((activePlan?.rooms ?? []).filter((room: any) => room?.spaceRecordId).map((room: any) => [String(room.spaceRecordId), room]));
      const rooms = Array.isArray(payload?.spaces) ? payload.spaces.map((space: any) => {
        const planRoom = planRoomBySpaceId.get(String(space.id));
        const ceilingHeightMm = Number(space.ceiling_height_mm ?? planRoom?.ceilingHeightMm ?? 0) || undefined;
        const polygon = planRoom?.polygon ?? space.geometry_json?.polygon ?? [];
        const requirements = (space.requirements_json && typeof space.requirements_json === 'object') ? space.requirements_json : {};
        return {
          id: String(space.id),
          name: String(space.name ?? planRoom?.name ?? space.room_type ?? space.id),
          roomType: inferLayoutCategory(space.room_type ?? planRoom?.roomType, requirements),
          ceilingHeightMm,
          requirements,
          dimensions: roomDimensionsFromPolygon(polygon, ceilingHeightMm),
        };
      }) : [];
      setLayoutRooms(rooms);
      setSelectedLayoutSpaceId((current) => current && rooms.some((room: any) => room.id === current) ? current : rooms[0]?.id ?? null);
      const layoutsResponse = await fetch(`${apiBase}/projects/${projectId}/layouts`, { headers: { Authorization: `Bearer ${token}` } });
      const layoutsPayload = await layoutsResponse.json().catch(() => null);
      setLayoutApproved(Boolean(layoutsResponse.ok && (layoutsPayload?.layouts ?? []).some((layout: any) => layout.status === 'approved')));
    })();
  // Spaces are edited on their own route. Refresh this lightweight room
  // context whenever the designer enters a downstream workspace so Layout
  // never operates on the pre-edit room list held by the application shell.
  }, [projectId, planApproved, stage]);

  async function handleLayoutCandidates(config: LayoutConfig, roomCategory: import('./components/layout/LayoutConfigWorkspace').RoomCategory, roomRequirements: Record<string, unknown>, spaceId: string) {
    if (!projectId) throw new Error('Open a project before generating layout candidates.');
    const accessToken = await getValidToken();
    if (!accessToken) throw new Error('Sign in before generating layout candidates.');
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    const requirements = {
      ...roomRequirements,
      selectedTemplate: config.template,
      preferredWallOrientation: config.wallOrientation,
      stylePreset: config.style,
      designDimensionsMm: { length: config.lengthMm, width: config.widthMm, height: config.heightMm },
    };
    const response = await fetch(`${apiBase}/projects/${projectId}/layout-candidates`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ spaceId, roomCategory, requirements, shape: config.shape, candidateTypes: ['maximum_storage', 'best_circulation', 'balanced'] }) });
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.candidates)) throw new Error(payload.message ?? 'The approved plan could not generate layout candidates.');
    return payload.candidates as LayoutCandidate[];
  }

  async function handleLoadLayoutDrafts(spaceId: string) {
    if (!projectId) return [];
    const accessToken = await getValidToken();
    if (!accessToken) return [];
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    const response = await fetch(`${apiBase}/projects/${projectId}/layouts`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload?.layouts)) return [];
    return payload.layouts.filter((layout: any) => layout.space_id === spaceId && layout.status === 'candidate').map((layout: any) => layout.candidate_json).filter(Boolean) as LayoutCandidate[];
  }

  async function saveScene(id: string, modules: typeof sceneModules, materials: any[] = []) {
    if (!projectId || !approvedPlanVersionId) {
      setPlanStatus('Approve a canonical floor plan before compiling a scene.');
      throw new Error('Approved plan required.');
    }
    const accessToken = await getValidToken();
    if (!accessToken) {
      setPlanStatus('Sign in before compiling a scene.');
      throw new Error('Authenticated session required.');
    }
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ moduleInstanceIds: modules.map((module) => module.id), designVersion: 'spaces.v1', changeReason: 'Compiled from persisted moodboard modules, library assignments, and active approved plan.v1' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.sceneVersion) {
        setPlanStatus(payload.message ?? 'Scene compilation failed.');
        throw new Error(payload.message ?? 'Scene compilation failed.');
      }
      setSceneVersionId(payload.sceneVersion.id);
      setSceneVersionNumber(payload.sceneVersion.version_number);
      setSceneModules(modules);
      setSceneMaterials(Array.isArray(payload.materials) ? payload.materials : materials);
      setSceneApproved(false);
      setPlanStatus('Measured scene compiled from the active plan.v1.');
      return payload.sceneVersion.id as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scene compiler is unavailable.';
      setPlanStatus(message);
      throw error;
    }
    return;

    /* Legacy local scene persistence retired; the server compiler is authoritative.
    const nextNumber = sceneVersionNumber + 1;
    let savedId = id;
    if (supabase && projectId && approvedPlanVersionId) {
      let organizationId = activeOrganizationId;
      if (!organizationId) {
        const project = await supabase.from('projects').select('organization_id').eq('id', projectId).single();
        if (project.error || !project.data?.organization_id) {
          setPlanStatus(project.error?.message ?? 'Scene could not resolve its organization context.');
          return;
        }
        organizationId = project.data.organization_id;
        setActiveOrganizationId(organizationId);
      }
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;
      const reviewed = (reviewSnapshot && typeof reviewSnapshot === 'object' ? reviewSnapshot : {}) as any;
      const mmPerPixel = Number(reviewed.scale?.mmPerPixel ?? reviewed.scale?.mmPerPixel) || 1;
      const roomType = (value: string) => {
        const label = value.toLowerCase();
        if (label.includes('kitchen')) return 'kitchen';
        if (label.includes('living') || label.includes('drawing')) return 'living';
        if (label.includes('bed')) return 'bedroom';
        if (label.includes('pooja')) return 'pooja';
        return label.replace(/[^a-z0-9]+/g, '-') || 'room';
      };
      const reviewedRooms = Array.isArray(reviewed.rooms) ? reviewed.rooms : [];
      const reviewedWalls = Array.isArray(reviewed.walls) ? reviewed.walls : [];
      const sceneRooms = reviewedRooms.map((item: any, index: number) => {
        const points = item.geometry?.polygon ?? [];
        const boundary = points.map((point: any) => ({ xMm: Math.round(Number(point.x ?? 0) * mmPerPixel), yMm: Math.round(Number(point.y ?? 0) * mmPerPixel) }));
        if (boundary.length >= 3 && (boundary[0].xMm !== boundary.at(-1)?.xMm || boundary[0].yMm !== boundary.at(-1)?.yMm)) boundary.push({ ...boundary[0] });
        return { id: item.id || `room-${index + 1}`, spaceId: `space-${index + 1}`, name: item.label || `Room ${index + 1}`, type: roomType(item.label || `room-${index + 1}`), boundary, confidence: Number(item.confidence ?? 0.7) };
      }).filter((room: any) => room.boundary.length >= 4);
      const sceneWalls = reviewedWalls.map((item: any, index: number) => ({
        id: item.id || `wall-${index + 1}`,
        floorId: 'floor-1',
        start: { xMm: Math.round(Number(item.geometry?.x1 ?? 0) * mmPerPixel), yMm: Math.round(Number(item.geometry?.y1 ?? 0) * mmPerPixel) },
        end: { xMm: Math.round(Number(item.geometry?.x2 ?? 0) * mmPerPixel), yMm: Math.round(Number(item.geometry?.y2 ?? 0) * mmPerPixel) },
        thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: sceneRooms.map((room: any) => room.spaceId), confidence: Number(item.confidence ?? 0.7)
      })).filter((wall: any) => wall.start.xMm !== wall.end.xMm || wall.start.yMm !== wall.end.yMm);
      const scene = { schema: 'scene.v1', units: 'mm', projectId, floorPlanVersionId: approvedPlanVersionId, rooms: sceneRooms, walls: sceneWalls, openings: [], fixedFixtures: [], modules: modules.map((m, index) => {
        const room = sceneRooms.find((candidate: any) => candidate.id === m.roomId || candidate.type === m.roomId);
        const origin = room?.boundary?.[0] ?? { xMm: 0, yMm: 0 };
        return { id: m.id, roomId: m.roomId, family: m.family, widthMm: m.widthMm, depthMm: m.depthMm, heightMm: m.heightMm, position: { xMm: origin.xMm + 300 + (index % 3) * 180, yMm: origin.yMm + 300 + Math.floor(index / 3) * 180 }, rotationDeg: 0, anchor: 'floor', confidence: 1 };
      }), materials, lighting: [], cameras: [], constraints: [], unresolvedDetections: [], spaces: sceneRooms.map((room: any) => ({ id: room.spaceId, floorId: 'floor-1', name: room.name, type: room.type })), floors: [{ id: 'floor-1', name: 'Ground Floor', elevationMm: 0, heightMm: 2700 }], coordinateSystem: 'right-handed-z-up', metadata: { branch: 'main', status: 'draft', changeReason: 'Update layout', schemaVersion: 'scene.v1', designVersion: '1.0.0' } };
      const saved = await supabase.from('scene_versions').insert({
        project_id: projectId, organization_id: organizationId,
        floor_plan_version_id: approvedPlanVersionId,
        version_number: nextNumber, branch_name: 'main',
        status: 'draft', scene, change_reason: 'Update layout', created_by: userId
      }).select('id').single();
      if (saved.error || !saved.data) {
        setPlanStatus(saved.error?.message ?? 'Scene could not be saved.');
        return;
      }
      savedId = saved.data.id;
    } else if (supabase) {
      setPlanStatus('Approve the floor plan before creating a scene.');
      return;
    }
    setSceneVersionId(savedId);
    setSceneVersionNumber(nextNumber);
    setSceneModules(modules);
    setSceneMaterials(materials);
    setSceneApproved(false);
    */
  }

  async function approveScene(targetSceneVersionId?: string): Promise<boolean> {
    const sceneToApprove = targetSceneVersionId ?? sceneVersionId;
    if (!sceneToApprove || !projectId) return false;
    const accessToken = await getValidToken();
    if (!accessToken) { setPlanStatus('Sign in again before approving a scene.'); return false; }
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneToApprove}/approve`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) { setPlanStatus(payload?.message ?? 'Scene approval failed.'); return false; }
      setSceneVersionId(sceneToApprove);
      setSceneApproved(true);
      setPlanStatus(`Scene v${payload.sceneVersion?.version_number ?? sceneVersionNumber} approved and ready for rendering.`);
      return true;
    } catch {
      setPlanStatus('Scene approval service is unavailable. The draft remains unchanged.');
      return false;
    }
  }

  const currentStage = stage ?? 'brief';

  return (
    <Shell
      sessionEmail={sessionEmail}
      orgName={orgName}
      projectId={projectId}
      projectName={projectName || 'Loading…'}
      workflowStages={stageStatuses}
    >
      <Suspense fallback={<RouteLoading label="Loading workspace…" />}><Routes>
        <Route path="brief" element={
          <BriefWorkspace
            projectId={projectId ?? ''}
            initialBrief={brief}
            fileName={planFile?.name}
            status={planStatus}
            onSave={saveBrief}
            onFile={selectPlan}
            // Guided + Auto starts by showing the source immediately. The
            // designer can calibrate and add optional room coverage guides
            // before explicitly starting the durable AI enrichment job.
            onAnalyze={() => navigate(`/projects/${projectId}/plan`)}
          />
        } />
        <Route path="plan" element={
          <PlanReviewWorkspace
            sourceAssetId={sourceAssetId}
            fileName={planFile?.name}
            preview={planPreview}
            status={planStatus}
            analysed={planAnalysed}
            proposals={planProposals}
            analysisIssues={planAnalysisIssues}
            initialSnapshot={demoSnapshot}
            layoutConfig={layoutConfig}
            onFile={selectPlan}
            onAnalyze={() => void analysePlan(true)}
            onStartManualReview={() => void analysePlan(false)}
            onRetryAnalysis={retryPlanAnalysis}
            analysisRetryAvailable={analysisRetryAvailable}
            onApprove={approvePlan}
            onDownloadDxf={downloadPlanDxf}
            onSaveDraft={(snapshot) => void savePlanDraft(snapshot)}
            onAnalysisGuidesChange={setAnalysisGuides}
          />
        } />
        <Route path="spaces" element={<SpacesWorkspace />} />
        <Route path="layouts" element={
          <LayoutConfigWorkspace
            initialConfig={layoutConfig ?? undefined}
            detectedDimensions={layoutRooms.find((room) => room.id === selectedLayoutSpaceId)?.dimensions ?? null}
            roomCategory={layoutRooms.find((room) => room.id === selectedLayoutSpaceId)?.roomType ?? 'other'}
            roomRequirements={layoutRooms.find((room) => room.id === selectedLayoutSpaceId)?.requirements ?? {}}
            rooms={layoutRooms}
            selectedSpaceId={selectedLayoutSpaceId}
            onSpaceChange={(spaceId) => setSelectedLayoutSpaceId(spaceId)}
            onGenerateCandidates={handleLayoutCandidates}
            onLoadDrafts={handleLoadLayoutDrafts}
            onGenerate={handleLayoutGenerate}
            onApproveCandidate={handleLayoutApprove}
          />
        } />
        <Route path="modules" element={<DesignFlowWorkspace stage="Design" projectId={projectId ?? null} planApproved={planApproved} briefComplete={briefSaved} sceneVersionId={sceneVersionId} sceneApproved={sceneApproved} modules={sceneModules} materials={sceneMaterials} onSceneCreated={saveScene} onSceneApproved={approveScene} />} />
        <Route path="modules-legacy" element={
          <PlaceholderScreen
            title="Modules"
            description="Once your layout is approved, each modular unit opens a specialist configurator — TV unit, wardrobe, kitchen, crockery, pooja, study, and bed units with exact parametric dimensions."
            icon="📦"
          />
        } />
        <Route path="materials" element={<DesignFlowWorkspace stage="Design" projectId={projectId ?? null} planApproved={planApproved} briefComplete={briefSaved} sceneVersionId={sceneVersionId} sceneApproved={sceneApproved} modules={sceneModules} materials={sceneMaterials} onSceneCreated={saveScene} onSceneApproved={approveScene} />} />
        <Route path="materials-legacy" element={
          <PlaceholderScreen
            title="Materials"
            description="Apply carcass, shutters, countertops, glass, profiles, hardware, and lighting from your company's curated material library."
            icon="🎨"
          />
        } />
        <Route path="3d" element={
          <>
            <SceneStudio sceneVersionId={sceneVersionId} />
            <DesignFlowWorkspace
              stage="Design"
              projectId={projectId ?? null}
              planApproved={planApproved}
              briefComplete={briefSaved}
              sceneVersionId={sceneVersionId}
              sceneApproved={sceneApproved}
              modules={sceneModules}
              materials={sceneMaterials}
              onSceneCreated={saveScene}
              onSceneApproved={approveScene}
            />
          </>
        } />
        <Route path="design" element={<DesignFlowWorkspace stage="Design" projectId={projectId ?? null} planApproved={planApproved} briefComplete={briefSaved} sceneVersionId={sceneVersionId} sceneApproved={sceneApproved} modules={sceneModules} materials={sceneMaterials} onSceneCreated={saveScene} onSceneApproved={approveScene} />} />
        <Route path="design-legacy" element={
          <DesignFlowWorkspace stage="Design" projectId={projectId ?? null} planApproved={planApproved} briefComplete={briefSaved} sceneVersionId={sceneVersionId} sceneApproved={sceneApproved} modules={sceneModules} materials={sceneMaterials} onSceneCreated={saveScene} onSceneApproved={approveScene} />
        } />
        <Route path="renders" element={
          <DesignFlowWorkspace
            stage="Visualize"
            projectId={projectId ?? null}
            planApproved={planApproved}
            briefComplete={briefSaved}
            sceneVersionId={sceneVersionId}
            sceneApproved={sceneApproved}
            modules={sceneModules}
            materials={sceneMaterials}
            onSceneCreated={saveScene}
            onSceneApproved={approveScene}
          />
        } />
        <Route path="production" element={<ProductionWorkspace projectId={projectId ?? ''} sceneVersionId={sceneVersionId} sceneApproved={sceneApproved} modules={sceneModules} materials={sceneMaterials} onSceneCreated={saveScene} onSceneApproved={async () => { await approveScene(); }} />} />
        <Route path="drawings" element={
          <DesignFlowWorkspace
            stage="Document"
            projectId={projectId ?? null}
            planApproved={planApproved}
            briefComplete={briefSaved}
            sceneVersionId={sceneVersionId}
            sceneApproved={sceneApproved}
            modules={sceneModules}
            materials={sceneMaterials}
            onSceneCreated={saveScene}
            onSceneApproved={approveScene}
          />
        } />
        <Route path="estimate" element={
          <CommercialWorkspace
            projectId={projectId ?? null}
            briefSaved={briefSaved}
            planApproved={planApproved}
            sceneVersionId={sceneVersionId}
            moduleCount={sceneModules.length}
          />
        } />
        <Route path="presentation" element={
          <DeliveryWorkspace
            briefSaved={briefSaved}
            planApproved={planApproved}
            sceneVersionId={sceneVersionId}
            moduleCount={sceneModules.length}
            providerReady={providerStatuses.some((p) => p.configured)}
            projectId={projectId ?? null}
          />
        } />
        {/* Default: redirect to brief */}
        <Route index element={<Navigate to="brief" replace />} />
        <Route path="*" element={<Navigate to="brief" replace />} />
      </Routes></Suspense>
    </Shell>
  );
}

// ─── Dashboard shell (non-project routes) ─────────────────────────
function DashboardShell({ sessionEmail, orgName, onStudioIdentitySaved }: { sessionEmail: string; orgName: string; onStudioIdentitySaved?: (name: string) => void }) {
  return (
    <Shell sessionEmail={sessionEmail} orgName={orgName}>
      <Suspense fallback={<RouteLoading label="Loading studio…" />}><Routes>
        <Route index element={<StudioDashboard orgName={orgName} />} />
        <Route path="projects" element={<ProjectDashboard sessionEmail={sessionEmail} orgName={orgName} />} />
        <Route path="tools/cnc" element={<CncPatternStudio />} />
        <Route path="tools/modules" element={<ModularUnitPlanner />} />
        <Route path="tools/calendar" element={<StudioOperations initialTab="calendar" />} />
        <Route path="tools/invoices" element={<StudioOperations initialTab="invoices" />} />
        <Route path="tools/aura" element={<AuraChat />} />
        <Route path="tools/render" element={<RenderLauncher />} />
        <Route path="tools/measurements" element={<MeasurementConverter />} />
        <Route path="tools/room-builder" element={<RoomBuilder />} />
        <Route path="library" element={<ReferenceLibraryWorkspace organizationId={null} projectId={null} />} />
        <Route path="templates" element={<Navigate to="/library" replace />} />
        <Route path="modules" element={<Navigate to="/library" replace />} />
        <Route path="materials" element={<Navigate to="/library" replace />} />
        <Route path="rules" element={<RulesWorkspace organizationId={null} />} />
        <Route path="team" element={<TeamWorkspace organizationId={null} />} />
        <Route path="settings" element={<SettingsWorkspace organizationId={null} orgName={orgName} onStudioIdentitySaved={onStudioIdentitySaved} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </Shell>
  );
}

function RouteLoading({ label }: { label: string }) {
  return <div role="status" aria-live="polite" style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: '#6f5f50', fontWeight: 700 }}>{label}</div>;
}

// ─── Root App ──────────────────────────────────────────────────────
export function App() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>('');
  const navigate = useNavigate();

  // Server-validated access token. Unlike getSession() (which reads a possibly
  // stale localStorage token), this rejects expired/corrupt sessions and clears
  // client state so protected project writes never use a false identity.
  const getValidToken = async (): Promise<string | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        void supabase.auth.signOut().catch(() => {});
        setSessionEmail(null);
        return null;
      }
      return (await supabase.auth.getSession()).data.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  // Supabase auth listener
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // getSession() only reads localStorage and may return a STALE/expired
    // token. getUser() is server-validated, so use it as the source of truth
    // and self-heal expired sessions instead of getting stuck on a hard error.
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        // Expired or corrupt session. Clear local state and require sign-in.
        void supabase!.auth.signOut().catch(() => {});
        setSessionEmail(null);
        return;
      }
      setSessionEmail(data.user.email ?? null);
      if (data.user.email) loadOrg(data.user.id);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (_event === 'SIGNED_OUT') {
        setSessionEmail(null);
        return;
      }
      setSessionEmail(next?.user.email ?? null);
      if (next?.user) loadOrg(next.user.id);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function loadOrg(userId: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from('organization_members')
      .select('organizations(name)')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (data) {
      const orgData = data.organizations as any;
      setOrgName(Array.isArray(orgData) ? orgData[0]?.name : orgData?.name ?? '');
    }
  }


  // Not authenticated
  if (!sessionEmail) {
    // These are deliberately local-first utilities. They never call providers,
    // write shared data, or claim a production result; sign-in is required as
    // soon as a draft is attached to a studio project.
    if (['/tools/room-builder', '/tools/measurements', '/tools/cnc'].includes(window.location.pathname)) {
      return <Suspense fallback={<RouteLoading label="Loading tool…" />}><Routes>
        <Route path="/tools/room-builder" element={<RoomBuilder />} />
        <Route path="/tools/measurements" element={<MeasurementConverter />} />
        <Route path="/tools/cnc" element={<CncPatternStudio />} />
      </Routes></Suspense>;
    }
    return <SignInScreen onSuccess={(email) => {
      setSessionEmail(email);
      navigate('/');
    }} />;
  }

  return (
    <Routes>
      {/* Project workspace — nested routes handle the 11 stages */}
      <Route path="/projects/:projectId/*" element={
        <ProjectWorkspace sessionEmail={sessionEmail} orgName={orgName} setSessionEmail={setSessionEmail} localDemoMode={localDemoMode} />
      } />

      {/* All other routes use the dashboard shell */}
      <Route path="/*" element={
        <DashboardShell sessionEmail={sessionEmail} orgName={orgName} onStudioIdentitySaved={setOrgName} />
      } />
    </Routes>
  );
}

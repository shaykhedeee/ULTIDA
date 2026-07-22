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

import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { X, Plus, ChevronRight } from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { Shell, DEFAULT_WORKFLOW_STAGES, type WorkflowStageConfig } from './Shell';
import { ProjectDashboard } from './features/projects/ProjectDashboard';

// Existing feature components — preserved
import { BriefWorkspace, type ClientBrief, emptyBrief } from './components/brief/BriefWorkspace';
import { PlanReviewWorkspace } from './components/plan/PlanReviewWorkspace';
import { LayoutConfigWorkspace, type LayoutConfig } from './components/layout/LayoutConfigWorkspace';
import type { LayoutCandidate } from '@ultida/layout-core';
import { DesignFlowWorkspace } from './components/design/DesignFlowWorkspace';
import { CommercialWorkspace } from './components/commercial/CommercialWorkspace';
import { DeliveryWorkspace } from './components/delivery/DeliveryWorkspace';
import { ReferenceLibraryWorkspace } from './components/library/ReferenceLibraryWorkspace';
import { SpacesWorkspace } from './features/spaces/SpacesWorkspace';

import './intake.css';

// ─── Local demo mode ──────────────────────────────────────────────
const localDemoMode = typeof window !== 'undefined' &&
  ['127.0.0.1', 'localhost'].includes(window.location.hostname) &&
  import.meta.env.VITE_LOCAL_DEMO !== 'false' &&
  !supabaseConfigured;

// ─── Types ────────────────────────────────────────────────────────
type ProviderStatus = { id: string; configured: boolean; operations: string[] };

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
      // Demo fallback
      onSuccess(email.trim() || 'demo@ultida.local');
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
      // Still allow access via demo mode if Supabase fails
      if (localDemoMode) {
        onSuccess(email.trim() || 'demo@ultida.local');
        return;
      }
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
              Supabase is not configured — demo mode will be used.
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

          {localDemoMode && (
            <button
              type="button"
              onClick={() => onSuccess('demo@ultida.local')}
              style={{
                width: '100%', padding: 10, background: '#f5f2eb', border: '1px solid #d4c5b2',
                borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, color: '#3d2a1a'
              }}
            >
              🚀 Continue as Demo Studio (Instant)
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
function ProjectWorkspace({ sessionEmail, orgName }: { sessionEmail: string; orgName: string }) {
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
  const [planAnalysisIssues, setPlanAnalysisIssues] = useState<Array<{ code: string; severity: 'warning' | 'critical'; entityId?: string; message: string }>>([]);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
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

  // Brief & layout
  const [brief, setBrief] = useState<ClientBrief>(emptyBrief);
  const [briefSaved, setBriefSaved] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);

  // Provider status
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

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
    if (!supabase || !projectId) return;
    let cancelled = false;
    void (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/plan-draft`, { headers: { authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (!cancelled && response.ok && payload?.draft) setDemoSnapshot(payload.draft);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const savePlanDraft = useCallback(async (draft: unknown) => {
    if (!supabase || !projectId) return;
    setDemoSnapshot(draft);
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) return;
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    await fetch(`${apiBase}/projects/${projectId}/plan-draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ draft })
    });
  }, [projectId]);

  useEffect(() => {
    if (!supabase || !projectId) return;
    let cancelled = false;
    void (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/brief`, { headers: { authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (cancelled || !response.ok || !payload?.brief) return;
      setBrief({ ...emptyBrief, ...payload.brief });
      setBriefSaved(Boolean(payload.isComplete));
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
      const res = await fetch(`${apiBase}/projects/${projectId}/status`);
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
        const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token ?? '' : '';
        const response = await fetch(`${apiBase}/plan/analyze/${analysisJobId}?projectId=${encodeURIComponent(projectId)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
        const payload = await response.json();
        if (stopped) return;
        if (payload.status === 'succeeded' && payload.analysis?.proposals) {
          setPlanProposals(payload.analysis.proposals);
          setPlanAnalysisIssues(payload.analysis.topologyIssues ?? []);
          setPlanAnalysed(true);
          setPlanStatus('Provider analysis complete. Review and calibrate every proposal.');
        } else if (payload.status === 'failed') {
          setPlanStatus(payload.error?.message ?? 'Provider analysis failed. No geometry was generated.');
          setAnalysisJobId(null);
        } else {
          setPlanStatus(`Analysis ${payload.status ?? 'processing'}...`);
        }
      } catch {
        if (!stopped) setPlanStatus('Analysis status could not be refreshed. Retrying...');
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [analysisJobId, analysisRefreshNonce, planAnalysed, projectId]);

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
    if (s.id === 'layouts' && !(useServerStages ? serverStageMap['plan'] : planApproved)) { status = 'locked'; lockReason = 'Configure spaces first'; }
    if (s.id === 'modules' && !(useServerStages ? serverStageMap['plan'] : planApproved)) { status = 'locked'; lockReason = 'Approve layout first'; }
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
    setPlanAnalysisIssues([]);
    setPlanStatus(`Attached ${file.name}. Run analysis to process.`);
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (file.type.startsWith('image/') || ['.png','.jpg','.jpeg','.webp','.svg'].includes(ext)) {
      setPlanPreview(URL.createObjectURL(file));
    } else {
      setPlanPreview(null);
    }
  }

  async function analysePlan() {
    if (!planFile) return setPlanStatus('Choose a floor plan first.');
    if (!projectId) return setPlanStatus('Create or open a project before analysing a floor plan.');
    if (!supabase) return setPlanStatus('Supabase is required for professional plan analysis. Sign in and try again.');
    setPlanStatus('Uploading and preparing review...');
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    let uploadedAssetId: string | null = null;
    let accessToken: string | null = null;

    if (supabase && projectId) {
      const session = await supabase.auth.getSession();
      accessToken = session.data.session?.access_token ?? null;
      if (!accessToken) return setPlanStatus('Your session has expired. Sign in again before uploading a floor plan.');
      const authHeaders = { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` };
      setPlanStatus('Preparing a secure upload...');
      const initiated = await fetch(`${apiBase}/projects/${projectId}/floor-plans/initiate`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ fileName: planFile.name, mimeType: planFile.type, fileSize: planFile.size })
      });
      const initiation = await initiated.json().catch(() => null);
      if (!initiated.ok || !initiation?.token || !initiation?.storagePath) return setPlanStatus(initiation?.message ?? 'Secure floor-plan upload could not be initiated.');
      setPlanStatus('Uploading original floor plan...');
      const stored = await supabase.storage.from(initiation.bucket ?? 'project-assets').uploadToSignedUrl(initiation.storagePath, initiation.token, planFile, { contentType: planFile.type });
      if (stored.error) return setPlanStatus(`Upload failed: ${stored.error.message}`);
      setPlanStatus('Verifying upload and registering analysis...');
      const completed = await fetch(`${apiBase}/projects/${projectId}/floor-plans/complete`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ assetId: initiation.assetId, storagePath: initiation.storagePath, fileName: planFile.name, mimeType: planFile.type, fileSize: planFile.size })
      });
      const completion = await completed.json().catch(() => null);
      if (!completed.ok || !completion?.asset?.id) return setPlanStatus(completion?.message ?? 'The uploaded floor plan could not be registered.');
      uploadedAssetId = completion.asset.id;
      setSourceAssetId(uploadedAssetId);
      if (completion.jobId) setAnalysisJobId(completion.jobId);
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers.authorization = `Bearer ${accessToken}`;
      const response = await fetch(`${apiBase}/plan/analyze`, {
        method: 'POST', headers,
        body: JSON.stringify({ projectId, sourceAssetId: uploadedAssetId, fileName: planFile.name, mimeType: planFile.type, idempotencyKey: `plan:${projectId}:${uploadedAssetId}` })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : `Plan intake failed with HTTP ${response.status}.`;
        return setPlanStatus(detail);
      }
      if (payload.status === 'succeeded' && payload.output?.proposals) {
        setPlanProposals(payload.output.proposals);
        setPlanAnalysisIssues(payload.output.topologyIssues ?? []);
        setPlanAnalysed(true);
        setPlanStatus('Provider analysis complete. Review and calibrate every proposal.');
      } else {
        setAnalysisJobId(payload.jobId ?? null);
        setPlanStatus(`Analysis queued (${payload.jobId}). Waiting for the provider worker...`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Network request failed.';
      setPlanStatus(`Plan service could not be reached at ${apiBase}. ${detail}`);
    }
  }

  async function approvePlan(snapshot: unknown) {
    if (!sourceAssetId) {
      setPlanStatus('Upload and analyse an immutable floor-plan source before approval.');
      return;
    }
    setReviewSnapshot(snapshot);
    let serverVersionId = approvedPlanVersionId;
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accessToken = supabase ? (await supabase.auth.getSession()).data.session?.access_token ?? '' : '';
      if (accessToken) headers.authorization = `Bearer ${accessToken}`;
      const canonicalModel = snapshot;
      const response = await fetch(`${apiBase}/projects/${projectId}/plan/approve`, {
        method: 'POST', headers,
        body: JSON.stringify({ projectId, sourceAssetId, canonicalModel, approvedBy: null, floorPlanVersionId: approvedPlanVersionId ?? undefined })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message ?? 'Plan approval failed.');
      serverVersionId = payload.floorPlanVersionId;
    } catch (error) {
      setPlanStatus(error instanceof Error ? error.message : 'Plan approval failed.');
      return;
    }
    if (!serverVersionId) {
      setPlanStatus('Plan approval requires an authenticated Supabase project.');
      return;
    }
    setApprovedPlanVersionId(serverVersionId);
    setPlanApproved(true);
    setPlanStatus('Plan approved. Proceed to Spaces.');
    navigate(`/projects/${projectId}/spaces`);
    void fetchProjectStatus();
  }

  async function saveBrief(nextBrief: ClientBrief, isComplete = true) {
    if (projectId && supabase) {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error('Your session expired. Sign in again before saving the brief.');
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/brief`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ brief: nextBrief, isComplete })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const fieldDetails = payload?.fieldErrors ? ` ${Object.values(payload.fieldErrors).join(' ')}` : '';
        throw new Error(`${payload?.message ?? 'Brief could not be saved.'}${fieldDetails}`);
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
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Sign in before approving a layout.');
    const { data: spaces, error: spacesError } = await supabase
      .from('spaces')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at')
      .limit(1);
    if (spacesError || !spaces?.[0]?.id) throw new Error('Approve the floor plan and configure a space before approving a layout.');
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    const headers = { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` };
    const created = await fetch(`${apiBase}/projects/${projectId}/layouts`, {
      method: 'POST', headers,
      body: JSON.stringify({ spaceId: spaces[0].id, layoutShape: candidate.shape, label: candidate.candidateType, candidate, score: candidate.score })
    });
    const createdPayload = await created.json();
    if (!created.ok) throw new Error(createdPayload?.message ?? 'Layout could not be saved.');
    const approved = await fetch(`${apiBase}/projects/${projectId}/layouts/${createdPayload.layout.id}/approve`, { method: 'POST', headers, body: JSON.stringify({ config }) });
    const approvedPayload = await approved.json();
    if (!approved.ok) throw new Error(approvedPayload?.message ?? 'Layout could not be approved.');
    setLayoutConfig(config);
    void fetchProjectStatus();
  }

  async function saveScene(id: string, modules: typeof sceneModules, materials: any[] = []) {
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
  }

  async function approveScene() {
    if (!sceneVersionId) return;
    if (supabase) {
      const existing = await supabase.from('scene_versions').select('scene').eq('id', sceneVersionId).single();
      if (existing.error || !existing.data?.scene) {
        setPlanStatus(existing.error?.message ?? 'Scene approval could not load the saved scene.');
        return;
      }
      const scene = existing.data.scene as { metadata?: Record<string, unknown> };
      const approved = await supabase.from('scene_versions').update({
        status: 'approved',
        scene: { ...scene, metadata: { ...(scene.metadata ?? {}), status: 'approved' } }
      }).eq('id', sceneVersionId);
      if (approved.error) {
        setPlanStatus(approved.error.message);
        return;
      }
    }
    setSceneApproved(true);
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
      <Routes>
        <Route path="brief" element={
          <BriefWorkspace
            initialBrief={brief}
            fileName={planFile?.name}
            status={planStatus}
            onSave={saveBrief}
            onFile={selectPlan}
            onAnalyze={analysePlan}
          />
        } />
        <Route path="plan" element={
          <PlanReviewWorkspace
            fileName={planFile?.name}
            preview={planPreview}
            status={planStatus}
            analysed={planAnalysed}
            proposals={planProposals}
            analysisIssues={planAnalysisIssues}
            initialSnapshot={demoSnapshot}
            layoutConfig={layoutConfig}
            onFile={selectPlan}
            onAnalyze={analysePlan}
            onApprove={approvePlan}
            onSaveDraft={(snapshot) => void savePlanDraft(snapshot)}
          />
        } />
        <Route path="spaces" element={<SpacesWorkspace />} />
        <Route path="layouts" element={
          <LayoutConfigWorkspace
            initialConfig={layoutConfig ?? undefined}
            detectedDimensions={planAnalysed ? { lengthMm: 5200, widthMm: 3800, heightMm: 2700 } : null}
            onGenerate={handleLayoutGenerate}
            onApproveCandidate={handleLayoutApprove}
          />
        } />
        <Route path="modules" element={
          <PlaceholderScreen
            title="Modules"
            description="Once your layout is approved, each modular unit opens a specialist configurator — TV unit, wardrobe, kitchen, crockery, pooja, study, and bed units with exact parametric dimensions."
            icon="📦"
          />
        } />
        <Route path="materials" element={
          <PlaceholderScreen
            title="Materials"
            description="Apply carcass, shutters, countertops, glass, profiles, hardware, and lighting from your company's curated material library."
            icon="🎨"
          />
        } />
        <Route path="3d" element={
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
        } />
        <Route path="design" element={
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
      </Routes>
    </Shell>
  );
}

// ─── Dashboard shell (non-project routes) ─────────────────────────
function DashboardShell({ sessionEmail, orgName }: { sessionEmail: string; orgName: string }) {
  return (
    <Shell sessionEmail={sessionEmail} orgName={orgName}>
      <Routes>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectDashboard sessionEmail={sessionEmail} orgName={orgName} />} />
        <Route path="library" element={<ReferenceLibraryWorkspace organizationId={null} projectId={null} />} />
        <Route path="templates" element={<Navigate to="/library" replace />} />
        <Route path="modules" element={<Navigate to="/library" replace />} />
        <Route path="materials" element={<Navigate to="/library" replace />} />
        <Route path="rules" element={<PlaceholderScreen title="Company Rules" description="Configure company-specific design standards: finger groove gap, loft filler, shutter widths, hardware brands, and more." icon="📏" />} />
        <Route path="team" element={<PlaceholderScreen title="Team" description="Manage designers, production staff, and viewers in your organisation." icon="👥" />} />
        <Route path="settings" element={<PlaceholderScreen title="Settings" description="Configure your workspace, integrations, billing, and notification preferences." icon="⚙️" />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </Shell>
  );
}

// ─── Root App ──────────────────────────────────────────────────────
export function App() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(
    localDemoMode ? 'demo@ultida.local' : null
  );
  const [orgName, setOrgName] = useState<string>('');
  const navigate = useNavigate();

  // Supabase auth listener
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email ?? null;
      setSessionEmail(email);
      if (email) loadOrg(data.session!.user.id);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSessionEmail(next?.user.email ?? null);
      if (next?.user) loadOrg(next.user.id);
    });
    return () => data.subscription.unsubscribe();
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
    return <SignInScreen onSuccess={(email) => {
      setSessionEmail(email);
      navigate('/projects');
    }} />;
  }

  return (
    <Routes>
      {/* Project workspace — nested routes handle the 11 stages */}
      <Route path="/projects/:projectId/*" element={
        <ProjectWorkspace sessionEmail={sessionEmail} orgName={orgName} />
      } />

      {/* All other routes use the dashboard shell */}
      <Route path="/*" element={
        <DashboardShell sessionEmail={sessionEmail} orgName={orgName} />
      } />
    </Routes>
  );
}

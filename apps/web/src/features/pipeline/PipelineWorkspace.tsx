import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  FolderGit2,
  HardDrive,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiBase } from '../../lib/api-base';
import { supabase } from '../../lib/supabase';

export type PipelineTaskStatus =
  | 'Pending'
  | 'In progress'
  | 'Waiting for client'
  | 'Revision needed'
  | 'Approved'
  | 'Complete';

export type PipelineStage =
  | 'brief'
  | 'plan'
  | 'spaces'
  | '3d'
  | 'drawings'
  | 'estimate';

export type PipelineTaskPriority = 'high' | 'medium' | 'low';

export type PipelineTask = {
  id: string;
  projectId: string;
  roomId?: string | null;
  roomName?: string | null;
  title: string;
  stage: PipelineStage;
  status: PipelineTaskStatus;
  owner: string;
  nextAction: string;
  dependencies: string[];
  assumptions: string;
  missingInformation: string;
  priority: PipelineTaskPriority;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  completedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  decisionNotes: string;
  updatedAt: string;
};

export type PipelineFileCategory =
  | 'Floor Plan'
  | 'Site Survey'
  | '3D Render'
  | 'Working Drawing'
  | 'Cutlist / BOQ'
  | 'Client Approval'
  | 'Reference / Moodboard';

export type PipelineFileItem = {
  id: string;
  projectId: string;
  roomId?: string | null;
  roomName?: string | null;
  title: string;
  category: PipelineFileCategory;
  revision: string;
  sourceType: 'uploaded_file' | 'external_drive_link';
  externalUrl?: string | null;
  assetId?: string | null;
  storagePath?: string | null;
  signedDownloadUrl?: string | null;
  mimeType?: string | null;
  owner: string;
  notes: string;
  approvalStatus: 'Draft' | 'Pending Review' | 'Approved' | 'Superseded';
  approvedBy?: string | null;
  approvedAt?: string | null;
  decisionNotes: string;
  createdAt: string;
  updatedAt: string;
};

type RoomSummary = {
  id: string;
  name: string;
  roomType: string;
  ceilingHeightMm?: number;
  status?: string;
};

type ProjectPipelineSummary = {
  projectId: string;
  projectName: string;
  clientName: string;
  workflowStage: string;
  assignedDesigner: string;
  rooms: RoomSummary[];
  pipeline: {
    version: number;
    updatedAt: string;
    tasks: PipelineTask[];
    files: PipelineFileItem[];
  };
};

const STAGE_META: Record<PipelineStage, { label: string; routeSuffix: string; color: string }> = {
  brief: { label: '1. Brief', routeSuffix: 'brief', color: '#0284c7' },
  plan: { label: '2. Floor Plan', routeSuffix: 'plan', color: '#4f46e5' },
  spaces: { label: '3. Rooms & Furniture', routeSuffix: 'spaces', color: '#0d9488' },
  '3d': { label: '4. 3D & Render', routeSuffix: '3d', color: '#9333ea' },
  drawings: { label: '5. Drawings & Cutlist', routeSuffix: 'drawings', color: '#d97706' },
  estimate: { label: '6. Estimate & BOQ', routeSuffix: 'estimate', color: '#16a34a' },
};

const ALL_STATUSES: PipelineTaskStatus[] = [
  'Pending',
  'In progress',
  'Waiting for client',
  'Revision needed',
  'Approved',
  'Complete',
];

const FILE_CATEGORIES: PipelineFileCategory[] = [
  'Floor Plan',
  'Site Survey',
  '3D Render',
  'Working Drawing',
  'Cutlist / BOQ',
  'Client Approval',
  'Reference / Moodboard',
];

function priorityRank(priority: PipelineTaskPriority): number {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

export function PipelineWorkspace() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectPipelineSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(routeProjectId ?? '');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Daily Session Planner state (Section 6: defaults to 120 minutes)
  const [sessionBudgetMinutes, setSessionBudgetMinutes] = useState<number>(120);
  const [sessionOwnerFilter, setSessionOwnerFilter] = useState<string>('all');

  // New Task Form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStage, setNewTaskStage] = useState<PipelineStage>('spaces');
  const [newTaskRoomId, setNewTaskRoomId] = useState<string>('');
  const [newTaskOwner, setNewTaskOwner] = useState('Lead Designer');
  const [newTaskPriority, setNewTaskPriority] = useState<PipelineTaskPriority>('medium');
  const [newTaskMinutes, setNewTaskMinutes] = useState<string>('35');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  const [newTaskNextAction, setNewTaskNextAction] = useState('');
  const [newTaskAssumptions, setNewTaskAssumptions] = useState('');
  const [newTaskMissingInfo, setNewTaskMissingInfo] = useState('');
  const [newTaskDependencyId, setNewTaskDependencyId] = useState('');

  // New File / Drive Link Form (Sections 1, 3, 5)
  const [fileSourceType, setFileSourceType] = useState<'external_drive_link' | 'uploaded_file'>('external_drive_link');
  const [fileTitle, setFileTitle] = useState('');
  const [fileCategory, setFileCategory] = useState<PipelineFileCategory>('Working Drawing');
  const [fileRevision, setFileRevision] = useState('REV-1');
  const [fileRoomId, setFileRoomId] = useState('');
  const [fileExternalUrl, setFileExternalUrl] = useState('');
  const [fileOwner, setFileOwner] = useState('Lead Designer');
  const [fileNotes, setFileNotes] = useState('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error' | 'warn'; text: string } | null>(null);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        headers.authorization = `Bearer ${data.session.access_token}`;
      }
    }
    return headers;
  }

  async function loadPipelineData(targetProjectId?: string) {
    setLoading(true);
    setFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/studio/pipeline`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Pipeline load failed (${res.status}).`);
      }
      const payload = await res.json();
      const loadedProjects: ProjectPipelineSummary[] = Array.isArray(payload.projects) ? payload.projects : [];
      setProjects(loadedProjects);

      const initialPid = targetProjectId || routeProjectId || selectedProjectId || loadedProjects[0]?.projectId || '';
      if (initialPid) {
        setSelectedProjectId(initialPid);
        // Fetch detailed project pipeline (with signed asset URLs)
        const detailRes = await fetch(`${getApiBase()}/projects/${encodeURIComponent(initialPid)}/pipeline`, { headers });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setProjects((prev) =>
            prev.map((p) =>
              p.projectId === initialPid
                ? {
                    ...p,
                    rooms: Array.isArray(detail.rooms) ? detail.rooms : p.rooms,
                    pipeline: detail.pipeline ?? p.pipeline,
                  }
                : p,
            ),
          );
        }
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load studio pipeline records.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPipelineData(routeProjectId);
  }, [routeProjectId]);

  const activeProject = useMemo(
    () => projects.find((p) => p.projectId === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const allStudioTasks = useMemo(
    () =>
      projects.flatMap((p) =>
        p.pipeline.tasks.map((t) => ({
          ...t,
          projectName: p.projectName,
        })),
      ),
    [projects],
  );

  const allStudioFiles = useMemo(
    () =>
      projects.flatMap((p) =>
        p.pipeline.files.map((f) => ({
          ...f,
          projectName: p.projectName,
        })),
      ),
    [projects],
  );

  // Studio Overview Metrics derived strictly from saved records (Section 6)
  const studioMetrics = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const completedIds = new Set(
      allStudioTasks.filter((t) => t.status === 'Complete' || t.status === 'Approved').map((t) => t.id),
    );

    const overdueTasks = allStudioTasks.filter(
      (t) =>
        t.status !== 'Complete' &&
        t.status !== 'Approved' &&
        Boolean(t.dueDate) &&
        String(t.dueDate) < todayIso,
    );
    const waitingForClient = allStudioTasks.filter((t) => t.status === 'Waiting for client');
    const missingSiteMeasurements = allStudioTasks.filter(
      (t) => t.status !== 'Complete' && Boolean(t.missingInformation?.trim()),
    );
    const draftRevisions = allStudioFiles.filter(
      (f) => f.approvalStatus === 'Draft' || f.approvalStatus === 'Pending Review',
    );
    const upcomingHandovers = allStudioTasks.filter(
      (t) => (t.stage === 'drawings' || t.stage === 'estimate') && t.status !== 'Complete',
    );

    return {
      completedIds,
      overdueCount: overdueTasks.length,
      waitingClientCount: waitingForClient.length,
      missingInfoCount: missingSiteMeasurements.length,
      draftRevisionCount: draftRevisions.length,
      upcomingHandoverCount: upcomingHandovers.length,
    };
  }, [allStudioTasks, allStudioFiles]);

  // 120-Minute Daily Session Planner (Section 6)
  const dailySessionPlan = useMemo(() => {
    const completedIds = studioMetrics.completedIds;
    const candidateTasks = allStudioTasks.filter((task) => {
      if (task.status === 'Complete' || task.status === 'Approved') return false;
      if (task.status === 'Waiting for client') return false; // Exclude waiting for client
      if (sessionOwnerFilter !== 'all' && task.owner.toLowerCase() !== sessionOwnerFilter.toLowerCase()) {
        return false;
      }
      // Exclude tasks with unresolved dependencies
      const hasUnresolvedDependency = (task.dependencies ?? []).some((depId) => !completedIds.has(depId));
      if (hasUnresolvedDependency) return false;
      return true;
    });

    const sorted = [...candidateTasks].sort((a, b) => {
      const pDiff = priorityRank(a.priority) - priorityRank(b.priority);
      if (pDiff !== 0) return pDiff;
      const dA = a.dueDate || '9999-12-31';
      const dB = b.dueDate || '9999-12-31';
      return dA.localeCompare(dB);
    });

    const selected: Array<typeof sorted[number]> = [];
    const missingEstimates: Array<typeof sorted[number]> = [];
    let usedMinutes = 0;

    for (const task of sorted) {
      if (typeof task.estimatedMinutes !== 'number' || task.estimatedMinutes <= 0) {
        missingEstimates.push(task);
        continue;
      }
      if (usedMinutes + task.estimatedMinutes <= sessionBudgetMinutes) {
        selected.push(task);
        usedMinutes += task.estimatedMinutes;
      }
    }

    return {
      selected,
      missingEstimates,
      usedMinutes,
      remainingMinutes: Math.max(0, sessionBudgetMinutes - usedMinutes),
    };
  }, [allStudioTasks, studioMetrics.completedIds, sessionBudgetMinutes, sessionOwnerFilter]);

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    for (const t of allStudioTasks) {
      if (t.owner?.trim()) owners.add(t.owner.trim());
    }
    return Array.from(owners);
  }, [allStudioTasks]);

  const filteredTasks = useMemo(() => {
    if (!activeProject) return [];
    return activeProject.pipeline.tasks.filter((task) => {
      if (selectedRoomId !== 'all' && (task.roomId ?? '') !== selectedRoomId) return false;
      if (selectedStageFilter !== 'all' && task.stage !== selectedStageFilter) return false;
      if (selectedStatusFilter !== 'all' && task.status !== selectedStatusFilter) return false;
      return true;
    });
  }, [activeProject, selectedRoomId, selectedStageFilter, selectedStatusFilter]);

  const filteredFiles = useMemo(() => {
    if (!activeProject) return [];
    return activeProject.pipeline.files.filter((file) => {
      if (selectedRoomId !== 'all' && (file.roomId ?? '') !== selectedRoomId) return false;
      return true;
    });
  }, [activeProject, selectedRoomId]);

  async function persistProjectPipeline(
    targetProject: ProjectPipelineSummary,
    nextTasks: PipelineTask[],
    nextFiles: PipelineFileItem[],
    successMsg: string,
  ) {
    setSaving(true);
    setFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(targetProject.projectId)}/pipeline`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          expectedVersion: targetProject.pipeline.version,
          tasks: nextTasks,
          files: nextFiles,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.message ||
            (res.status === 409
              ? 'Concurrent edit detected: reload the pipeline before saving.'
              : `Pipeline save failed (${res.status}).`),
        );
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.projectId === targetProject.projectId
            ? { ...p, pipeline: data.pipeline }
            : p,
        ),
      );
      setFeedback({ type: 'ok', text: successMsg });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Pipeline save failed.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTaskStatusChange(task: PipelineTask, nextStatus: PipelineTaskStatus) {
    const proj = projects.find((p) => p.projectId === task.projectId);
    if (!proj) return;
    const now = new Date().toISOString();
    const updatedTasks = proj.pipeline.tasks.map((t) => {
      if (t.id !== task.id) return t;
      return {
        ...t,
        status: nextStatus,
        completedAt: nextStatus === 'Complete' ? now : t.completedAt ?? null,
        approvedAt: nextStatus === 'Approved' ? now : t.approvedAt ?? null,
        approvedBy: nextStatus === 'Approved' ? t.owner : t.approvedBy ?? null,
        updatedAt: now,
      };
    });
    await persistProjectPipeline(
      proj,
      updatedTasks,
      proj.pipeline.files,
      `Task "${task.title}" updated to ${nextStatus}.`,
    );
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;
    const now = new Date().toISOString();
    const matchedRoom = activeProject.rooms.find((r) => r.id === newTaskRoomId);
    const parsedMins = Number(newTaskMinutes);
    const newTask: PipelineTask = {
      id: `${activeProject.projectId}-task-${Date.now()}`,
      projectId: activeProject.projectId,
      roomId: matchedRoom ? matchedRoom.id : null,
      roomName: matchedRoom ? matchedRoom.name : 'All Rooms',
      title: newTaskTitle.trim(),
      stage: newTaskStage,
      status: 'Pending', // New work always begins Pending per Section 1
      owner: newTaskOwner.trim() || 'Lead Designer',
      nextAction: newTaskNextAction.trim() || 'Review requirements and execute stage deliverables.',
      dependencies: newTaskDependencyId ? [newTaskDependencyId] : [],
      assumptions: newTaskAssumptions.trim(),
      missingInformation: newTaskMissingInfo.trim(),
      priority: newTaskPriority,
      estimatedMinutes: Number.isFinite(parsedMins) && parsedMins > 0 ? Math.round(parsedMins) : null,
      dueDate: newTaskDueDate || null,
      completedAt: null,
      approvedBy: null,
      approvedAt: null,
      decisionNotes: '',
      updatedAt: now,
    };

    const nextTasks = [newTask, ...activeProject.pipeline.tasks];
    await persistProjectPipeline(
      activeProject,
      nextTasks,
      activeProject.pipeline.files,
      `Created task "${newTask.title}" in Pending status.`,
    );
    setNewTaskTitle('');
    setNewTaskNextAction('');
    setNewTaskAssumptions('');
    setNewTaskMissingInfo('');
    setNewTaskDependencyId('');
  }

  async function handleAddFileOrLink(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !fileTitle.trim()) return;

    const now = new Date().toISOString();
    const matchedRoom = activeProject.rooms.find((r) => r.id === fileRoomId);

    let uploadedAssetId: string | null = null;
    let uploadedStoragePath: string | null = null;
    let uploadedMimeType: string | null = null;
    let signedPreviewUrl: string | null = null;

    if (fileSourceType === 'external_drive_link') {
      if (!/^https:\/\//i.test(fileExternalUrl.trim())) {
        setFeedback({
          type: 'error',
          text: 'External Google Drive or document links must use a valid https:// URL.',
        });
        return;
      }
    } else {
      if (!uploadingFile) {
        setFeedback({
          type: 'error',
          text: 'Choose a studio file to upload or switch to External Google Drive / HTTPS Link.',
        });
        return;
      }
      try {
        setSaving(true);
        const headers = await getAuthHeaders();
        const initRes = await fetch(
          `${getApiBase()}/projects/${encodeURIComponent(activeProject.projectId)}/references/initiate`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              fileName: uploadingFile.name,
              mimeType: uploadingFile.type || 'image/png',
              fileSize: uploadingFile.size,
            }),
          },
        );
        const initData = await initRes.json().catch(() => null);
        if (!initRes.ok || !initData?.success || !supabase) {
          throw new Error(initData?.message || 'Private studio file upload could not be initiated.');
        }
        const uploadRes = await supabase.storage
          .from(initData.bucket || 'project-assets')
          .uploadToSignedUrl(initData.storagePath, initData.token, uploadingFile);
        if (uploadRes.error) throw new Error(uploadRes.error.message);

        const completeRes = await fetch(
          `${getApiBase()}/projects/${encodeURIComponent(activeProject.projectId)}/references/complete`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              assetId: initData.assetId,
              storagePath: initData.storagePath,
              fileName: uploadingFile.name,
              mimeType: uploadingFile.type || 'image/png',
              fileSize: uploadingFile.size,
              title: fileTitle.trim(),
              tags: [fileCategory.toLowerCase(), fileRevision.toLowerCase()],
              notes: fileNotes.trim(),
            }),
          },
        );
        const completeData = await completeRes.json().catch(() => null);
        if (!completeRes.ok || !completeData?.success) {
          throw new Error(completeData?.message || 'Uploaded file verification failed.');
        }
        uploadedAssetId = initData.assetId;
        uploadedStoragePath = initData.storagePath;
        uploadedMimeType = uploadingFile.type || 'image/png';
        signedPreviewUrl = completeData.item?.metadata?.previewUrl ?? null;
      } catch (err) {
        setSaving(false);
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'File upload failed.',
        });
        return;
      }
    }

    // Store new revisions separately while marking older approved revisions of the same title + room as kept in history
    const newFileItem: PipelineFileItem = {
      id: `${activeProject.projectId}-file-${Date.now()}`,
      projectId: activeProject.projectId,
      roomId: matchedRoom ? matchedRoom.id : null,
      roomName: matchedRoom ? matchedRoom.name : 'All Rooms',
      title: fileTitle.trim(),
      category: fileCategory,
      revision: fileRevision.trim() || 'REV-1',
      sourceType: fileSourceType,
      externalUrl: fileSourceType === 'external_drive_link' ? fileExternalUrl.trim() : null,
      assetId: uploadedAssetId,
      storagePath: uploadedStoragePath,
      signedDownloadUrl: signedPreviewUrl,
      mimeType: uploadedMimeType,
      owner: fileOwner.trim() || 'Lead Designer',
      notes: fileNotes.trim(),
      approvalStatus: 'Draft', // Saving a file never silently approves geometry or production
      approvedBy: null,
      approvedAt: null,
      decisionNotes: '',
      createdAt: now,
      updatedAt: now,
    };

    const nextFiles = [newFileItem, ...activeProject.pipeline.files];
    await persistProjectPipeline(
      activeProject,
      activeProject.pipeline.tasks,
      nextFiles,
      `Saved ${fileSourceType === 'external_drive_link' ? 'external Drive/HTTPS link' : 'uploaded studio file'} "${newFileItem.title}" (${newFileItem.revision}) as Draft.`,
    );
    setFileTitle('');
    setFileExternalUrl('');
    setFileNotes('');
    setUploadingFile(null);
  }

  async function handleFileApprovalDecision(
    file: PipelineFileItem,
    nextStatus: 'Draft' | 'Pending Review' | 'Approved' | 'Superseded',
  ) {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const updatedFiles = activeProject.pipeline.files.map((item) => {
      if (item.id !== file.id) return item;
      return {
        ...item,
        approvalStatus: nextStatus,
        approvedBy: nextStatus === 'Approved' ? item.owner : item.approvedBy ?? null,
        approvedAt: nextStatus === 'Approved' ? now : item.approvedAt ?? null,
        decisionNotes:
          nextStatus === 'Approved'
            ? `Explicitly approved ${item.revision} on ${now.slice(0, 10)}.`
            : item.decisionNotes,
        updatedAt: now,
      };
    });
    await persistProjectPipeline(
      activeProject,
      activeProject.pipeline.tasks,
      updatedFiles,
      `Revision ${file.revision} of "${file.title}" marked ${nextStatus}.`,
    );
  }

  function openProjectStage(projectId: string, stage: PipelineStage, roomId?: string | null) {
    const suffix = STAGE_META[stage].routeSuffix;
    const query = roomId ? `?roomId=${encodeURIComponent(roomId)}` : '';
    navigate(`/projects/${projectId}/${suffix}${query}`);
  }

  const totalTasks = activeProject?.pipeline.tasks.length ?? 0;
  const completedTasks =
    activeProject?.pipeline.tasks.filter((t) => t.status === 'Complete' || t.status === 'Approved').length ?? 0;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <main style={{ maxWidth: 1380, margin: '0 auto', padding: '24px 28px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Hero & Explicit Authority Guarantee */}
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          padding: '22px 24px',
          borderRadius: 16,
          border: '1px solid var(--line, #e5e7eb)',
          background: 'var(--surface, #ffffff)',
        }}
      >
        <div style={{ maxWidth: 780 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0d9488', marginBottom: 6 }}>
            <FolderGit2 size={14} /> Native Studio Pipeline, Revisions & Daily Session Planner
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text, #111827)' }}>
            Project Pipeline & Files
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary, #4b5563)', lineHeight: 1.5 }}>
            Track project deliverables from measured floor plan to workshop cutlists, link Google Drive folders alongside private studio uploads, and plan focused daily work sessions.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 12, fontWeight: 600 }}>
            <ShieldCheck size={16} />
            <span>Explicit Approval Guard: Saving tasks or files never silently approves geometry or production</span>
          </div>
          <button
            type="button"
            onClick={() => void loadPipelineData(selectedProjectId)}
            disabled={loading || saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line, #d1d5db)', background: 'var(--surface-2, #f9fafb)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={13} /> {loading ? 'Refreshing…' : 'Reload Latest Records'}
          </button>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            background: feedback.type === 'error' ? '#fef2f2' : feedback.type === 'warn' ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${feedback.type === 'error' ? '#fecaca' : feedback.type === 'warn' ? '#fde68a' : '#bbf7d0'}`,
            color: feedback.type === 'error' ? '#b91c1c' : feedback.type === 'warn' ? '#b45309' : '#15803d',
          }}
        >
          {feedback.text}
        </div>
      )}

      {/* Section 6: Studio Overview & 120-Minute Daily Session Planner */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
        }}
      >
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--line, #e5e7eb)', background: 'var(--surface, #fff)' }}>
          <small style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Overdue Work</small>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{studioMetrics.overdueCount}</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>Tasks past target due date</span>
        </div>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--line, #e5e7eb)', background: 'var(--surface, #fff)' }}>
          <small style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>Waiting for Client</small>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{studioMetrics.waitingClientCount}</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>Excluded from active session queue</span>
        </div>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--line, #e5e7eb)', background: 'var(--surface, #fff)' }}>
          <small style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>Missing Site Info</small>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{studioMetrics.missingInfoCount}</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>Site measurements / services pending</span>
        </div>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--line, #e5e7eb)', background: 'var(--surface, #fff)' }}>
          <small style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Draft Revisions</small>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{studioMetrics.draftRevisionCount}</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>Files & links awaiting sign-off</span>
        </div>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--line, #e5e7eb)', background: 'var(--surface, #fff)' }}>
          <small style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Upcoming Handovers</small>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{studioMetrics.upcomingHandoverCount}</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>Drawings, cutlist & BOQ release</span>
        </div>
      </section>

      {/* 120-Minute Daily Session Planner */}
      <section
        style={{
          padding: 20,
          borderRadius: 14,
          border: '1px solid var(--line, #e5e7eb)',
          background: 'var(--surface, #ffffff)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: '#0d9488' }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Daily Session Planner</h2>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#ccfbf1', color: '#115e59', fontWeight: 700 }}>
                {dailySessionPlan.usedMinutes} / {sessionBudgetMinutes} mins allocated
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
              Automatically selects ready tasks ordered by priority and due date. Excludes <em>Waiting for client</em> and tasks with unresolved dependencies.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              Available time:
              <select
                value={sessionBudgetMinutes}
                onChange={(e) => setSessionBudgetMinutes(Number(e.target.value))}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value={60}>60 mins (1 hr)</option>
                <option value={90}>90 mins (1.5 hrs)</option>
                <option value={120}>120 mins (2 hrs — Default)</option>
                <option value={180}>180 mins (3 hrs)</option>
                <option value={240}>240 mins (4 hrs)</option>
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              Owner:
              <select
                value={sessionOwnerFilter}
                onChange={(e) => setSessionOwnerFilter(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value="all">All Studio Members</option>
                {uniqueOwners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
          {dailySessionPlan.selected.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-2, #f9fafb)', fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
              No ready tasks fit within the {sessionBudgetMinutes}-minute window (or all ready tasks are already completed).
            </div>
          ) : (
            dailySessionPlan.selected.map((task, idx) => (
              <div
                key={task.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--line, #e5e7eb)',
                  background: 'var(--surface-2, #f9fafb)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0f766e' }}>
                      #{idx + 1} • {task.estimatedMinutes}m • {task.priority.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary, #6b7280)' }}>
                      Due {task.dueDate || 'TBD'}
                    </span>
                  </div>
                  <strong style={{ fontSize: 13, display: 'block' }}>{task.title}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary, #6b7280)' }}>
                    {task.projectName} • {task.roomName || 'All Rooms'} • {task.owner}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => openProjectStage(task.projectId, task.stage, task.roomId)}
                    style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    Open {STAGE_META[task.stage].label} <ArrowRight size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleTaskStatusChange(task, 'Complete')}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#dcfce7', color: '#166534', cursor: 'pointer' }}
                  >
                    Mark Complete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {dailySessionPlan.missingEstimates.length > 0 && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} />
            <span>
              <strong>{dailySessionPlan.missingEstimates.length} ready task(s)</strong> are missing estimated minutes ({dailySessionPlan.missingEstimates.map((t) => t.title).slice(0, 2).join('; ')}). Add an estimate to include them in time-boxed session planning.
            </span>
          </div>
        )}
      </section>

      {/* Project & Room Selector + Direct Stage Shortcuts */}
      <section
        style={{
          padding: 18,
          borderRadius: 14,
          border: '1px solid var(--line, #e5e7eb)',
          background: 'var(--surface, #ffffff)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Filter size={16} style={{ color: 'var(--text-secondary, #6b7280)' }} />
            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              Project:
              <select
                value={activeProject?.projectId ?? ''}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setSelectedRoomId('all');
                  void loadPipelineData(e.target.value);
                }}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line, #d1d5db)', fontSize: 13, fontWeight: 600 }}
              >
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.projectName} {p.clientName ? `(${p.clientName})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              Room:
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value="all">All Rooms ({activeProject?.rooms.length ?? 0})</option>
                {(activeProject?.rooms ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.roomType})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              Stage:
              <select
                value={selectedStageFilter}
                onChange={(e) => setSelectedStageFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value="all">All Stages</option>
                {(Object.keys(STAGE_META) as PipelineStage[]).map((st) => (
                  <option key={st} value={st}>
                    {STAGE_META[st].label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              Status:
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value="all">All Statuses</option>
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #4b5563)' }}>
              Derived Progress: {completedTasks}/{totalTasks} ({progressPct}%)
            </span>
            <div style={{ width: 110, height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#0d9488' }} />
            </div>
          </div>
        </div>

        {/* Direct Links back to Brief, Rooms, 3D, Drawings, Estimate */}
        {activeProject && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--line, #f3f4f6)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #6b7280)' }}>
              Jump to Project Stage:
            </span>
            {(Object.keys(STAGE_META) as PipelineStage[]).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() =>
                  openProjectStage(
                    activeProject.projectId,
                    stage,
                    selectedRoomId !== 'all' ? selectedRoomId : null,
                  )
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 11px',
                  borderRadius: 8,
                  border: '1px solid var(--line, #e5e7eb)',
                  background: 'var(--surface-2, #f9fafb)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {STAGE_META[stage].label} <ArrowRight size={12} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Two-Column Main Workspace: Pipeline Tasks (Left) + Files, Revisions & Google Drive Links (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, alignItems: 'start' }}>
        {/* Column 1: Project Pipeline Tasks */}
        <section style={{ padding: 20, borderRadius: 14, border: '1px solid var(--line, #e5e7eb)', background: 'var(--surface, #ffffff)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Stage Deliverables & Tasks</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
                New tasks start as <strong>Pending</strong>. Track dependencies, assumptions, and missing site measurements.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #6b7280)' }}>
              Rev #{activeProject?.pipeline.version ?? 0}
            </span>
          </div>

          {/* Add Task Form */}
          <form onSubmit={(e) => void handleAddTask(e)} style={{ padding: 14, borderRadius: 10, background: 'var(--surface-2, #f9fafb)', border: '1px solid var(--line, #e5e7eb)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Pipeline Task (starts Pending)
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
              <input
                type="text"
                placeholder="Task title (e.g. Confirm kitchen hob & chimney ducting point)"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
              <select
                value={newTaskStage}
                onChange={(e) => setNewTaskStage(e.target.value as PipelineStage)}
                style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                {(Object.keys(STAGE_META) as PipelineStage[]).map((st) => (
                  <option key={st} value={st}>
                    {STAGE_META[st].label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <select
                value={newTaskRoomId}
                onChange={(e) => setNewTaskRoomId(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value="">All Rooms</option>
                {(activeProject?.rooms ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Owner"
                value={newTaskOwner}
                onChange={(e) => setNewTaskOwner(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as PipelineTaskPriority)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <input
                type="number"
                min={5}
                max={480}
                placeholder="Est. mins"
                value={newTaskMinutes}
                onChange={(e) => setNewTaskMinutes(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                type="text"
                placeholder="Next action required…"
                value={newTaskNextAction}
                onChange={(e) => setNewTaskNextAction(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                type="text"
                placeholder="Assumptions (e.g. 2700 mm ceiling, 18 mm BWP carcass)"
                value={newTaskAssumptions}
                onChange={(e) => setNewTaskAssumptions(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
              <input
                type="text"
                placeholder="Missing site info (e.g. Beam drop depth on north wall)"
                value={newTaskMissingInfo}
                onChange={(e) => setNewTaskMissingInfo(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <select
                value={newTaskDependencyId}
                onChange={(e) => setNewTaskDependencyId(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12, flex: 1 }}
              >
                <option value="">No blocking dependency</option>
                {(activeProject?.pipeline.tasks ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    Depends on: {t.title.slice(0, 55)}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={saving || !newTaskTitle.trim()}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Add Task
              </button>
            </div>
          </form>

          {/* Task List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredTasks.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary, #6b7280)' }}>
                No tasks match the current room/stage filter.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const stageInfo = STAGE_META[task.stage] ?? STAGE_META.spaces;
                return (
                  <article
                    key={task.id}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid var(--line, #e5e7eb)',
                      background: task.status === 'Complete' ? '#f8fafc' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#f3f4f6', color: stageInfo.color }}>
                            {stageInfo.label}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #6b7280)' }}>
                            {task.roomName || 'All Rooms'}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#4b5563' }}>
                            • {task.priority}
                          </span>
                          {task.estimatedMinutes ? (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary, #6b7280)' }}>• {task.estimatedMinutes}m</span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#b45309' }}>• Estimate missing</span>
                          )}
                        </div>
                        <strong style={{ fontSize: 14, color: 'var(--text, #111827)' }}>{task.title}</strong>
                      </div>

                      <select
                        value={task.status}
                        disabled={saving}
                        onChange={(e) => void handleTaskStatusChange(task, e.target.value as PipelineTaskStatus)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--line, #d1d5db)',
                          fontSize: 12,
                          fontWeight: 700,
                          background:
                            task.status === 'Complete' || task.status === 'Approved'
                              ? '#dcfce7'
                              : task.status === 'Waiting for client'
                                ? '#fef3c7'
                                : task.status === 'Revision needed'
                                  ? '#fee2e2'
                                  : '#f3f4f6',
                        }}
                      >
                        {ALL_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {task.nextAction && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary, #374151)' }}>
                        <strong>Next action:</strong> {task.nextAction}
                      </div>
                    )}
                    {task.assumptions && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #4b5563)' }}>
                        <strong>Assumptions:</strong> {task.assumptions}
                      </div>
                    )}
                    {task.missingInformation && (
                      <div style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', padding: '4px 8px', borderRadius: 6 }}>
                        <strong>Missing site info:</strong> {task.missingInformation}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary, #6b7280)', paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
                      <span>
                        Owner: <strong>{task.owner}</strong> • Due: {task.dueDate || 'Unscheduled'}
                        {task.approvedBy ? ` • Approved by ${task.approvedBy}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => openProjectStage(task.projectId, task.stage, task.roomId)}
                        style={{ fontSize: 11, fontWeight: 700, color: stageInfo.color, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        Open {stageInfo.label} <ArrowRight size={12} />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* Column 2: Files, Revision History & Google Drive Links (Sections 1, 3, 5) */}
        <section style={{ padding: 20, borderRadius: 14, border: '1px solid var(--line, #e5e7eb)', background: 'var(--surface, #ffffff)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Files, Revisions & Google Drive Links</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
              Store private studio uploads and external Google Drive / HTTPS links. Every revision is preserved separately so approved designs remain accessible alongside newer drafts.
            </p>
          </div>

          <form onSubmit={(e) => void handleAddFileOrLink(e)} style={{ padding: 14, borderRadius: 10, background: 'var(--surface-2, #f9fafb)', border: '1px solid var(--line, #e5e7eb)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <HardDrive size={14} /> Add Revision Record (File Upload or Drive Link)
              </strong>
              <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line, #d1d5db)' }}>
                <button
                  type="button"
                  onClick={() => setFileSourceType('external_drive_link')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: fileSourceType === 'external_drive_link' ? '#0f766e' : '#ffffff',
                    color: fileSourceType === 'external_drive_link' ? '#ffffff' : '#374151',
                  }}
                >
                  Google Drive / HTTPS Link
                </button>
                <button
                  type="button"
                  onClick={() => setFileSourceType('uploaded_file')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: fileSourceType === 'uploaded_file' ? '#0f766e' : '#ffffff',
                    color: fileSourceType === 'uploaded_file' ? '#ffffff' : '#374151',
                  }}
                >
                  Private Studio Upload
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 90px', gap: 8 }}>
              <input
                type="text"
                placeholder="Document title (e.g. Kitchen GFC Elevation & Cutlist Pack)"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                required
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
              <select
                value={fileCategory}
                onChange={(e) => setFileCategory(e.target.value as PipelineFileCategory)}
                style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                {FILE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="REV-1"
                value={fileRevision}
                onChange={(e) => setFileRevision(e.target.value)}
                required
                style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
            </div>

            {fileSourceType === 'external_drive_link' ? (
              <input
                type="url"
                placeholder="https://drive.google.com/drive/folders/... or https://docs.google.com/..."
                value={fileExternalUrl}
                onChange={(e) => setFileExternalUrl(e.target.value)}
                required
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
            ) : (
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(e) => setUploadingFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12 }}
              />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select
                value={fileRoomId}
                onChange={(e) => setFileRoomId(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              >
                <option value="">All Rooms / Project-wide</option>
                {(activeProject?.rooms ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Owner (e.g. Lead Designer)"
                value={fileOwner}
                onChange={(e) => setFileOwner(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                placeholder="Revision notes (e.g. Updated Merino laminate codes & 50 mm left filler)"
                value={fileNotes}
                onChange={(e) => setFileNotes(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line, #d1d5db)', fontSize: 12, flex: 1 }}
              />
              <button
                type="submit"
                disabled={saving || !fileTitle.trim()}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0284c7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Save Revision
              </button>
            </div>
          </form>

          {/* Files & Revisions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredFiles.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary, #6b7280)' }}>
                No project files or external Drive links recorded for this room filter yet.
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isDrive = file.sourceType === 'external_drive_link';
                const openHref = isDrive ? file.externalUrl : file.signedDownloadUrl;
                return (
                  <article
                    key={file.id}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid var(--line, #e5e7eb)',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 999,
                              background: isDrive ? '#eff6ff' : '#f0fdf4',
                              color: isDrive ? '#1d4ed8' : '#15803d',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {isDrive ? <Link2 size={11} /> : <Upload size={11} />}
                            {isDrive ? 'External Drive / HTTPS Link' : 'Uploaded Studio Asset'}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#f3f4f6', color: '#374151' }}>
                            {file.category}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#0f766e' }}>{file.revision}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary, #6b7280)' }}>
                            • {file.roomName || 'All Rooms'}
                          </span>
                        </div>
                        <strong style={{ fontSize: 14, color: 'var(--text, #111827)' }}>{file.title}</strong>
                      </div>

                      <select
                        value={file.approvalStatus}
                        disabled={saving}
                        onChange={(e) =>
                          void handleFileApprovalDecision(
                            file,
                            e.target.value as 'Draft' | 'Pending Review' | 'Approved' | 'Superseded',
                          )
                        }
                        style={{
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--line, #d1d5db)',
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            file.approvalStatus === 'Approved'
                              ? '#dcfce7'
                              : file.approvalStatus === 'Pending Review'
                                ? '#fef3c7'
                                : '#f3f4f6',
                        }}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pending Review">Pending Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Superseded">Superseded</option>
                      </select>
                    </div>

                    {file.notes && (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #4b5563)' }}>{file.notes}</p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary, #6b7280)', paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
                      <span>
                        Owner: <strong>{file.owner}</strong> • Saved {file.updatedAt.slice(0, 10)}
                        {file.approvedBy ? ` • Approved by ${file.approvedBy}` : ''}
                      </span>
                      {openHref ? (
                        <a
                          href={openHref}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#0284c7', textDecoration: 'none' }}
                        >
                          {isDrive ? 'Open External Link' : 'Download Signed File'} <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>No link available</span>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

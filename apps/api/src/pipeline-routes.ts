import type { Express, Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireProjectUser, requireStudioUser, type AuthenticatedRequest } from './api-auth.js';

export const PipelineTaskStatusSchema = z.enum([
  'Pending',
  'In progress',
  'Waiting for client',
  'Revision needed',
  'Approved',
  'Complete',
]);

export const PipelineStageSchema = z.enum([
  'brief',
  'plan',
  'spaces',
  '3d',
  'drawings',
  'estimate',
]);

export const PipelineTaskPrioritySchema = z.enum(['high', 'medium', 'low']);

export const PipelineTaskSchema = z.object({
  id: z.string().min(1).max(120),
  projectId: z.string().min(1).max(120),
  roomId: z.string().max(120).nullable().optional(),
  roomName: z.string().max(140).nullable().optional(),
  title: z.string().min(1).max(240),
  stage: PipelineStageSchema,
  status: PipelineTaskStatusSchema.default('Pending'),
  owner: z.string().min(1).max(140),
  nextAction: z.string().max(400).default(''),
  dependencies: z.array(z.string().max(120)).max(24).default([]),
  assumptions: z.string().max(600).default(''),
  missingInformation: z.string().max(600).default(''),
  priority: PipelineTaskPrioritySchema.default('medium'),
  estimatedMinutes: z.number().int().min(0).max(2400).nullable().optional(),
  dueDate: z.string().max(40).nullable().optional(),
  completedAt: z.string().max(40).nullable().optional(),
  approvedBy: z.string().max(140).nullable().optional(),
  approvedAt: z.string().max(40).nullable().optional(),
  decisionNotes: z.string().max(600).default(''),
  updatedAt: z.string().max(40),
});

export const PipelineFileItemSchema = z.object({
  id: z.string().min(1).max(120),
  projectId: z.string().min(1).max(120),
  roomId: z.string().max(120).nullable().optional(),
  roomName: z.string().max(140).nullable().optional(),
  title: z.string().min(1).max(240),
  category: z.enum([
    'Floor Plan',
    'Site Survey',
    '3D Render',
    'Working Drawing',
    'Cutlist / BOQ',
    'Client Approval',
    'Reference / Moodboard',
  ]),
  revision: z.string().min(1).max(40).default('REV-1'),
  sourceType: z.enum(['uploaded_file', 'external_drive_link']),
  externalUrl: z.string().url().max(1000).nullable().optional(),
  assetId: z.string().max(120).nullable().optional(),
  storagePath: z.string().max(500).nullable().optional(),
  mimeType: z.string().max(120).nullable().optional(),
  owner: z.string().min(1).max(140),
  notes: z.string().max(1000).default(''),
  approvalStatus: z.enum(['Draft', 'Pending Review', 'Approved', 'Superseded']).default('Draft'),
  approvedBy: z.string().max(140).nullable().optional(),
  approvedAt: z.string().max(40).nullable().optional(),
  decisionNotes: z.string().max(600).default(''),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
});

export type PipelineTask = z.infer<typeof PipelineTaskSchema>;
export type PipelineFileItem = z.infer<typeof PipelineFileItemSchema>;

export type ProjectPipelineDocument = {
  version: number;
  updatedAt: string;
  tasks: PipelineTask[];
  files: PipelineFileItem[];
};

const SaveProjectPipelineSchema = z.object({
  expectedVersion: z.number().int().min(0).optional(),
  tasks: z.array(PipelineTaskSchema).max(300),
  files: z.array(PipelineFileItemSchema).max(300),
});

export function buildDefaultPipelineTasks(
  projectId: string,
  projectName: string,
  assignedDesigner: string,
  spaces: Array<{ id: string; name?: string | null; room_type?: string | null }>,
): PipelineTask[] {
  const now = new Date().toISOString();
  const owner = assignedDesigner?.trim() || 'Lead Designer';
  const baseTasks: PipelineTask[] = [
    {
      id: `${projectId}-task-brief`,
      projectId,
      roomId: null,
      roomName: 'All Rooms',
      title: `Confirm client brief, budget ceiling & site ceiling datum (${projectName})`,
      stage: 'brief',
      status: 'Pending',
      owner,
      nextAction: 'Verify site ceiling height (default 2700 mm unless overridden) and room scope with client.',
      dependencies: [],
      assumptions: '2700 mm standard ceiling height until site laser measurement is uploaded.',
      missingInformation: 'Signed client scope confirmation and electrical/plumbing service points.',
      priority: 'high',
      estimatedMinutes: 30,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      completedAt: null,
      approvedBy: null,
      approvedAt: null,
      decisionNotes: '',
      updatedAt: now,
    },
    {
      id: `${projectId}-task-plan`,
      projectId,
      roomId: null,
      roomName: 'Floor Plan',
      title: 'Calibrate floor plan scale & verify wall openings',
      stage: 'plan',
      status: 'Pending',
      owner,
      nextAction: 'Confirm 2-point reference dimension in millimetres and inspect doors/windows.',
      dependencies: [`${projectId}-task-brief`],
      assumptions: 'Internal partitions 115 mm / external walls 230 mm where unmeasured.',
      missingInformation: 'Site beam drop depths and window sill heights.',
      priority: 'high',
      estimatedMinutes: 45,
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      completedAt: null,
      approvedBy: null,
      approvedAt: null,
      decisionNotes: '',
      updatedAt: now,
    },
  ];

  for (const space of spaces.slice(0, 6)) {
    const rName = space.name || space.room_type || 'Room';
    baseTasks.push({
      id: `${projectId}-task-spaces-${space.id}`,
      projectId,
      roomId: space.id,
      roomName: rName,
      title: `Place modular cabinetry & verify scribing fillers in ${rName}`,
      stage: 'spaces',
      status: 'Pending',
      owner,
      nextAction: `Select catalog modules for ${rName}, check 50 mm fillers, and save room layout.`,
      dependencies: [`${projectId}-task-plan`],
      assumptions: '18 mm BWP/HDHMR carcass, 100 mm skirting, 20 mm top dummy.',
      missingInformation: '',
      priority: 'medium',
      estimatedMinutes: 40,
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      completedAt: null,
      approvedBy: null,
      approvedAt: null,
      decisionNotes: '',
      updatedAt: now,
    });
  }

  baseTasks.push(
    {
      id: `${projectId}-task-3d`,
      projectId,
      roomId: null,
      roomName: 'All Rooms',
      title: 'Compile 3D scene & review material laminate assignments',
      stage: '3d',
      status: 'Pending',
      owner,
      nextAction: 'Compile approved room layouts into scene.v1 and verify shutter/carcass laminates.',
      dependencies: [`${projectId}-task-plan`],
      assumptions: 'Front elevations show finished shutters; no exposed raw carcass edges.',
      missingInformation: 'Client finish code sign-off.',
      priority: 'medium',
      estimatedMinutes: 35,
      dueDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
      completedAt: null,
      approvedBy: null,
      approvedAt: null,
      decisionNotes: '',
      updatedAt: now,
    },
    {
      id: `${projectId}-task-drawings`,
      projectId,
      roomId: null,
      roomName: 'Factory Production',
      title: 'Generate W06 panel schedule, edge-band deductions & beam-saw exports',
      stage: 'drawings',
      status: 'Pending',
      owner,
      nextAction: 'Verify cutlist grain lock and export Homag .ptx / Biesse .xml after layout approval.',
      dependencies: [`${projectId}-task-3d`],
      assumptions: '2.0 mm PVC edge-band on shutters, 0.8 mm on carcass edges.',
      missingInformation: '',
      priority: 'low',
      estimatedMinutes: 30,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      completedAt: null,
      approvedBy: null,
      approvedAt: null,
      decisionNotes: '',
      updatedAt: now,
    },
  );

  return baseTasks;
}

export function normalizePipelineDocument(
  raw: unknown,
  projectId: string,
  projectName: string,
  assignedDesigner: string,
  spaces: Array<{ id: string; name?: string | null; room_type?: string | null }>,
): ProjectPipelineDocument {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawPipeline = obj.pipeline && typeof obj.pipeline === 'object' ? (obj.pipeline as Record<string, unknown>) : obj;
  const version = typeof rawPipeline.version === 'number' && Number.isInteger(rawPipeline.version) && rawPipeline.version >= 0
    ? rawPipeline.version
    : 0;
  const updatedAt = typeof rawPipeline.updatedAt === 'string' && rawPipeline.updatedAt
    ? rawPipeline.updatedAt
    : new Date().toISOString();

  const parsedTasks = Array.isArray(rawPipeline.tasks)
    ? rawPipeline.tasks
        .map((t) => PipelineTaskSchema.safeParse(t))
        .filter((r): r is { success: true; data: PipelineTask } => r.success)
        .map((r) => r.data)
    : [];

  const parsedFiles = Array.isArray(rawPipeline.files)
    ? rawPipeline.files
        .map((f) => PipelineFileItemSchema.safeParse(f))
        .filter((r): r is { success: true; data: PipelineFileItem } => r.success)
        .map((r) => r.data)
    : [];

  const tasks = parsedTasks.length > 0
    ? parsedTasks
    : buildDefaultPipelineTasks(projectId, projectName, assignedDesigner, spaces);

  return {
    version,
    updatedAt,
    tasks,
    files: parsedFiles,
  };
}

export function registerPipelineRoutes(app: Express, getClient: (request: Request) => SupabaseClient) {
  // Studio-wide pipeline & daily session planner across all active organization projects
  app.get('/api/studio/pipeline', requireStudioUser, async (request, response) => {
    const authReq = request as AuthenticatedRequest;
    const client = getClient(request);
    const orgId = authReq.ultidaUser!.organizationId;

    const projectsRes = await client
      .from('projects')
      .select('id,name,client_name,workflow_stage,project_status,assigned_designer,delivery_records,updated_at')
      .eq('organization_id', orgId)
      .neq('project_status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (projectsRes.error) {
      return response.status(500).json({
        success: false,
        code: 'STUDIO_PIPELINE_LOAD_FAILED',
        message: projectsRes.error.message,
      });
    }

    const projects = projectsRes.data ?? [];
    const projectIds = projects.map((p: any) => String(p.id));
    const spacesRes = projectIds.length
      ? await client.from('spaces').select('id,project_id,name,room_type,ceiling_height_mm,status').in('project_id', projectIds)
      : { data: [], error: null };

    const spacesByProject = new Map<string, Array<{ id: string; name?: string | null; room_type?: string | null }>>();
    for (const sp of spacesRes.data ?? []) {
      const pid = String((sp as any).project_id);
      if (!spacesByProject.has(pid)) spacesByProject.set(pid, []);
      spacesByProject.get(pid)!.push(sp as any);
    }

    const summaries = projects.map((proj: any) => {
      const pid = String(proj.id);
      const spaces = spacesByProject.get(pid) ?? [];
      const doc = normalizePipelineDocument(
        proj.delivery_records,
        pid,
        String(proj.name || 'Untitled Project'),
        String(proj.assigned_designer || ''),
        spaces,
      );
      return {
        projectId: pid,
        projectName: String(proj.name || 'Untitled Project'),
        clientName: String(proj.client_name || ''),
        workflowStage: String(proj.workflow_stage || 'brief'),
        assignedDesigner: String(proj.assigned_designer || 'Lead Designer'),
        rooms: spaces.map((s) => ({ id: s.id, name: s.name || s.room_type || 'Room', roomType: s.room_type || 'living' })),
        pipeline: doc,
      };
    });

    return response.json({
      success: true,
      projects: summaries,
      note: 'Pipeline records track studio tasks, revisions, and links. Saving pipeline items never silently approves geometry or production.',
    });
  });

  // Single-project pipeline, rooms, reference files, and revision history
  app.get('/api/projects/:projectId/pipeline', requireProjectUser, async (request, response) => {
    const projectId = String(request.params.projectId);
    const client = getClient(request);

    const projRes = await client
      .from('projects')
      .select('id,name,client_name,workflow_stage,project_status,assigned_designer,delivery_records,updated_at')
      .eq('id', projectId)
      .maybeSingle();

    if (projRes.error || !projRes.data) {
      return response.status(projRes.error ? 500 : 404).json({
        success: false,
        code: 'PROJECT_PIPELINE_NOT_FOUND',
        message: projRes.error?.message ?? 'Project not found.',
      });
    }

    const [spacesRes, scenesRes, plansRes] = await Promise.all([
      client.from('spaces').select('id,name,room_type,ceiling_height_mm,status').eq('project_id', projectId),
      client.from('scene_versions').select('id,version_number,status,created_at,change_reason').eq('project_id', projectId).order('version_number', { ascending: false }).limit(10),
      client.from('floor_plan_versions').select('id,version_number,status,review_status,approved_at,created_at').eq('project_id', projectId).order('version_number', { ascending: false }).limit(10),
    ]);

    const spaces = (spacesRes.data ?? []) as Array<{ id: string; name?: string | null; room_type?: string | null; ceiling_height_mm?: number | null; status?: string | null }>;
    const doc = normalizePipelineDocument(
      projRes.data.delivery_records,
      projectId,
      String(projRes.data.name || 'Untitled Project'),
      String(projRes.data.assigned_designer || ''),
      spaces,
    );

    // Attach signed download URLs for any uploaded studio assets referenced by pipeline files
    const filesWithUrls = await Promise.all(
      doc.files.map(async (file) => {
        if (file.sourceType === 'uploaded_file' && file.storagePath) {
          const signed = await client.storage.from('project-assets').createSignedUrl(file.storagePath, 3600);
          return { ...file, signedDownloadUrl: signed.data?.signedUrl ?? null };
        }
        return { ...file, signedDownloadUrl: null };
      }),
    );

    return response.json({
      success: true,
      project: {
        id: String(projRes.data.id),
        name: String(projRes.data.name || 'Untitled Project'),
        clientName: String(projRes.data.client_name || ''),
        workflowStage: String(projRes.data.workflow_stage || 'brief'),
        assignedDesigner: String(projRes.data.assigned_designer || 'Lead Designer'),
      },
      rooms: spaces.map((s) => ({
        id: s.id,
        name: s.name || s.room_type || 'Room',
        roomType: s.room_type || 'living',
        ceilingHeightMm: s.ceiling_height_mm ?? 2700,
        status: s.status ?? 'pending',
      })),
      planVersions: plansRes.data ?? [],
      sceneVersions: scenesRes.data ?? [],
      pipeline: {
        ...doc,
        files: filesWithUrls,
      },
      authorityGuarantee: 'Saving tasks, files, or external Drive links never automatically approves floor plans, layouts, 3D scenes, or production cutlists.',
    });
  });

  // Optimistic-concurrency save for project pipeline tasks & file/link revisions
  app.put('/api/projects/:projectId/pipeline', requireProjectUser, async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = SaveProjectPipelineSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return response.status(422).json({
        success: false,
        code: 'INVALID_PIPELINE_PAYLOAD',
        message: 'Check task fields, status values, and valid HTTPS URLs for external links.',
        issues: parsed.error.issues,
      });
    }

    const client = getClient(request);
    const projRes = await client
      .from('projects')
      .select('id,name,assigned_designer,delivery_records')
      .eq('id', projectId)
      .maybeSingle();

    if (projRes.error || !projRes.data) {
      return response.status(projRes.error ? 500 : 404).json({
        success: false,
        code: 'PROJECT_NOT_FOUND',
        message: projRes.error?.message ?? 'Project could not be loaded.',
      });
    }

    const existingRecords = projRes.data.delivery_records && typeof projRes.data.delivery_records === 'object'
      ? (projRes.data.delivery_records as Record<string, unknown>)
      : {};
    const existingPipeline = normalizePipelineDocument(
      existingRecords,
      projectId,
      String(projRes.data.name || 'Untitled Project'),
      String(projRes.data.assigned_designer || ''),
      [],
    );

    if (
      typeof parsed.data.expectedVersion === 'number' &&
      existingPipeline.version > 0 &&
      parsed.data.expectedVersion !== existingPipeline.version
    ) {
      return response.status(409).json({
        success: false,
        code: 'PIPELINE_VERSION_CONFLICT',
        message: 'Another studio member updated this pipeline first. Reload the latest tasks and revisions before saving.',
        currentVersion: existingPipeline.version,
      });
    }

    // Validate external links are strictly HTTPS
    for (const file of parsed.data.files) {
      if (file.sourceType === 'external_drive_link') {
        if (!file.externalUrl || !/^https:\/\//i.test(file.externalUrl)) {
          return response.status(422).json({
            success: false,
            code: 'EXTERNAL_LINK_HTTPS_REQUIRED',
            message: `File "${file.title}" requires a valid https:// link.`,
          });
        }
      }
    }

    const nextVersion = existingPipeline.version + 1;
    const now = new Date().toISOString();
    const updatedPipeline: ProjectPipelineDocument = {
      version: nextVersion,
      updatedAt: now,
      tasks: parsed.data.tasks.map((t) => ({ ...t, projectId })),
      files: parsed.data.files.map((f) => ({ ...f, projectId })),
    };

    const nextDeliveryRecords = {
      ...existingRecords,
      pipeline: updatedPipeline,
    };

    const updateRes = await client
      .from('projects')
      .update({
        delivery_records: nextDeliveryRecords,
        updated_at: now,
      })
      .eq('id', projectId)
      .select('id,updated_at')
      .single();

    if (updateRes.error) {
      return response.status(500).json({
        success: false,
        code: 'PIPELINE_SAVE_FAILED',
        message: updateRes.error.message,
      });
    }

    return response.json({
      success: true,
      pipeline: updatedPipeline,
      authorityGuarantee: 'Pipeline saved. Geometry, layout, 3D scene, and manufacturing approvals remain untouched.',
    });
  });
}

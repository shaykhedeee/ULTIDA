import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultPipelineTasks,
  normalizePipelineDocument,
  PipelineTaskSchema,
  PipelineFileItemSchema,
} from '../src/pipeline-routes.js';
import { validateServerEnvironment } from '../src/env-config.js';

test('buildDefaultPipelineTasks creates Pending tasks and reuses room identifiers', () => {
  const tasks = buildDefaultPipelineTasks('proj-101', '2BHK Indiranagar', 'Aarav', [
    { id: 'room-kitchen-1', name: 'Modular Kitchen', room_type: 'kitchen' },
    { id: 'room-bed-1', name: 'Master Bedroom', room_type: 'master_bedroom' },
  ]);

  assert.ok(tasks.length >= 5);
  for (const task of tasks) {
    const parsed = PipelineTaskSchema.safeParse(task);
    assert.equal(parsed.success, true);
    assert.equal(task.status, 'Pending');
    assert.equal(task.projectId, 'proj-101');
  }
  const kitchenTask = tasks.find((t) => t.roomId === 'room-kitchen-1');
  assert.ok(kitchenTask);
  assert.equal(kitchenTask.stage, 'spaces');
  assert.equal(kitchenTask.roomName, 'Modular Kitchen');
});

test('normalizePipelineDocument preserves stored revisions and version counter', () => {
  const now = new Date().toISOString();
  const raw = {
    pipeline: {
      version: 3,
      updatedAt: now,
      tasks: [
        {
          id: 't-1',
          projectId: 'proj-101',
          roomId: 'room-1',
          roomName: 'Kitchen',
          title: 'Verify site beam drop',
          stage: 'plan',
          status: 'In progress',
          owner: 'Lead Designer',
          nextAction: 'Measure beamsoffit',
          dependencies: [],
          assumptions: '2700 mm ceiling',
          missingInformation: 'Beam height',
          priority: 'high',
          estimatedMinutes: 40,
          dueDate: '2026-11-15',
          completedAt: null,
          approvedBy: null,
          approvedAt: null,
          decisionNotes: '',
          updatedAt: now,
        },
      ],
      files: [
        {
          id: 'f-1',
          projectId: 'proj-101',
          roomId: 'room-1',
          roomName: 'Kitchen',
          title: 'Kitchen Elevation Pack',
          category: 'Working Drawing',
          revision: 'REV-1',
          sourceType: 'external_drive_link',
          externalUrl: 'https://drive.google.com/drive/folders/example123',
          owner: 'Lead Designer',
          notes: 'Approved client elevation',
          approvalStatus: 'Approved',
          approvedBy: 'Lead Designer',
          approvedAt: now,
          decisionNotes: 'Client signed off',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'f-2',
          projectId: 'proj-101',
          roomId: 'room-1',
          roomName: 'Kitchen',
          title: 'Kitchen Elevation Pack',
          category: 'Working Drawing',
          revision: 'REV-2',
          sourceType: 'external_drive_link',
          externalUrl: 'https://drive.google.com/drive/folders/example456',
          owner: 'Lead Designer',
          notes: 'Draft with updated 50mm filler',
          approvalStatus: 'Draft',
          approvedBy: null,
          approvedAt: null,
          decisionNotes: '',
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };

  const doc = normalizePipelineDocument(raw, 'proj-101', '2BHK Indiranagar', 'Lead Designer', []);
  assert.equal(doc.version, 3);
  assert.equal(doc.tasks.length, 1);
  assert.equal(doc.files.length, 2);
  assert.equal(doc.files[0]?.approvalStatus, 'Approved');
  assert.equal(doc.files[1]?.approvalStatus, 'Draft');
  assert.equal(PipelineFileItemSchema.safeParse(doc.files[0]).success, true);
});

test('validateServerEnvironment accepts both COMFYUI_BASE_URL and COMFYUI_URL', () => {
  const prevBase = process.env.COMFYUI_BASE_URL;
  const prevUrl = process.env.COMFYUI_URL;
  try {
    delete process.env.COMFYUI_BASE_URL;
    process.env.COMFYUI_URL = 'http://127.0.0.1:8188';
    assert.equal(validateServerEnvironment().comfyUiUrlConfigured, true);

    delete process.env.COMFYUI_URL;
    process.env.COMFYUI_BASE_URL = 'http://127.0.0.1:8188';
    assert.equal(validateServerEnvironment().comfyUiUrlConfigured, true);
  } finally {
    if (prevBase === undefined) delete process.env.COMFYUI_BASE_URL;
    else process.env.COMFYUI_BASE_URL = prevBase;
    if (prevUrl === undefined) delete process.env.COMFYUI_URL;
    else process.env.COMFYUI_URL = prevUrl;
  }
});

test('two editors retain the approved file and cannot overwrite a competing room revision', async () => {
  const { registerPipelineRoutes } = await import('../src/pipeline-routes.js');
  const now = '2026-11-27T10:00:00.000Z';
  const previous = {
    id: 'approved', projectId: 'project', roomId: 'kitchen', title: 'Elevation',
    category: 'Working Drawing', approvalStatus: 'Approved', sourceType: 'external_drive_link',
    externalUrl: 'https://example.com/approved.pdf', owner: 'Designer', createdAt: now, updatedAt: now,
  };
  let project = { id: 'project', name: 'Test project', assigned_designer: 'Designer', updated_at: now,
    delivery_records: { pipeline: { version: 0, tasks: [], files: [previous] } } };
  const handlers = new Map<string, (...args: any[]) => Promise<unknown>>();
  const app = { get() {}, put(path: string, _auth: unknown, handler: (...args: any[]) => Promise<unknown>) { handlers.set(path, handler); } };
  registerPipelineRoutes(app as never, (() => ({
    from(table: string) {
      const filters = new Map<string, unknown>();
      let patch: typeof project | undefined;
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { filters.set(column, value); return query; },
        update(value: typeof project) { patch = value; return query; },
        async maybeSingle() {
          if (table === 'spaces') return { data: { id: filters.get('id'), name: filters.get('id') } };
          if (table === 'project_assets') return { data: { id: filters.get('id'), storage_path: 'private/revised.pdf', mime_type: 'application/pdf' } };
          if (patch) {
            if (filters.get('updated_at') !== project.updated_at) return { data: null };
            project = { ...project, ...patch };
          }
          return { data: structuredClone(project) };
        },
      };
      return query;
    },
  })) as never);
  const save = async (editor: string, roomId: string, parentId?: string, expectedVersion = 0) => {
    const request = { params: { projectId: 'project' }, ultidaUser: { id: editor },
      body: { expectedVersion, tasks: [], files: [previous, {
        ...previous, id: editor, roomId, title: 'Renamed elevation', sourceType: 'uploaded_file',
        approvalStatus: 'Draft', assetId: editor, parentId, round: 'R02', notes: 'Align lofts',
        originalName: 'revised.pdf', nextAction: 'Review loft clearance',
      }] } };
    let status = 200;
    let body: any;
    const response = { status(value: number) { status = value; return response; }, json(value: unknown) { body = value; } };
    await handlers.get('/api/projects/:projectId/pipeline')!(request, response);
    return { status, body };
  };
  assert.equal((await save('wrong-room', 'bedroom', 'approved')).status, 422);
  const [first, second] = await Promise.all([save('editor-one', 'kitchen', 'approved'), save('editor-two', 'bedroom')]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  const files = project.delivery_records.pipeline.files as Array<Record<string, unknown>>;
  assert.equal(files.length, 2);
  const original = files.find(file => file.id === 'approved')!;
  assert.equal(original.approvalStatus, 'Approved');
  assert.equal(original.externalUrl, previous.externalUrl);
  const revision = files.find(file => file.id !== 'approved')!;
  assert.equal(revision.nextAction, 'Review loft clearance');
  if (revision.roomId === 'kitchen') {
    assert.equal(revision.familyId, original.familyId);
    assert.equal(revision.sequence, 2);
  }
});

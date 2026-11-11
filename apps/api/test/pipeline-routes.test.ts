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

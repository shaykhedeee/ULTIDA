import { getApiBase } from '../../lib/api-base';
import type { ProjectPipeline } from './PipelineWorkspace';

export async function loadProjectProgress(projectId: string, headers: Record<string, string>): Promise<ProjectPipeline> {
  const response = await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/pipeline`, { headers });
  if (!response.ok) throw new Error('Project Progress could not be loaded.');
  const { pipeline } = await response.json();
  return pipeline;
}

export async function saveProjectProgress(projectId: string, pipeline: ProjectPipeline, headers: Record<string, string>): Promise<ProjectPipeline> {
  const response = await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/pipeline`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ expectedVersion: pipeline.version, tasks: pipeline.tasks, files: pipeline.files }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `Project Progress could not be saved (${response.status}).`);
  }
  return data.pipeline;
}

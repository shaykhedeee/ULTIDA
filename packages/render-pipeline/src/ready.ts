/**
 * render-pipeline — deterministic render readiness.
 *
 * Built purely from persisted facts. Rendering is BLOCKED until every gate below
 * is satisfied. Ling (orchestration) never guesses readiness; it is computed.
 */

import { RenderReadinessSchema } from './schema.js';
import type { RenderReadiness } from './schema.js';

export interface PersistedRenderContext {
  scaleVerified: boolean;
  /** Initial design may render as a labelled concept; production remains strict. */
  geometryMode?: 'initial_design' | 'final_production';
  renderPurpose?: 'concept' | 'production';
  planApproved: boolean;
  designApproved: boolean; // scene/layout approved by the designer
  sceneVersion: {
    id: string;
    status: string;
    updatedAt: string; // ISO
    approvedVersionId?: string | null; // the latest approved scene version id
  };
  modulesValid: boolean; // every module placed, dimensions resolved, no dangling refs
  materialsComplete: boolean; // every room has selected materials
  cameraValid: boolean; // a camera exists and its params are valid
  blockingIssues: string[]; // unresolved geometry/design issues (codes)
  referenceImageUrl?: string; // for UI; not used in gating
}

export const BLOCKING_CONDITIONS = [
  'SCALE_UNVERIFIED',
  'PLAN_UNAPPROVED',
  'DESIGN_UNAPPROVED',
  'SCENE_STALE',
  'MODULES_INVALID',
  'MATERIALS_INCOMPLETE',
  'CAMERA_INVALID',
  'BLOCKING_ISSUES',
] as const;

export type BlockingCondition = (typeof BLOCKING_CONDITIONS)[number];

export interface ReadinessIssue {
  code: string;
  severity: 'blocking' | 'warning';
  message: string;
  entityIds: string[];
}

/**
 * Evaluate whether a render may proceed from persisted data.
 * Staleness rule: a scene is stale if its updatedAt is after the approval
 * timestamp of the active approved version, or if the requested sceneVersion.id
 * differs from the approved version id.
 */
export function buildRenderReadiness(ctx: PersistedRenderContext): RenderReadiness {
  const issues: ReadinessIssue[] = [];

  if (!ctx.scaleVerified) {
    const conceptPreview = ctx.geometryMode === 'initial_design' && ctx.renderPurpose !== 'production';
    issues.push({
      code: conceptPreview ? 'INITIAL_GEOMETRY' : 'SCALE_UNVERIFIED',
      severity: conceptPreview ? 'warning' : 'blocking',
      message: conceptPreview
        ? 'This render uses initial-design geometry. Verify dimensions on site before using it for production.'
        : 'Floor-plan scale is not verified. Calibrate or confirm a verified dimension before rendering.',
      entityIds: [],
    });
  }
  if (!ctx.planApproved) {
    issues.push({ code: 'PLAN_UNAPPROVED', severity: 'blocking', message: 'The floor plan is not approved.', entityIds: [] });
  }
  if (!ctx.designApproved) {
    issues.push({ code: 'DESIGN_UNAPPROVED', severity: 'blocking', message: 'The design (scene/layout) is not approved.', entityIds: [] });
  }

  const approvedId = ctx.sceneVersion.approvedVersionId;
  const isApprovedVersion = approvedId == null || ctx.sceneVersion.id === approvedId;
  const approvedAt = approvedId ? ctx.sceneVersion.updatedAt : null;
  const stale = !isApprovedVersion || (approvedAt != null && ctx.sceneVersion.updatedAt > approvedAt);
  if (stale) {
    issues.push({ code: 'SCENE_STALE', severity: 'blocking', message: 'The scene version is stale (edited after approval or superseded by a newer version).', entityIds: [ctx.sceneVersion.id] });
  }

  if (!ctx.modulesValid) {
    issues.push({ code: 'MODULES_INVALID', severity: 'blocking', message: 'One or more modules are invalid (unplaced, unresolved dimensions, or dangling references).', entityIds: [] });
  }
  if (!ctx.materialsComplete) {
    issues.push({ code: 'MATERIALS_INCOMPLETE', severity: 'blocking', message: 'Not every room has completed material selections.', entityIds: [] });
  }
  if (!ctx.cameraValid) {
    issues.push({ code: 'CAMERA_INVALID', severity: 'blocking', message: 'The camera is missing or invalid (position/target/fov out of range).', entityIds: [] });
  }
  if (ctx.blockingIssues.length > 0) {
    issues.push({ code: 'BLOCKING_ISSUES', severity: 'blocking', message: `Unresolved blocking issues remain: ${ctx.blockingIssues.join(', ')}.`, entityIds: ctx.blockingIssues });
  }

  const blockingCount = issues.filter((i) => i.severity === 'blocking').length;
  const readiness: RenderReadiness = {
    ready: blockingCount === 0,
    blockingCount,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    issues,
  };
  return RenderReadinessSchema.parse(readiness);
}

export function isRenderBlocked(readiness: RenderReadiness): boolean {
  return readiness.ready === false;
}

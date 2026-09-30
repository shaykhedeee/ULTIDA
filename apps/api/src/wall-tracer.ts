import type { FastTraceResult } from './fast-wall-tracer.js';
import type { CvTraceResult } from './plan/reconcile_plan.js';

export { tracePlanBuffer, type FastTraceResult, type FastWall, type FastCorner, type FastRoom } from './fast-wall-tracer.js';

/** Convert native tracer output to the shared review/reconciliation contract. */
export function toCvTraceResult(trace: FastTraceResult): CvTraceResult {
  return {
    schema: 'PlanAnalysisResultV1.wallCandidates',
    sourceImageSize: { widthPx: trace.widthPx, heightPx: trace.heightPx },
    corners: trace.corners,
    walls: trace.walls.map((wall) => ({
      id: wall.id,
      startCornerId: wall.startCornerId ?? null,
      endCornerId: wall.endCornerId ?? null,
      x1: wall.x1,
      y1: wall.y1,
      x2: wall.x2,
      y2: wall.y2,
      thicknessPx: wall.thicknessPx ?? null,
      lengthPx: wall.lengthPx,
      confidence: wall.confidence,
    })),
    openings: (trace.openings ?? []).flatMap((opening) => opening.betweenWallIds ? [{
      betweenWallIds: opening.betweenWallIds,
      approxCenterPx: opening.approxCenterPx,
      approxWidthPx: opening.approxWidthPx,
      kindHint: opening.kindHint,
      confidence: opening.confidence,
      note: opening.note,
    }] : []),
    rooms: trace.rooms.map((room) => ({
      id: room.id,
      label: room.label,
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      polygon: room.polygon,
      confidence: room.confidence,
    })),
  };
}


/**
 * apps/api/src/plan/reconcile_plan.ts
 *
 * Merges two independent analyses of the same floor plan image:
 *
 *   1. CV pass (wall_tracer.py) -- precise pixel geometry: wall centerlines,
 *      thickness, corners. No idea what a "kitchen" is.
 *   2. Vision-LLM pass (existing OpenAI/Cloudflare vision call) -- semantic
 *      labels: room names, door/window locations, dimension text via OCR.
 *      Approximate geometry, real understanding of meaning.
 *
 * Neither is trustworthy alone. The CV pass has no semantics; the vision
 * pass has no measurement discipline. This reconciler produces ONE
 * candidate structure a human reviews, per ARCHITECTURE.md invariant #4 --
 * it never auto-approves anything.
 *
 * WIRE THIS IN: call after both wall_tracer.py and the existing vision
 * call finish for the same asset, before writing to floor_plan_versions.
 */

export interface CvWallCandidate {
  id: string;
  startCornerId: string | null;
  endCornerId: string | null;
  x1: number; y1: number; x2: number; y2: number;
  thicknessPx: number | null;
  lengthPx: number;
  confidence: number;
}

export interface CvTraceResult {
  schema: 'PlanAnalysisResultV1.wallCandidates';
  sourceImageSize: { widthPx: number; heightPx: number };
  corners: Array<{ id: string; x: number; y: number; refs: number }>;
  walls: CvWallCandidate[];
}

/** Shape of whatever your existing vision-LLM call already returns --
 *  adjust field names to match your actual OpenAI/Cloudflare vision
 *  response schema, this is the expected minimum shape. */
export interface VisionSemanticResult {
  walls: Array<{
    approxStartPx: { x: number; y: number };
    approxEndPx: { x: number; y: number };
    confidence: number;
    evidence?: string;
  }>;
  rooms: Array<{
    label: string;
    roomType: string;
    /** Rough polygon in the SAME pixel space as the CV pass -- if your
     *  vision call returns normalized 0-1 coords, convert before calling
     *  reconcile(). */
    approxPolygonPx: Array<{ x: number; y: number }>;
    confidence: number;
  }>;
  openings: Array<{
    kind: 'door' | 'window';
    approxCenterPx: { x: number; y: number };
    approxWidthPx: number;
    confidence: number;
  }>;
  dimensionTextFindings: Array<{
    text: string;
    approxPositionPx: { x: number; y: number };
    parsedMm: number | null;
  }>;
}

export interface ReconciledWall {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
  thicknessPx: number | null;
  lengthPx: number;
  /** True only if BOTH passes agree a wall exists here -- this is the
   *  highest-trust case and should surface with the least review friction. */
  confirmedByBothPasses: boolean;
  geometryConfidence: number;
  hasNearbyOpening: boolean;
}

export interface ReconciledRoom {
  label: string;
  roomType: string;
  /** Room boundary derived from the CV wall graph, NOT the vision model's
   *  rough polygon -- geometry always wins for shape/position, semantics
   *  always wins for meaning. */
  boundaryWallIds: string[];
  semanticConfidence: number;
}

export interface ReconciledPlanCandidate {
  schema: 'CanonicalPlanV1.candidate';
  sourceImageSize: { widthPx: number; heightPx: number };
  walls: ReconciledWall[];
  rooms: ReconciledRoom[];
  openings: VisionSemanticResult['openings'];
  dimensionHints: VisionSemanticResult['dimensionTextFindings'];
  reviewFlags: string[];
  requiresDesignerReview: true; // always -- this is never auto-approved
}

function distancePointToSegment(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number,
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function sourceTolerancePx(source: CvTraceResult['sourceImageSize']) {
  // Pixel tolerances must follow the source resolution. A fixed 30 px value
  // made the same physical doorway look attached on a small preview and
  // unrelated on a high-resolution PDF raster.
  const diagonal = Math.hypot(source.widthPx, source.heightPx);
  return Math.max(18, Math.min(80, diagonal * 0.012));
}

function angleDifferenceRadians(a: number, b: number) {
  const difference = Math.abs(a - b) % Math.PI;
  return Math.min(difference, Math.PI - difference);
}

function projectionOnSegment(
  point: { x: number; y: number },
  segment: Pick<CvWallCandidate, 'x1' | 'y1' | 'x2' | 'y2'>,
) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return 0;
  return ((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / length;
}

function visionWallMatchesCv(
  cvWall: CvWallCandidate,
  visionWall: VisionSemanticResult['walls'][number],
  tolerancePx: number,
) {
  const cvAngle = Math.atan2(cvWall.y2 - cvWall.y1, cvWall.x2 - cvWall.x1);
  const visionAngle = Math.atan2(
    visionWall.approxEndPx.y - visionWall.approxStartPx.y,
    visionWall.approxEndPx.x - visionWall.approxStartPx.x,
  );
  if (angleDifferenceRadians(cvAngle, visionAngle) > (10 * Math.PI) / 180) return false;

  const midpoint = {
    x: (visionWall.approxStartPx.x + visionWall.approxEndPx.x) / 2,
    y: (visionWall.approxStartPx.y + visionWall.approxEndPx.y) / 2,
  };
  if (distancePointToSegment(midpoint.x, midpoint.y, cvWall.x1, cvWall.y1, cvWall.x2, cvWall.y2) > tolerancePx) return false;

  const projectedStart = projectionOnSegment(visionWall.approxStartPx, cvWall);
  const projectedEnd = projectionOnSegment(visionWall.approxEndPx, cvWall);
  const overlapStart = Math.max(0, Math.min(projectedStart, projectedEnd));
  const overlapEnd = Math.min(cvWall.lengthPx, Math.max(projectedStart, projectedEnd));
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const visionLength = Math.hypot(
    visionWall.approxEndPx.x - visionWall.approxStartPx.x,
    visionWall.approxEndPx.y - visionWall.approxStartPx.y,
  );
  return overlap >= Math.min(cvWall.lengthPx, visionLength) * 0.5;
}

export function reconcilePlan(
  cv: CvTraceResult,
  vision: VisionSemanticResult,
): ReconciledPlanCandidate {
  const reviewFlags: string[] = [];
  const tolerancePx = sourceTolerancePx(cv.sourceImageSize);

  // 1. Attach opening proximity to each CV wall -- a wall segment near a
  // vision-detected door/window is likely where the actual gap/opening is,
  // even though the CV pass sees it as two separate short wall segments
  // (exactly like the tracer output around a door gap).
  const walls: ReconciledWall[] = cv.walls.map(w => {
    const nearOpening = vision.openings.some(o => {
      const d = distancePointToSegment(
        o.approxCenterPx.x, o.approxCenterPx.y, w.x1, w.y1, w.x2, w.y2,
      );
      return d <= tolerancePx;
    });
    const matchedVisionWall = vision.walls.some((candidate) =>
      candidate.confidence >= 0.7 && visionWallMatchesCv(w, candidate, tolerancePx),
    );
    return {
      id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
      thicknessPx: w.thicknessPx, lengthPx: w.lengthPx,
      confirmedByBothPasses: matchedVisionWall,
      geometryConfidence: w.confidence,
      hasNearbyOpening: nearOpening,
    };
  });

  if (walls.some(w => w.geometryConfidence < 0.6)) {
    reviewFlags.push('One or more wall segments have low geometric confidence — verify against source image before approving.');
  }
  if (walls.some(w => w.thicknessPx === null)) {
    reviewFlags.push('Some walls could not have thickness measured (no parallel line pair found) — confirm thickness manually, do not assume a default.');
  }
  if (vision.walls.length > 0 && !walls.some(w => w.confirmedByBothPasses)) {
    reviewFlags.push('Vision wall candidates did not geometrically align with CV wall traces — inspect source alignment before approving walls.');
  }

  // 2. Rooms: keep the vision model's label/type (semantics), but note we
  // are NOT trusting its polygon for final geometry -- that should be
  // derived from the approved wall graph once the designer confirms room
  // boundaries in the review canvas. Here we just carry the semantic hint
  // forward with an explicit confidence, not as measured fact.
  const rooms: ReconciledRoom[] = vision.rooms.map(r => ({
    label: r.label,
    roomType: r.roomType,
    boundaryWallIds: [], // populated by the designer during review, not guessed here
    semanticConfidence: r.confidence,
  }));
  if (rooms.some(r => r.semanticConfidence < 0.7)) {
    reviewFlags.push('One or more room labels have low confidence — confirm room type manually during review.');
  }

  // 3. Cross-check: does every vision-detected room roughly correspond to
  // an enclosed region in the CV wall graph? This is a coarse sanity check,
  // not a full polygon-closure algorithm -- flag for review rather than
  // silently accept or silently reject.
  if (vision.rooms.length > 0 && walls.length === 0) {
    reviewFlags.push('Vision model found rooms but CV pass found zero walls — geometry extraction likely failed on this image; do not trust room boundaries.');
  }

  return {
    schema: 'CanonicalPlanV1.candidate',
    sourceImageSize: cv.sourceImageSize,
    walls,
    rooms,
    openings: vision.openings,
    dimensionHints: vision.dimensionTextFindings,
    reviewFlags,
    requiresDesignerReview: true,
  };
}

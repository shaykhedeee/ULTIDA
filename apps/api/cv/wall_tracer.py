#!/usr/bin/env python3
"""
wall_tracer.py — deterministic geometry-first floor plan wall detection.

WHY THIS EXISTS
----------------
A vision-LLM (GPT-4V/Gemini/etc.) is good at semantics ("this is a kitchen",
"this rectangle is a door") but bad at precise pixel-accurate geometry -- it
will happily report a wall as slightly the wrong length or miss a jog in a
wall, because it's not actually measuring, it's describing. Classical CV
(Hough line detection + thickness estimation from parallel line pairing) is
the opposite: excellent at precise pixel geometry, useless at semantics.

ULTIDA's own architecture doc already states the right approach: "Combine AI
semantics with deterministic PDF extraction, OCR evidence, scale observations,
wall intersection checks, opening anchoring, polygon validation, and area
calculations." This script IS that deterministic half. Run it BEFORE or
ALONGSIDE the vision-LLM call, then reconcile both outputs (see
reconcile_plan.ts in this kit) into one CanonicalPlanV1.

PIPELINE
--------
1. Preprocess: grayscale, adaptive threshold, morphological close (bridges
   small gaps/dashed lines so wall segments don't fragment).
2. Detect line segments: Probabilistic Hough Transform (cv2.HoughLinesP).
3. Merge collinear/near-duplicate segments into candidate wall centerlines.
4. Pair parallel lines at consistent spacing to estimate wall THICKNESS in
   pixels (a real wall is drawn as two parallel lines, not one) -- this is
   the step that makes this "real geometry" rather than a single skeleton line.
5. Find intersections between wall centerlines -> corner/junction nodes.
6. Build a wall graph: nodes = corners, edges = walls with pixel length +
   thickness + confidence.
7. Output JSON matching a PlanAnalysisResultV1-shaped candidate structure --
   this is a CANDIDATE for designer review, never auto-approved truth, per
   ARCHITECTURE.md invariant #4.

USAGE
-----
    python3 wall_tracer.py input_plan.png output_candidate.json

Requires: opencv-python, numpy (pip install opencv-python numpy)
"""
import sys
import json
import math
import numpy as np
import cv2


def preprocess(gray: np.ndarray, color_img: np.ndarray = None) -> np.ndarray:
    """Binarize and close small gaps so wall lines aren't fragmented.

    If color_img is provided, first isolate near-black/dark-gray pixels
    while explicitly EXCLUDING saturated red and blue pixels -- real
    architectural walls are drawn black/dark-gray (often as diagonal
    hatching), while annotation overlays (red dimension lines, blue
    furniture outlines) are common in furniture-layout drawings and would
    otherwise be picked up as "dark enough to be a wall" by grayscale
    thresholding alone. This was a real, verified problem: without this,
    a real annotated floor plan produced ~97 "wall" candidates instead of
    the true ~15-20, because dimension lines and furniture blocks were
    included.
    """
    if color_img is not None:
        b, g, r = cv2.split(color_img.astype(np.int16))
        # "Dark and roughly neutral" = wall/hatching/text. Saturated red
        # (r high, g/b low) or saturated blue (b high, r/g low) gets excluded
        # regardless of how dark it is.
        brightness = (b + g + r) / 3
        is_dark = brightness < 140
        redness = r - (g + b) / 2
        blueness = b - (r + g) / 2
        is_saturated_color = (redness > 40) | (blueness > 40)
        wall_mask = (is_dark & ~is_saturated_color).astype(np.uint8) * 255

        # Remove text-label noise: text characters form small, compact,
        # high-fill-ratio blobs (a letter mostly fills its own small bounding
        # box). Real wall strokes form long, thin, LOW-fill-ratio regions
        # (a line is mostly empty space inside its bounding box). Filter by
        # this shape signature via connected components, not just size --
        # size alone would also remove short real wall segments near corners.
        n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(wall_mask, connectivity=8)
        filtered_mask = np.zeros_like(wall_mask)
        for i in range(1, n_labels):
            x, y, bw, bh, area = stats[i]
            bbox_area = bw * bh
            fill_ratio = area / bbox_area if bbox_area > 0 else 0
            aspect = max(bw, bh) / max(1, min(bw, bh))
            is_textlike = fill_ratio > 0.35 and aspect < 4 and bbox_area < 900
            if not is_textlike:
                filtered_mask[labels == i] = 255
        wall_mask = filtered_mask

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        closed = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        return closed

    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 15, 8
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    return closed


def detect_segments(binary: np.ndarray):
    """Probabilistic Hough transform -> raw line segments.

    OpenCV 4.x returned shape (N, 1, 4); OpenCV 5.x may return a flat
    (N, 4) array. Normalize both to a list of (x1,y1,x2,y2) tuples so the
    rest of the pipeline is version-agnostic.
    """
    lines = cv2.HoughLinesP(
        binary, rho=1, theta=np.pi / 180, threshold=60,
        minLineLength=40, maxLineGap=8,
    )
    if lines is None:
        return []
    lines = np.asarray(lines).reshape(-1, 4)
    return [tuple(int(v) for v in row) for row in lines]


def segment_angle(seg):
    x1, y1, x2, y2 = seg
    return math.atan2(y2 - y1, x2 - x1)


def segment_length(seg):
    x1, y1, x2, y2 = seg
    return math.hypot(x2 - x1, y2 - y1)


def snap_to_axis(seg, tol_deg=6):
    """Floor plans are overwhelmingly axis-aligned. Snap near-horizontal /
    near-vertical segments exactly, which makes downstream merging and
    intersection math far more reliable than raw noisy pixel angles."""
    x1, y1, x2, y2 = seg
    angle = math.degrees(segment_angle(seg)) % 180
    if angle < tol_deg or angle > 180 - tol_deg:
        y_avg = round((y1 + y2) / 2)
        return (x1, y_avg, x2, y_avg), 'horizontal'
    if abs(angle - 90) < tol_deg:
        x_avg = round((x1 + x2) / 2)
        return (x_avg, y1, x_avg, y2), 'vertical'
    return seg, 'diagonal'


def merge_collinear(segments, gap_tol=12, offset_tol=6):
    """Merge near-duplicate / broken-up segments lying on the same line into
    single longer wall centerline candidates."""
    horiz, vert, diag = [], [], []
    snapped = [snap_to_axis(s) for s in segments]
    for seg, kind in snapped:
        (horiz if kind == 'horizontal' else vert if kind == 'vertical' else diag).append(seg)

    def merge_group(group, axis_is_y):
        # axis_is_y: group segments sharing the same y (horizontal walls);
        # otherwise sharing the same x (vertical walls).
        buckets = {}
        for seg in group:
            key = seg[1] if axis_is_y else seg[0]
            placed = False
            for existing_key in list(buckets):
                if abs(existing_key - key) <= offset_tol:
                    buckets[existing_key].append(seg)
                    placed = True
                    break
            if not placed:
                buckets[key] = [seg]

        merged = []
        for key, segs in buckets.items():
            if axis_is_y:
                pts = sorted([(min(s[0], s[2]), max(s[0], s[2])) for s in segs])
            else:
                pts = sorted([(min(s[1], s[3]), max(s[1], s[3])) for s in segs])
            runs = [list(pts[0])]
            for lo, hi in pts[1:]:
                if lo - runs[-1][1] <= gap_tol:
                    runs[-1][1] = max(runs[-1][1], hi)
                else:
                    runs.append([lo, hi])
            for lo, hi in runs:
                if axis_is_y:
                    merged.append((lo, key, hi, key))
                else:
                    merged.append((key, lo, key, hi))
        return merged

    return merge_group(horiz, True) + merge_group(vert, False)


def estimate_thickness_and_dedupe(walls, max_pair_dist=40):
    """Real walls are drawn as two parallel lines. Pair up close, parallel,
    overlapping centerlines to (a) estimate wall thickness in pixels and
    (b) collapse the pair into ONE wall entity instead of reporting two
    walls where there's actually one double-lined wall."""
    horiz = [w for w in walls if w[1] == w[3]]
    vert = [w for w in walls if w[0] == w[2]]
    result = []
    used = set()

    def try_pair(group, axis_is_y):
        nonlocal result, used
        for i, a in enumerate(group):
            if id(a) in used:
                continue
            best_j, best_dist = None, None
            for j, b in enumerate(group):
                if i == j or id(b) in used:
                    continue
                dist = abs((a[1] if axis_is_y else a[0]) - (b[1] if axis_is_y else b[0]))
                if dist <= max_pair_dist:
                    a_lo, a_hi = (a[0], a[2]) if axis_is_y else (a[1], a[3])
                    b_lo, b_hi = (b[0], b[2]) if axis_is_y else (b[1], b[3])
                    overlap = min(a_hi, a_lo if a_lo > a_hi else a_hi, b_hi) - max(min(a_lo, a_hi), min(b_lo, b_hi))
                    if overlap > 0.4 * min(abs(a_hi - a_lo), abs(b_hi - b_lo)) and (best_dist is None or dist < best_dist):
                        best_j, best_dist = j, dist
            if best_j is not None:
                b = group[best_j]
                used.add(id(a)); used.add(id(b))
                centerline_pos = ((a[1] if axis_is_y else a[0]) + (b[1] if axis_is_y else b[0])) / 2
                if axis_is_y:
                    lo, hi = min(a[0], b[0]), max(a[2], b[2])
                    result.append({'x1': lo, 'y1': centerline_pos, 'x2': hi, 'y2': centerline_pos,
                                   'thicknessPx': round(best_dist, 1), 'confidence': 0.9})
                else:
                    lo, hi = min(a[1], b[1]), max(a[3], b[3])
                    result.append({'x1': centerline_pos, 'y1': lo, 'x2': centerline_pos, 'y2': hi,
                                   'thicknessPx': round(best_dist, 1), 'confidence': 0.9})
            else:
                # Single unpaired line -- still a wall candidate, but lower
                # confidence since thickness couldn't be verified geometrically.
                used.add(id(a))
                x1, y1, x2, y2 = a
                result.append({'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                               'thicknessPx': None, 'confidence': 0.55})

    try_pair(horiz, True)
    try_pair(vert, False)
    return result


def find_corners(walls, snap_tol=15):
    """Find where wall centerlines meet/cross -> corner nodes, and snap wall
    endpoints onto nearby corners so the graph is actually connected instead
    of a pile of disjoint segments."""
    endpoints = []
    for w in walls:
        endpoints.append((w['x1'], w['y1']))
        endpoints.append((w['x2'], w['y2']))

    corners = []
    for pt in endpoints:
        placed = False
        for c in corners:
            if math.hypot(pt[0] - c['x'], pt[1] - c['y']) <= snap_tol:
                c['x'] = (c['x'] + pt[0]) / 2
                c['y'] = (c['y'] + pt[1]) / 2
                c['refs'] += 1
                placed = True
                break
        if not placed:
            corners.append({'x': pt[0], 'y': pt[1], 'refs': 1})

    for i, c in enumerate(corners):
        c['id'] = f'corner_{i}'
    return corners


def snap_walls_to_corners(walls, corners, tol=15):
    def nearest_corner(x, y):
        best = min(corners, key=lambda c: math.hypot(c['x'] - x, c['y'] - y))
        return best if math.hypot(best['x'] - x, best['y'] - y) <= tol else None

    out = []
    for i, w in enumerate(walls):
        c1 = nearest_corner(w['x1'], w['y1'])
        c2 = nearest_corner(w['x2'], w['y2'])
        out.append({
            'id': f'wall_{i}',
            'startCornerId': c1['id'] if c1 else None,
            'endCornerId': c2['id'] if c2 else None,
            'x1': c1['x'] if c1 else w['x1'], 'y1': c1['y'] if c1 else w['y1'],
            'x2': c2['x'] if c2 else w['x2'], 'y2': c2['y'] if c2 else w['y2'],
            'thicknessPx': w['thicknessPx'],
            'lengthPx': round(math.hypot(w['x2'] - w['x1'], w['y2'] - w['y1']), 1),
            'confidence': w['confidence'],
        })
    return out


def detect_openings(walls, min_gap_px=15, max_gap_px=140):
    """Find plausible door/window openings as gaps between near-collinear
    wall segments on the same axis -- e.g. two wall segments that share the
    same y (horizontal wall) with a gap of a plausible door/window width
    between their facing endpoints. This is the same signal a human reviewer
    uses: "these two wall stubs are clearly meant to be one wall with a
    doorway in it." Gap width thresholds are in PIXELS, not mm -- scale them
    once you have a calibrated scale for this specific image, the defaults
    here assume a roughly 1000-1100px-wide floor plan image.
    """
    openings = []
    horiz = [w for w in walls if abs(w['y1'] - w['y2']) < 2]
    vert = [w for w in walls if abs(w['x1'] - w['x2']) < 2]

    def check_axis(group, axis_is_y):
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                pos_a = a['y1'] if axis_is_y else a['x1']
                pos_b = b['y1'] if axis_is_y else b['x1']
                if abs(pos_a - pos_b) > 10:
                    continue  # not on the same wall line
                a_lo, a_hi = (min(a['x1'], a['x2']), max(a['x1'], a['x2'])) if axis_is_y else (min(a['y1'], a['y2']), max(a['y1'], a['y2']))
                b_lo, b_hi = (min(b['x1'], b['x2']), max(b['x1'], b['x2'])) if axis_is_y else (min(b['y1'], b['y2']), max(b['y1'], b['y2']))
                gap = max(b_lo, a_lo) - min(b_hi, a_hi) if b_lo >= a_hi else (a_lo - b_hi if a_lo >= b_hi else None)
                if gap is None:
                    continue
                if min_gap_px <= gap <= max_gap_px:
                    mid = (min(a_hi, b_hi) + max(a_lo, b_lo)) / 2 if False else (a_hi + b_lo) / 2 if a_hi < b_lo else (b_hi + a_lo) / 2
                    center = {'x': mid, 'y': pos_a} if axis_is_y else {'x': pos_a, 'y': mid}
                    openings.append({
                        'betweenWallIds': [a['id'], b['id']],
                        'approxCenterPx': center,
                        'approxWidthPx': round(gap, 1),
                        'confidence': 0.6,
                        'note': 'Gap between collinear wall segments -- plausible door/window, not yet semantically confirmed.',
                    })

    check_axis(horiz, True)
    check_axis(vert, False)
    return openings


def trace_walls(image_path: str) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    binary = preprocess(gray, color_img=img)
    raw_segments = detect_segments(binary)
    merged = merge_collinear(raw_segments)
    walls_with_thickness = estimate_thickness_and_dedupe(merged)
    corners = find_corners(walls_with_thickness)
    walls = snap_walls_to_corners(walls_with_thickness, corners)

    # Drop trivially short "walls" -- almost always noise/text artifacts, not
    # real geometry. Keep the threshold in pixels here explicit and visible
    # rather than silently baked in, since it should scale with image DPI.
    min_wall_len_px = max(20, int(0.015 * max(h, w)))
    walls = [x for x in walls if x['lengthPx'] >= min_wall_len_px]

    openings = detect_openings(walls)

    return {
        'schema': 'PlanAnalysisResultV1.wallCandidates',
        'sourceImageSize': {'widthPx': w, 'heightPx': h},
        'corners': corners,
        'walls': walls,
        'wallCount': len(walls),
        'openings': openings,
        'openingCount': len(openings),
        'method': 'deterministic-cv-hough-thickness-pairing',
        'notes': (
            'Candidate geometry only. Not authoritative until reconciled '
            'with vision-model semantics and confirmed by a human reviewer, '
            'per ARCHITECTURE.md invariant #4. Openings are geometric gap '
            'candidates only -- they are not yet classified as door vs '
            'window; that classification needs the vision-LLM semantic pass.'
        ),
    }


def _json_default(o):
    """cv2/numpy return int32/float32/float64 scalars, not native Python
    types -- json.dump chokes on these. Convert explicitly rather than
    silently stringifying or dropping fields."""
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 wall_tracer.py <input_image> <output_json>")
        sys.exit(1)
    result = trace_walls(sys.argv[1])
    with open(sys.argv[2], 'w') as f:
        json.dump(result, f, indent=2, default=_json_default)
    print(f"Wrote {result['wallCount']} wall candidates to {sys.argv[2]}")

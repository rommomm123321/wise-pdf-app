/**
 * routingAlgorithm.ts
 *
 * Pure geometry functions for Redline Routing.
 * All coordinates are normalized (0-1) relative to page dimensions.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Projection {
  point: Point;
  segmentIndex: number;
  t: number; // 0-1 along segment
  distance: number;
}

export interface GeneratedRoute {
  points: Point[];
  endpointIndex: number;
  from: string;
  to: string;
}

// ─── Vector math helpers ─────────────────────────────────────────────────────

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function perpendicular(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return { x: 0, y: 0 };
  // Right-side perpendicular (90° clockwise)
  return { x: dy / len, y: -dx / len };
}

// ─── Core: project point onto polyline ───────────────────────────────────────

export function projectPointOnPolyline(pt: Point, polyline: Point[]): Projection {
  let bestDist = Infinity;
  let bestProj: Projection = { point: polyline[0], segmentIndex: 0, t: 0, distance: Infinity };

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const ab = sub(b, a);
    const ap = sub(pt, a);
    const abLenSq = dot(ab, ab);

    let t: number;
    if (abLenSq < 1e-12) {
      t = 0;
    } else {
      t = Math.max(0, Math.min(1, dot(ap, ab) / abLenSq));
    }

    const proj = lerp(a, b, t);
    const d = dist(pt, proj);

    if (d < bestDist) {
      bestDist = d;
      bestProj = { point: proj, segmentIndex: i, t, distance: d };
    }
  }

  return bestProj;
}

// ─── Extract sub-path along polyline between two projections ─────────────────

export function extractSubPath(
  polyline: Point[],
  from: Projection,
  to: Projection,
): Point[] {
  // Determine direction: always go from lower index to higher
  let startSeg = from.segmentIndex;
  let startT = from.t;
  let endSeg = to.segmentIndex;
  let endT = to.t;
  let startPt = from.point;
  let endPt = to.point;

  const forward = startSeg < endSeg || (startSeg === endSeg && startT <= endT);

  if (!forward) {
    // Swap to always go forward
    [startSeg, endSeg] = [endSeg, startSeg];
    [startT, endT] = [endT, startT];
    [startPt, endPt] = [endPt, startPt];
  }

  const path: Point[] = [startPt];

  if (startSeg === endSeg) {
    // Same segment — just the two points
    path.push(endPt);
  } else {
    // Add end of first segment
    path.push(polyline[startSeg + 1]);

    // Add intermediate vertices
    for (let i = startSeg + 1; i < endSeg; i++) {
      path.push(polyline[i + 1]);
    }

    // Add projection on last segment
    path.push(endPt);
  }

  // If we swapped, reverse so path goes from original 'from' to original 'to'
  if (!forward) {
    path.reverse();
  }

  return path;
}

// ─── Offset a polyline perpendicular ─────────────────────────────────────────

export function offsetPolyline(polyline: Point[], offset: number): Point[] {
  if (polyline.length < 2 || Math.abs(offset) < 1e-10) return [...polyline];

  const result: Point[] = [];

  for (let i = 0; i < polyline.length; i++) {
    if (i === 0) {
      // First point: use first segment's perpendicular
      const perp = perpendicular(polyline[0], polyline[1]);
      result.push({ x: polyline[0].x + perp.x * offset, y: polyline[0].y + perp.y * offset });
    } else if (i === polyline.length - 1) {
      // Last point: use last segment's perpendicular
      const perp = perpendicular(polyline[i - 1], polyline[i]);
      result.push({ x: polyline[i].x + perp.x * offset, y: polyline[i].y + perp.y * offset });
    } else {
      // Interior point: average of two segment perpendiculars (miter join)
      const perp1 = perpendicular(polyline[i - 1], polyline[i]);
      const perp2 = perpendicular(polyline[i], polyline[i + 1]);
      const avgX = (perp1.x + perp2.x) / 2;
      const avgY = (perp1.y + perp2.y) / 2;
      const len = Math.sqrt(avgX * avgX + avgY * avgY);
      if (len < 1e-10) {
        result.push({ x: polyline[i].x + perp1.x * offset, y: polyline[i].y + perp1.y * offset });
      } else {
        // Miter: scale to maintain offset distance
        const scale = 1 / len;
        const cappedScale = Math.min(scale, 3); // Cap miter to prevent spikes on sharp angles
        result.push({
          x: polyline[i].x + avgX * cappedScale * offset,
          y: polyline[i].y + avgY * cappedScale * offset,
        });
      }
    }
  }

  return result;
}

// ─── Simplify: remove collinear points ───────────────────────────────────────

function simplifyPath(points: Point[], threshold = 0.001): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    // Cross product to check collinearity
    const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > threshold) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

// ─── Build a single route ────────────────────────────────────────────────────

export function buildRoute(
  start: Point,
  end: Point,
  backbone: Point[],
  routeIndex: number,
  spacing: number,
): Point[] {
  if (backbone.length < 2) {
    // No backbone: direct line
    return [start, end];
  }

  // Project start and end onto backbone
  const startProj = projectPointOnPolyline(start, backbone);
  const endProj = projectPointOnPolyline(end, backbone);

  // Extract sub-path along backbone
  const backboneSub = extractSubPath(backbone, startProj, endProj);

  // Offset backbone portion for parallel routes
  const offset = routeIndex * spacing;
  const offsetSub = offset !== 0 ? offsetPolyline(backboneSub, offset) : backboneSub;

  // Build full path: start → entry → [backbone] → exit → end
  const path: Point[] = [];
  path.push(start);

  // Entry point on (offset) backbone
  const entry = offsetSub[0];
  if (dist(start, entry) > 0.001) {
    path.push(entry);
  }

  // Backbone intermediate points (skip first and last which are entry/exit)
  for (let i = 1; i < offsetSub.length - 1; i++) {
    path.push(offsetSub[i]);
  }

  // Exit point
  const exit = offsetSub[offsetSub.length - 1];
  if (offsetSub.length > 1) {
    path.push(exit);
  }

  // Branch to device
  if (dist(exit, end) > 0.001) {
    path.push(end);
  }

  return simplifyPath(path);
}

// ─── Generate multiple routes from one start ─────────────────────────────────

export function generateRoutes(
  start: Point,
  endpoints: { point: Point; label: string }[],
  backbone: Point[],
  spacing: number,
): GeneratedRoute[] {
  // Sort endpoints by their projection along the backbone for clean parallel routing
  const withProj = endpoints.map((ep, idx) => ({
    ...ep,
    idx,
    proj: projectPointOnPolyline(ep.point, backbone),
  }));

  withProj.sort((a, b) => {
    if (a.proj.segmentIndex !== b.proj.segmentIndex) return a.proj.segmentIndex - b.proj.segmentIndex;
    return a.proj.t - b.proj.t;
  });

  return withProj.map((ep, routeIdx) => ({
    points: buildRoute(start, ep.point, backbone, routeIdx, spacing),
    endpointIndex: ep.idx,
    from: 'A',
    to: ep.label || `B${routeIdx + 1}`,
  }));
}

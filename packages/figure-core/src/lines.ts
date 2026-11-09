/** Lines, arrows and connectors: routing, arrow heads and attachment to other nodes. */
import type { LineCap, LineNode, NodeId, Point, Rect, SciDocument, SciNode } from '@sciforge/doc-model';
import { escapeXml } from '@sciforge/math-core';
import { boundsOf, dist, fmt, rayExit, rectCenter } from './geom';
import { dashArray } from './shapes';

export const capSize = (strokeWidth: number) => Math.max(8, strokeWidth * 5);

/** The vertices actually drawn (elbow lines get orthogonal waypoints), relative to the node origin. */
export function routePoints(n: Pick<LineNode, 'points' | 'routing'>): Point[] {
  const pts = n.points;
  if (n.routing !== 'elbow') return pts;
  const a = pts[0], b = pts[pts.length - 1];
  if (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5) return [a, b];
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    const mx = (a.x + b.x) / 2;
    return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
  }
  const my = (a.y + b.y) / 2;
  return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
}

interface Cubic {
  c1: Point;
  c2: Point;
  p: Point;
}

/** Catmull-Rom spline through the points as cubic Béziers. */
export function smoothCurve(pts: Point[]): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    out.push({
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p: p2,
    });
  }
  return out;
}

function unit(from: Point, to: Point): Point {
  const d = dist(from, to) || 1;
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

/** How far the stroke is pulled back so it does not poke through a filled arrow head. */
function inset(cap: LineCap, sw: number): number {
  return cap === 'arrow' ? capSize(sw) * 0.75 : cap === 'dot' ? Math.max(3, sw * 2) * 0.5 : 0;
}

function capMarkup(cap: LineCap, tip: Point, dir: Point, sw: number, color: string): string {
  if (cap === 'none') return '';
  const L = capSize(sw);
  const nx = -dir.y, ny = dir.x;
  const back = { x: tip.x - dir.x * L, y: tip.y - dir.y * L };
  const c = escapeXml(color);
  if (cap === 'arrow') {
    const w = L * 0.38;
    return `<path d="M${fmt(tip.x)} ${fmt(tip.y)}L${fmt(back.x + nx * w)} ${fmt(back.y + ny * w)}L${fmt(back.x + dir.x * L * 0.18)} ${fmt(back.y + dir.y * L * 0.18)}L${fmt(back.x - nx * w)} ${fmt(back.y - ny * w)}Z" fill="${c}" stroke="${c}" stroke-width="${fmt(Math.min(sw, 1))}" stroke-linejoin="round"/>`;
  }
  if (cap === 'open') {
    const w = L * 0.42;
    return `<path d="M${fmt(back.x + nx * w)} ${fmt(back.y + ny * w)}L${fmt(tip.x)} ${fmt(tip.y)}L${fmt(back.x - nx * w)} ${fmt(back.y - ny * w)}" fill="none" stroke="${c}" stroke-width="${fmt(sw)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if (cap === 'dot') {
    return `<circle cx="${fmt(tip.x)}" cy="${fmt(tip.y)}" r="${fmt(Math.max(3, sw * 2))}" fill="${c}"/>`;
  }
  const w = L * 0.5;
  return `<path d="M${fmt(tip.x + nx * w)} ${fmt(tip.y + ny * w)}L${fmt(tip.x - nx * w)} ${fmt(tip.y - ny * w)}" stroke="${c}" stroke-width="${fmt(sw)}" stroke-linecap="round"/>`;
}

export interface LineGeometry {
  /** Path data (relative to the node origin) with ends pulled back for arrow heads. */
  d: string;
  /** Full-length path for hit testing. */
  hitD: string;
  caps: string;
  /** Point halfway along the route, for the label. */
  mid: Point;
  bounds: Rect;
  route: Point[];
}

export function lineGeometry(n: LineNode): LineGeometry {
  const route = routePoints(n);
  const sw = n.strokeWidth;
  const curve = n.routing === 'curve' && route.length > 2;
  const cubics = curve ? smoothCurve(route) : null;
  const first = route[0], last = route[route.length - 1];
  const dirStart = unit(cubics ? cubics[0].c1 : route[1], first);
  const dirEnd = unit(cubics ? cubics[cubics.length - 1].c2 : route[route.length - 2], last);
  const s0 = inset(n.startCap, sw), s1 = inset(n.endCap, sw);
  const a = { x: first.x - dirStart.x * s0, y: first.y - dirStart.y * s0 };
  const b = { x: last.x - dirEnd.x * s1, y: last.y - dirEnd.y * s1 };
  const path = (p0: Point, pN: Point) => {
    if (cubics) {
      return `M${fmt(p0.x)} ${fmt(p0.y)}` + cubics.map((c, i) => {
        const p = i === cubics.length - 1 ? pN : c.p;
        return `C${fmt(c.c1.x)} ${fmt(c.c1.y)} ${fmt(c.c2.x)} ${fmt(c.c2.y)} ${fmt(p.x)} ${fmt(p.y)}`;
      }).join('');
    }
    const pts = [p0, ...route.slice(1, -1), pN];
    return pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`).join('');
  };
  const caps = capMarkup(n.startCap, first, dirStart, sw, n.stroke) + capMarkup(n.endCap, last, dirEnd, sw, n.stroke);
  // midpoint by length along the polyline (good enough for curves too)
  const lens = route.slice(1).map((p, i) => dist(route[i], p));
  let half = lens.reduce((x, y) => x + y, 0) / 2;
  let mid = first;
  for (let i = 0; i < lens.length; i++) {
    if (half <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, half / lens[i]) : 0;
      mid = { x: route[i].x + (route[i + 1].x - route[i].x) * t, y: route[i].y + (route[i + 1].y - route[i].y) * t };
      break;
    }
    half -= lens[i];
  }
  const extra = Math.max(capSize(sw) * 0.5, sw);
  const bb = boundsOf(cubics ? [...route, ...cubics.flatMap((c) => [c.c1, c.c2])] : route);
  return {
    d: path(a, b),
    hitD: path(first, last),
    caps,
    mid,
    route,
    bounds: { x: bb.x - extra, y: bb.y - extra, width: bb.width + 2 * extra, height: bb.height + 2 * extra },
  };
}

export function lineStrokeMarkup(n: LineNode, g: LineGeometry): string {
  const da = dashArray(n.dash, n.strokeWidth);
  return (
    `<path d="${g.d}" fill="none" stroke="${escapeXml(n.stroke)}" stroke-width="${fmt(n.strokeWidth)}" stroke-linejoin="round" stroke-linecap="${n.dash === 'dotted' ? 'round' : 'butt'}"${da ? ` stroke-dasharray="${da}"` : ''}/>` +
    g.caps
  );
}

// ------------------------------------------------------------------ connectors

/** What a connector needs to know about a node it attaches to (world coordinates). */
export interface AttachGeometry {
  center: Point;
  /** Closed outline used to find where a connector meets the node. */
  outline: Point[];
  bounds: Rect;
  ports?: Record<string, Point>;
}

const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/** Side midpoint of a box facing direction (dx, dy) along the dominant axis. */
function sideMid(b: Rect, dx: number, dy: number, horizontal: boolean): Point {
  if (horizontal) return { x: dx >= 0 ? b.x + b.width : b.x, y: b.y + b.height / 2 };
  return { x: b.x + b.width / 2, y: dy >= 0 ? b.y + b.height : b.y };
}

/**
 * Recompute the end points of every attached line from the current geometry of the nodes it is
 * attached to. Returns the same document when nothing changed. Bindings to deleted nodes are dropped.
 */
export function resolveConnectors(doc: SciDocument, geometry: (n: SciNode) => AttachGeometry | null): SciDocument {
  let byId: Map<NodeId, SciNode> | null = null;
  const cache = new Map<NodeId, AttachGeometry | null>();
  const geo = (id: NodeId) => {
    byId ??= new Map(doc.nodes.map((n) => [n.id, n]));
    if (!cache.has(id)) {
      const n = byId.get(id);
      cache.set(id, n && n.type !== 'line' ? geometry(n) : null);
    }
    return cache.get(id) ?? null;
  };
  let changed = false;
  const nodes = doc.nodes.map((n) => {
    if (n.type !== 'line' || (!n.start && !n.end)) return n;
    const abs = n.points.map((p) => ({ x: p.x + n.x, y: p.y + n.y }));
    const gs = n.start ? geo(n.start.node) : null;
    const ge = n.end ? geo(n.end.node) : null;
    const portS = gs && n.start?.port ? gs.ports?.[n.start.port] : undefined;
    const portE = ge && n.end?.port ? ge.ports?.[n.end.port] : undefined;
    const refS = portS ?? gs?.center ?? abs[0];
    const refE = portE ?? ge?.center ?? abs[abs.length - 1];
    const interior = n.routing === 'elbow' ? [] : abs.slice(1, -1);
    const towardS = interior[0] ?? refE;
    const towardE = interior[interior.length - 1] ?? refS;
    const horizontal = Math.abs(refE.x - refS.x) >= Math.abs(refE.y - refS.y);
    let p0 = abs[0], pN = abs[abs.length - 1];
    if (gs) {
      p0 = portS ?? (n.routing === 'elbow'
        ? sideMid(gs.bounds, towardS.x - gs.center.x, towardS.y - gs.center.y, horizontal)
        : rayExit(gs.outline, gs.center, towardS));
    }
    if (ge) {
      pN = portE ?? (n.routing === 'elbow'
        ? sideMid(ge.bounds, towardE.x - ge.center.x, towardE.y - ge.center.y, horizontal)
        : rayExit(ge.outline, ge.center, towardE));
    }
    const nextAbs = [p0, ...interior, pN];
    const dropStart = !!n.start && !gs;
    const dropEnd = !!n.end && !ge;
    const same = nextAbs.length === abs.length && nextAbs.every((p, i) => near(p, abs[i]));
    if (same && !dropStart && !dropEnd) return n;
    changed = true;
    const next: LineNode = {
      ...n,
      x: p0.x,
      y: p0.y,
      points: nextAbs.map((p) => ({ x: p.x - p0.x, y: p.y - p0.y })),
    };
    if (dropStart) delete next.start;
    if (dropEnd) delete next.end;
    return next;
  });
  return changed ? { ...doc, nodes } : doc;
}

export { rectCenter };

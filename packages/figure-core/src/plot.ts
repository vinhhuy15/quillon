/** Function plots: y = f(x), parametric and polar curves on textbook or paper-style axes. */
import type { PlotFunction, PlotNode, Point, Rect } from '@sciforge/doc-model';
import { escapeXml } from '@sciforge/math-core';
import { compileExpr } from './expr';
import { fmt } from './geom';
import { layoutRich, type TextMeasurer } from './richtext';
import { dashArray } from './shapes';

export const PLOT_FONT = 'Times New Roman, serif';

export interface Tick {
  value: number;
  px: number;
  label: string;
}

export interface CurveGeometry {
  fn: PlotFunction;
  /** Polyline pieces in local px (broken at gaps and asymptotes). */
  segments: Point[][];
  error?: string;
}

export interface PlotGeometry {
  area: Rect;
  toPx: (x: number, y: number) => Point;
  ticksX: Tick[];
  ticksY: Tick[];
  /** Pixel position of the axes in 'cross' mode (clamped into the area). */
  axisX: number;
  axisY: number;
  originVisible: boolean;
  curves: CurveGeometry[];
}

/** 1, 2, 5 × 10^k step giving roughly `target` intervals. */
export function niceStep(range: number, target: number): number {
  const raw = range / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
}

export function formatTick(v: number, step: number): string {
  const dec = Math.max(0, Math.min(8, -Math.floor(Math.log10(step) + 1e-9)));
  let s = (Math.abs(v) < step * 1e-6 ? 0 : v).toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('-', '−');
}

function ticks(min: number, max: number, pxLen: number, map: (v: number) => number): Tick[] {
  const step = niceStep(max - min, pxLen / 64);
  const out: Tick[] = [];
  const first = Math.ceil(min / step - 1e-9);
  for (let k = first; k * step <= max + step * 1e-9 && out.length < 200; k++) {
    const v = k * step;
    out.push({ value: v, px: map(v), label: formatTick(v, step) });
  }
  return out;
}

export function plotArea(n: PlotNode): Rect {
  const fs = n.fontSize;
  if (n.axes === 'box') {
    const left = fs * 3.2 + (n.yLabel ? fs * 1.6 : 0);
    const bottom = fs * 1.8 + (n.xLabel ? fs * 1.6 : 0);
    return { x: left, y: fs * 0.8, width: Math.max(10, n.width - left - fs * 1.2), height: Math.max(10, n.height - bottom - fs * 0.8) };
  }
  const m = fs * 0.9;
  return { x: m, y: m, width: Math.max(10, n.width - 2 * m), height: Math.max(10, n.height - 2 * m) };
}

export function plotGeometry(n: PlotNode): PlotGeometry {
  const area = plotArea(n);
  const sx = area.width / (n.xMax - n.xMin);
  const sy = area.height / (n.yMax - n.yMin);
  const px = (x: number) => area.x + (x - n.xMin) * sx;
  const py = (y: number) => area.y + (n.yMax - y) * sy;
  const toPx = (x: number, y: number) => ({ x: px(x), y: py(y) });
  const clampX = Math.min(area.x + area.width, Math.max(area.x, px(0)));
  const clampY = Math.min(area.y + area.height, Math.max(area.y, py(0)));
  const curves = n.functions.map((fn) => sampleCurve(fn, n, toPx, area));
  return {
    area,
    toPx,
    ticksX: ticks(n.xMin, n.xMax, area.width, px),
    ticksY: ticks(n.yMin, n.yMax, area.height, py),
    axisX: clampY,
    axisY: clampX,
    originVisible: n.xMin <= 0 && n.xMax >= 0 && n.yMin <= 0 && n.yMax >= 0,
    curves,
  };
}

function sampleCurve(fn: PlotFunction, n: PlotNode, toPx: (x: number, y: number) => Point, area: Rect): CurveGeometry {
  try {
    const pts: (Point | null)[] = [];
    const limit = area.height * 8;
    const ok = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.y - area.y) < limit + area.height && Math.abs(p.x - area.x) < limit + area.width;
    if (fn.kind === 'y') {
      const f = compileExpr(fn.expr, ['x']);
      const N = Math.min(4000, Math.max(300, Math.round(area.width * 2)));
      for (let i = 0; i <= N; i++) {
        const x = n.xMin + ((n.xMax - n.xMin) * i) / N;
        const p = toPx(x, f({ x }));
        pts.push(ok(p) ? p : null);
      }
    } else {
      const fx = compileExpr(fn.expr, ['t']);
      const fy = fn.kind === 'param' ? compileExpr(fn.expr2 ?? '0', ['t']) : null;
      const t0 = fn.tMin ?? 0, t1 = fn.tMax ?? 2 * Math.PI;
      const N = 1200;
      for (let i = 0; i <= N; i++) {
        const t = t0 + ((t1 - t0) * i) / N;
        let x: number, y: number;
        if (fy) {
          x = fx({ t });
          y = fy({ t });
        } else {
          const r = fx({ t });
          x = r * Math.cos(t);
          y = r * Math.sin(t);
        }
        const p = toPx(x, y);
        pts.push(ok(p) ? p : null);
      }
    }
    // Split at gaps and at jumps that cross most of the view (asymptotes such as tan x).
    const segments: Point[][] = [];
    let cur: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = i > 0 ? pts[i - 1] : null;
      if (!p) {
        if (cur.length > 1) segments.push(cur);
        cur = [];
        continue;
      }
      if (prev && Math.abs(p.y - prev.y) > area.height * 1.5) {
        if (cur.length > 1) segments.push(cur);
        cur = [];
      }
      cur.push(p);
    }
    if (cur.length > 1) segments.push(cur);
    return { fn, segments: segments.map(simplify) };
  } catch (e) {
    return { fn, segments: [], error: (e as Error).message };
  }
}

/**
 * Ramer–Douglas–Peucker: drop points that stay within `tol` px of the simplified line,
 * keeping exports small without visible faceting.
 */
export function simplify(pts: Point[], tol = 0.2): Point[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const a = pts[i], b = pts[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    let best = -1, bestD = tol;
    for (let k = i + 1; k < j; k++) {
      const p = pts[k];
      const d = len ? Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / len : Math.hypot(p.x - a.x, p.y - a.y);
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([i, best], [best, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

/** In framed mode the lowest y label and the leftmost x label would collide at the corner. */
export function cornerClash(g: Pick<PlotGeometry, 'area' | 'ticksX' | 'ticksY'>, fs: number): boolean {
  const bottom = g.ticksY[0], left = g.ticksX[0];
  return !!bottom && !!left && g.area.y + g.area.height - bottom.px < fs * 0.6 && left.px - g.area.x < fs * 1.2;
}

const polyline = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`).join('');

export interface PlotLayout {
  markup: string;
  errors: string[];
}

export function plotMarkup(n: PlotNode, measure?: TextMeasurer): PlotLayout {
  const g = plotGeometry(n);
  const { area } = g;
  const fs = n.fontSize;
  const ink = '#1f2937';
  const out: string[] = [];
  const txt = (x: number, y: number, s: string, anchor: 'start' | 'middle' | 'end', baseline = 'central') =>
    `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${escapeXml(s)}</text>`;
  const rich = (s: string, x: number, y: number, ax: number, ay: number, rotate = 0) => {
    const l = layoutRich(s, { fontSize: fs * 1.1, fontFamily: PLOT_FONT, color: ink, measure });
    const tx = x - l.width * ax, ty = y - l.height * ay;
    const tr = rotate ? ` rotate(${rotate} ${fmt(x - tx)} ${fmt(y - ty)})` : '';
    return `<g transform="translate(${fmt(tx)} ${fmt(ty)})${tr}">${l.markup}</g>`;
  };
  // grid
  if (n.grid) {
    const lines = [
      ...g.ticksX.map((t) => `M${fmt(t.px)} ${fmt(area.y)}V${fmt(area.y + area.height)}`),
      ...g.ticksY.map((t) => `M${fmt(area.x)} ${fmt(t.px)}H${fmt(area.x + area.width)}`),
    ];
    out.push(`<path d="${lines.join('')}" stroke="#e5e7eb" stroke-width="1" fill="none"/>`);
  }
  const labelAttrs = `font-family="${PLOT_FONT}" font-size="${fmt(fs)}" fill="${ink}"`;
  if (n.axes === 'box') {
    const tl = fs * 0.4;
    const tickPath = [
      ...g.ticksX.map((t) => `M${fmt(t.px)} ${fmt(area.y + area.height)}v${fmt(-tl)}`),
      ...g.ticksY.map((t) => `M${fmt(area.x)} ${fmt(t.px)}h${fmt(tl)}`),
    ].join('');
    out.push(`<rect x="${fmt(area.x)}" y="${fmt(area.y)}" width="${fmt(area.width)}" height="${fmt(area.height)}" fill="none" stroke="${ink}" stroke-width="1"/>`);
    out.push(`<path d="${tickPath}" stroke="${ink}" stroke-width="1" fill="none"/>`);
    out.push(
      `<g ${labelAttrs}>` +
        g.ticksX.map((t) => txt(t.px, area.y + area.height + fs * 0.9, t.label, 'middle')).join('') +
        g.ticksY.filter((_, i) => i > 0 || !cornerClash(g, fs)).map((t) => txt(area.x - fs * 0.4, t.px, t.label, 'end')).join('') +
        `</g>`,
    );
    if (n.xLabel) out.push(rich(n.xLabel, area.x + area.width / 2, n.height - fs * 0.2, 0.5, 1));
    if (n.yLabel) out.push(rich(n.yLabel, fs * 0.2, area.y + area.height / 2, 0, 0.5, -90));
  } else {
    const ax = g.axisX, ay = g.axisY;
    const head = fs * 0.55;
    const axes =
      `M${fmt(area.x - fs * 0.4)} ${fmt(ax)}H${fmt(area.x + area.width + fs * 0.5)}` +
      `M${fmt(ay)} ${fmt(area.y + area.height + fs * 0.4)}V${fmt(area.y - fs * 0.5)}`;
    const arrows =
      `M${fmt(area.x + area.width + fs * 0.5)} ${fmt(ax)}l${fmt(-head)} ${fmt(-head * 0.42)}v${fmt(head * 0.84)}Z` +
      `M${fmt(ay)} ${fmt(area.y - fs * 0.5)}l${fmt(-head * 0.42)} ${fmt(head)}h${fmt(head * 0.84)}Z`;
    const tl = fs * 0.25;
    const skip = (v: number) => Math.abs(v) < 1e-12;
    const tickPath = [
      ...g.ticksX.filter((t) => !skip(t.value)).map((t) => `M${fmt(t.px)} ${fmt(ax - tl)}v${fmt(2 * tl)}`),
      ...g.ticksY.filter((t) => !skip(t.value)).map((t) => `M${fmt(ay - tl)} ${fmt(t.px)}h${fmt(2 * tl)}`),
    ].join('');
    out.push(`<path d="${axes}${tickPath}" stroke="${ink}" stroke-width="1.1" fill="none"/>`);
    out.push(`<path d="${arrows}" fill="${ink}"/>`);
    // Keep the last tick label clear of the arrow head and the axis name.
    const xt = g.ticksX.filter((t) => !skip(t.value) && t.px < area.x + area.width - fs * 0.8);
    const yt = g.ticksY.filter((t) => !skip(t.value) && t.px > area.y + fs * 0.8);
    out.push(
      `<g ${labelAttrs}>` +
        xt.map((t) => txt(t.px, ax + fs * 0.85, t.label, 'middle')).join('') +
        yt.map((t) => txt(ay - fs * 0.45, t.px, t.label, 'end')).join('') +
        (g.originVisible ? txt(ay - fs * 0.35, ax + fs * 0.8, 'O', 'end') : '') +
        `</g>`,
    );
    if (n.xLabel) out.push(rich(n.xLabel, area.x + area.width + fs * 0.4, ax - fs * 0.35, 1, 1));
    if (n.yLabel) out.push(rich(n.yLabel, ay + fs * 0.45, area.y - fs * 0.6, 0, 0));
  }
  // curves, clipped to the plotting area
  const clipId = `clip-${n.id.replace(/[^\w-]/g, '')}`;
  out.push(`<clipPath id="${clipId}"><rect x="${fmt(area.x)}" y="${fmt(area.y)}" width="${fmt(area.width)}" height="${fmt(area.height)}"/></clipPath>`);
  const curves = g.curves
    .filter((c) => c.segments.length)
    .map((c) => {
      const da = dashArray(c.fn.dash, c.fn.width);
      return `<path d="${c.segments.map(polyline).join('')}" fill="none" stroke="${escapeXml(c.fn.color)}" stroke-width="${fmt(c.fn.width)}" stroke-linejoin="round" stroke-linecap="round"${da ? ` stroke-dasharray="${da}"` : ''}/>`;
    })
    .join('');
  out.push(`<g clip-path="url(#${clipId})">${curves}</g>`);
  // legend
  const labelled = n.functions.filter((f) => f.label);
  if (n.legend && labelled.length) {
    const rows = labelled.map((f) => ({ f, l: layoutRich(f.label!, { fontSize: fs, fontFamily: PLOT_FONT, color: ink, measure }) }));
    const sw = fs * 2;
    const w = Math.max(...rows.map((r) => r.l.width)) + sw + fs * 1.2;
    const rowH = Math.max(fs * 1.5, ...rows.map((r) => r.l.height));
    const h = rows.length * rowH + fs * 0.6;
    const lx = area.x + area.width - w - fs * 0.4, ly = area.y + fs * 0.4;
    out.push(`<rect x="${fmt(lx)}" y="${fmt(ly)}" width="${fmt(w)}" height="${fmt(h)}" fill="#ffffff" fill-opacity="0.9" stroke="#d1d5db" stroke-width="0.8"/>`);
    rows.forEach((r, i) => {
      const cy = ly + fs * 0.3 + rowH * (i + 0.5);
      const da = dashArray(r.f.dash, r.f.width);
      out.push(`<path d="M${fmt(lx + fs * 0.5)} ${fmt(cy)}h${fmt(sw)}" stroke="${escapeXml(r.f.color)}" stroke-width="${fmt(r.f.width)}"${da ? ` stroke-dasharray="${da}"` : ''}/>`);
      out.push(`<g transform="translate(${fmt(lx + fs * 0.8 + sw)} ${fmt(cy - r.l.height / 2)})">${r.l.markup}</g>`);
    });
  }
  const errors = g.curves.filter((c) => c.error).map((c) => `${c.fn.expr}: ${c.error}`);
  if (errors.length) {
    out.push(`<text x="${fmt(area.x + 6)}" y="${fmt(area.y + fs)}" font-family="Consolas, monospace" font-size="${fmt(fs * 0.85)}" fill="#dc2626">${escapeXml(errors[0])}</text>`);
  }
  return { markup: out.join(''), errors };
}

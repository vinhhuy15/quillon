/** Basic and flowchart shapes: SVG outline + polygon for connector attachment. */
import type { Dash, ShapeKind } from '@quillon/doc-model';
import type { Point } from '@quillon/doc-model';
import { fmt } from './geom';

export interface ShapeInfo {
  kind: ShapeKind;
  name: string;
  /** Typical flowchart meaning, for tooltips. */
  hint?: string;
}

export const SHAPES: ShapeInfo[] = [
  { kind: 'rect', name: 'Rectangle', hint: 'Process' },
  { kind: 'roundrect', name: 'Rounded rectangle', hint: 'Alternate process' },
  { kind: 'ellipse', name: 'Ellipse' },
  { kind: 'diamond', name: 'Diamond', hint: 'Decision' },
  { kind: 'stadium', name: 'Terminator', hint: 'Start / end' },
  { kind: 'parallelogram', name: 'Parallelogram', hint: 'Input / output' },
  { kind: 'triangle', name: 'Triangle' },
  { kind: 'hexagon', name: 'Hexagon', hint: 'Preparation' },
];

export const roundRadius = (w: number, h: number) => Math.min(12, Math.min(w, h) * 0.18);

/** Closed outline in local coordinates (0..w, 0..h). Curves are approximated. */
export function shapePolygon(kind: ShapeKind, w: number, h: number): Point[] {
  switch (kind) {
    case 'ellipse':
      return Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        return { x: w / 2 + (w / 2) * Math.cos(a), y: h / 2 + (h / 2) * Math.sin(a) };
      });
    case 'diamond':
      return [{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }];
    case 'triangle':
      return [{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    case 'parallelogram': {
      const k = Math.min(w * 0.25, h * 0.5);
      return [{ x: k, y: 0 }, { x: w, y: 0 }, { x: w - k, y: h }, { x: 0, y: h }];
    }
    case 'hexagon': {
      const k = Math.min(w * 0.25, h * 0.5);
      return [{ x: k, y: 0 }, { x: w - k, y: 0 }, { x: w, y: h / 2 }, { x: w - k, y: h }, { x: k, y: h }, { x: 0, y: h / 2 }];
    }
    case 'stadium': {
      const r = Math.min(w, h) / 2;
      const pts: Point[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = -Math.PI / 2 + (i / 12) * Math.PI;
        pts.push({ x: w - r + r * Math.cos(a), y: h / 2 + r * Math.sin(a) });
      }
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI / 2 + (i / 12) * Math.PI;
        pts.push({ x: r + r * Math.cos(a), y: h / 2 + r * Math.sin(a) });
      }
      return pts;
    }
    default:
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  }
}

export function dashArray(dash: Dash, width: number): string | null {
  if (dash === 'dashed') return `${fmt(width * 4)} ${fmt(width * 3)}`;
  if (dash === 'dotted') return `${fmt(Math.max(width, 0.5) * 0.01)} ${fmt(width * 2.4)}`;
  return null;
}

export interface StrokeAttrs {
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  fill: string;
}

export function strokeAttrs(s: StrokeAttrs, esc: (s: string) => string): string {
  const da = dashArray(s.dash, s.strokeWidth);
  return (
    `fill="${esc(s.fill || 'none')}" stroke="${s.strokeWidth > 0 ? esc(s.stroke) : 'none'}" stroke-width="${fmt(s.strokeWidth)}"` +
    ` stroke-linejoin="round"${da ? ` stroke-dasharray="${da}"` : ''}${s.dash === 'dotted' ? ' stroke-linecap="round"' : ''}`
  );
}

/** SVG element for a shape in local coordinates. */
export function shapeElement(kind: ShapeKind, w: number, h: number, attrs: string): string {
  switch (kind) {
    case 'rect':
      return `<rect width="${fmt(w)}" height="${fmt(h)}" ${attrs}/>`;
    case 'roundrect': {
      const r = roundRadius(w, h);
      return `<rect width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(r)}" ${attrs}/>`;
    }
    case 'stadium': {
      const r = Math.min(w, h) / 2;
      return `<rect width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(r)}" ${attrs}/>`;
    }
    case 'ellipse':
      return `<ellipse cx="${fmt(w / 2)}" cy="${fmt(h / 2)}" rx="${fmt(w / 2)}" ry="${fmt(h / 2)}" ${attrs}/>`;
    default:
      return `<polygon points="${shapePolygon(kind, w, h).map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')}" ${attrs}/>`;
  }
}

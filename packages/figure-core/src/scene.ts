/**
 * Layout + SVG generation for every node type, shared by the canvas renderer and every exporter,
 * so what you see on screen is exactly what gets exported.
 */
import type { MathNode, NodeId, Point, Rect, SciNode, SymbolNode } from '@quillon/doc-model';
import { escapeXml, layoutMath, makeSource, SOURCE_NS, type MathSource } from '@quillon/math-core';
import { boundsOf, fmt, inflate, rectPolygon, rotatedBounds, rotatePoint } from './geom';
import { lineGeometry, lineStrokeMarkup, type AttachGeometry } from './lines';
import { imageMarkup } from './image';
import { plotMarkup } from './plot';
import { fontString, layoutRich, type TextMeasurer } from './richtext';
import { shapeElement, shapePolygon, strokeAttrs } from './shapes';
import { getSymbol, symbolMarkup, symbolPorts } from './symbols';

export interface NodeLayout {
  id: NodeId;
  /** Translation of the node's local frame. */
  x: number;
  y: number;
  /** Local box (unrotated). Lines use their route's bounding box. */
  width: number;
  height: number;
  /** Degrees around the local box center. */
  rotation: number;
  /** Rotated content, local coordinates. */
  markup: string;
  /** Unrotated decorations relative to (x, y): equation numbers, symbol and line labels. */
  overlay: string;
  /** Custom hit area (lines); otherwise the local box is used. */
  hit?: string;
  /** World-space bounds of everything drawn. */
  bounds: Rect;
  error?: string;
}

export interface LayoutContext {
  numbers?: Map<NodeId, number>;
  measure?: TextMeasurer;
}

/** Nodes with no visible content (empty equations / blank text) — not exported. */
export function isBlankNode(n: SciNode): boolean {
  if (n.type === 'math') return !n.latex.trim();
  if (n.type === 'text') return !n.text.trim();
  return false;
}

const LABEL_FONT = 'Segoe UI, Roboto, Helvetica, Arial, sans-serif';
const SERIF = 'Times New Roman, serif';

function richBlock(text: string, size: number, color: string, measure: TextMeasurer | undefined, font = LABEL_FONT) {
  return layoutRich(text, { fontSize: size, fontFamily: font, color, align: 'center', measure });
}

function boxLayout(n: SciNode, width: number, height: number, rotation: number, markup: string, overlay = '', extra?: Rect[]): NodeLayout {
  const own = rotatedBounds({ x: n.x, y: n.y, width, height }, rotation);
  const bounds = extra?.length ? boundsOf([own, ...extra].flatMap(rectPolygon)) : own;
  return { id: n.id, x: n.x, y: n.y, width, height, rotation, markup, overlay, bounds };
}

/** Where an outside label goes for a rotated symbol: the side its local "top"/"bottom"/"right" now faces. */
function outsideLabelPos(sym: SymbolNode, side: 'top' | 'bottom' | 'right', lw: number, lh: number): Point {
  const local = side === 'top' ? { x: 0, y: -1 } : side === 'bottom' ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const d = rotatePoint(local, { x: 0, y: 0 }, sym.rotation);
  const b = rotatedBounds({ x: 0, y: 0, width: sym.width, height: sym.height }, sym.rotation);
  const gap = 4;
  if (Math.abs(d.y) >= Math.abs(d.x)) {
    return { x: b.x + b.width / 2 - lw / 2, y: d.y < 0 ? b.y - gap - lh : b.y + b.height + gap };
  }
  return { x: d.x > 0 ? b.x + b.width + gap : b.x - gap - lw, y: b.y + b.height / 2 - lh / 2 };
}

/** A symbol's label box relative to the node origin (unrotated), or null without a label. */
export function symbolLabel(n: SymbolNode, measure?: TextMeasurer): (Rect & { markup: string }) | null {
  const def = getSymbol(n.symbol);
  if (!def || !n.label.trim()) return null;
  const l = richBlock(n.label, n.labelSize, n.stroke, measure, SERIF);
  const side = def.labelAt ?? 'top';
  const p = side === 'center'
    ? { x: n.width / 2 - l.width / 2, y: n.height / 2 - l.height / 2 }
    : outsideLabelPos(n, side, l.width, l.height);
  return { x: p.x, y: p.y, width: l.width, height: l.height, markup: l.markup };
}

export function layoutNode(n: SciNode, ctx: LayoutContext = {}): NodeLayout {
  const { measure } = ctx;
  switch (n.type) {
    case 'math': {
      const l = layoutMath(n.latex, n.display, n.fontSize, n.color);
      const num = ctx.numbers?.get(n.id);
      let overlay = '';
      const extra: Rect[] = [];
      if (num !== undefined) {
        const text = `(${num})`;
        const fs = n.fontSize * 0.8;
        const lx = l.width + n.fontSize * 1.2;
        overlay = `<text x="${fmt(lx)}" y="${fmt(l.height / 2)}" dominant-baseline="central" font-family="${SERIF}" font-size="${fmt(fs)}" fill="${escapeXml(n.color)}">${escapeXml(text)}</text>`;
        extra.push({ x: n.x + lx, y: n.y, width: text.length * fs * 0.5, height: l.height });
      }
      return { ...boxLayout(n, l.width, l.height, 0, l.markup, overlay, extra), error: l.error };
    }
    case 'text': {
      const l = layoutRich(n.text, {
        fontSize: n.fontSize,
        fontFamily: n.fontFamily,
        color: n.color,
        bold: n.bold,
        italic: n.italic,
        align: n.align,
        measure,
      });
      return boxLayout(n, l.width, l.height, 0, l.markup);
    }
    case 'shape': {
      const attrs = strokeAttrs(n, escapeXml);
      let markup = shapeElement(n.shape, n.width, n.height, attrs);
      if (n.label.trim()) {
        const l = richBlock(n.label, n.labelSize, n.labelColor, measure);
        markup += `<g transform="translate(${fmt((n.width - l.width) / 2)} ${fmt((n.height - l.height) / 2)})">${l.markup}</g>`;
      }
      const b = boxLayout(n, n.width, n.height, n.rotation, markup);
      return { ...b, bounds: inflate(b.bounds, n.strokeWidth / 2) };
    }
    case 'symbol': {
      const def = getSymbol(n.symbol);
      if (!def) {
        const markup = `<rect width="${fmt(n.width)}" height="${fmt(n.height)}" fill="#fef2f2" stroke="#ef4444" stroke-dasharray="4 3"/>` +
          `<text x="4" y="${fmt(n.height / 2)}" dominant-baseline="central" font-size="11" fill="#b91c1c">${escapeXml(n.symbol)}</text>`;
        return { ...boxLayout(n, n.width, n.height, n.rotation, markup), error: `Unknown symbol ${n.symbol}` };
      }
      const markup = symbolMarkup({ def, width: n.width, height: n.height, flip: n.flip, stroke: n.stroke, strokeWidth: n.strokeWidth, fill: n.fill });
      let overlay = '';
      const extra: Rect[] = [];
      const lb = symbolLabel(n, measure);
      if (lb) {
        overlay = `<g transform="translate(${fmt(lb.x)} ${fmt(lb.y)})">${lb.markup}</g>`;
        extra.push({ x: n.x + lb.x, y: n.y + lb.y, width: lb.width, height: lb.height });
      }
      const b = boxLayout(n, n.width, n.height, n.rotation, markup, overlay, extra);
      return { ...b, bounds: inflate(b.bounds, n.strokeWidth / 2) };
    }
    case 'plot': {
      const p = plotMarkup(n, measure);
      return { ...boxLayout(n, n.width, n.height, 0, p.markup), error: p.errors[0] };
    }
    case 'image':
      return boxLayout(n, n.width, n.height, 0, imageMarkup(n));
    case 'line': {
      const g = lineGeometry(n);
      let overlay = '';
      const extra: Rect[] = [];
      if (n.label?.trim()) {
        const l = richBlock(n.label, n.labelSize ?? 14, n.stroke, measure);
        const x = g.mid.x - l.width / 2, y = g.mid.y - l.height / 2;
        overlay = `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(l.width)}" height="${fmt(l.height)}" fill="#ffffff"/>` +
          `<g transform="translate(${fmt(x)} ${fmt(y)})">${l.markup}</g>`;
        extra.push({ x: n.x + x, y: n.y + y, width: l.width, height: l.height });
      }
      const local = g.bounds;
      const world = { x: local.x + n.x, y: local.y + n.y, width: local.width, height: local.height };
      const bounds = extra.length ? boundsOf([world, ...extra].flatMap(rectPolygon)) : world;
      return {
        id: n.id,
        x: n.x,
        y: n.y,
        width: local.width,
        height: local.height,
        rotation: 0,
        markup: lineStrokeMarkup(n, g),
        overlay,
        hit: `<path d="${g.hitD}" fill="none" stroke="transparent" stroke-width="${fmt(Math.max(10, n.strokeWidth + 8))}" stroke-linecap="round"/>`,
        bounds,
      };
    }
  }
}

/** Geometry a connector uses to attach to a node (world coordinates). */
export function attachGeometry(n: SciNode, l: NodeLayout): AttachGeometry | null {
  if (n.type === 'line') return null;
  const c = { x: l.x + l.width / 2, y: l.y + l.height / 2 };
  const toWorld = (p: Point) => rotatePoint({ x: p.x + l.x, y: p.y + l.y }, c, l.rotation);
  const local = n.type === 'shape' ? shapePolygon(n.shape, n.width, n.height) : rectPolygon({ x: 0, y: 0, width: l.width, height: l.height });
  const outline = local.map(toWorld);
  let ports: Record<string, Point> | undefined;
  if (n.type === 'symbol') {
    const def = getSymbol(n.symbol);
    if (def?.ports) ports = Object.fromEntries(Object.entries(symbolPorts({ def, width: n.width, height: n.height, flip: n.flip })).map(([k, p]) => [k, toWorld(p)]));
  }
  return { center: c, outline, bounds: boundsOf(outline), ports };
}

/** The `<g>` for one laid-out node, positioned in world coordinates (minus `origin`). */
export function nodeGroup(l: NodeLayout, origin: Point = { x: 0, y: 0 }): string {
  const rot = l.rotation ? `<g transform="rotate(${fmt(l.rotation)} ${fmt(l.width / 2)} ${fmt(l.height / 2)})">${l.markup}</g>` : l.markup;
  return `<g transform="translate(${fmt(l.x - origin.x)} ${fmt(l.y - origin.y)})">${rot}${l.overlay}</g>`;
}

export interface SceneSvgOptions extends LayoutContext {
  padding?: number;
  background?: string | null;
  /** Embedded source for single-equation exports (round-trip). */
  source?: MathSource;
  title?: string;
}

export function sceneBounds(layouts: NodeLayout[]): Rect {
  if (!layouts.length) return { x: 0, y: 0, width: 1, height: 1 };
  return boundsOf(layouts.flatMap((l) => rectPolygon(l.bounds)));
}

/** Render nodes into one standalone SVG document (cropped to content). */
export function sceneToSvg(nodes: SciNode[], opts: SceneSvgOptions = {}): { svg: string; width: number; height: number } {
  const pad = opts.padding ?? 8;
  const layouts = nodes.map((n) => layoutNode(n, opts));
  const b = sceneBounds(layouts);
  const width = Math.ceil(b.width + 2 * pad);
  const height = Math.ceil(b.height + 2 * pad);
  const origin = { x: b.x - pad, y: b.y - pad };
  const body = layouts.map((l) => nodeGroup(l, origin)).join('\n');
  const meta = opts.source
    ? `<metadata><quillon:source xmlns:quillon="${SOURCE_NS}">${escapeXml(JSON.stringify(opts.source))}</quillon:source></metadata>\n`
    : '';
  const title = opts.title ? `<title>${escapeXml(opts.title)}</title>\n` : '';
  const bg = opts.background ? `<rect width="100%" height="100%" fill="${escapeXml(opts.background)}"/>\n` : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
    `${title}${meta}${bg}${body}\n</svg>\n`;
  return { svg, width, height };
}

/** Standalone SVG of a single equation with its editable source embedded. */
export function mathToSvg(n: Pick<MathNode, 'latex' | 'display' | 'fontSize' | 'color'>, padding = 2): { svg: string; width: number; height: number } {
  const node: MathNode = { id: 'x', type: 'math', x: 0, y: 0, numbered: false, ...n };
  return sceneToSvg([node], { padding, source: makeSource(n), title: n.latex });
}

export { fontString };

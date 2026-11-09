/**
 * Layout + SVG generation shared by the canvas renderer and every exporter,
 * so what you see on screen is exactly what gets exported.
 */
import type { MathNode, NodeId, SciNode, TextNode } from '@sciforge/doc-model';
import { latexToSvg, LatexError } from './mathjax';
import { escapeXml, findFirst, localName, parseXml, textContent } from './xml';

export const SOURCE_KEY = 'sciforge';
export const SOURCE_NS = 'https://sciforge.dev/ns/source/1';

/** Editable source embedded in exported PNG/SVG files (round-trip editing). */
export interface MathSource {
  app: 'sciforge';
  v: 1;
  latex: string;
  display: boolean;
  fontSize: number;
  color: string;
}

export function makeSource(n: Pick<MathNode, 'latex' | 'display' | 'fontSize' | 'color'>): MathSource {
  return { app: 'sciforge', v: 1, latex: n.latex, display: n.display, fontSize: n.fontSize, color: n.color };
}

export function parseSource(json: string | undefined | null): MathSource | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    if (o?.app !== 'sciforge' || typeof o.latex !== 'string') return null;
    return {
      app: 'sciforge',
      v: 1,
      latex: o.latex,
      display: o.display !== false,
      fontSize: typeof o.fontSize === 'number' ? o.fontSize : 28,
      color: typeof o.color === 'string' ? o.color : '#000000',
    };
  } catch {
    return null;
  }
}

export interface MathLayout {
  width: number;
  height: number;
  /** Nested <svg> sized in px with color applied, positioned at (0,0). */
  markup: string;
  error?: string;
  /** True for an empty equation (placeholder only; skipped by exporters). */
  empty?: boolean;
}

/** Nodes with no visible content (empty equations / blank text) — not exported. */
export function isBlankNode(n: SciNode): boolean {
  return n.type === 'math' ? !n.latex.trim() : !n.text.trim();
}

const PAD = 0.12; // em of padding around equations so strokes never clip

/** Lay out an equation at a given font size (px per em). */
export function layoutMath(latex: string, display: boolean, fontSize: number, color: string): MathLayout {
  if (!latex.trim()) {
    // Empty equation being edited: a dashed placeholder box.
    const width = fontSize * 2.4;
    const height = fontSize * 1.5;
    return {
      width,
      height,
      empty: true,
      markup: `<rect x="1" y="1" width="${fmt(width - 2)}" height="${fmt(height - 2)}" rx="4" fill="none" stroke="#a5b4fc" stroke-dasharray="4 3"/>`,
    };
  }
  try {
    const r = latexToSvg(latex, display);
    const pad = PAD * fontSize;
    const w = r.widthEm * fontSize;
    const h = r.heightEm * fontSize;
    const markup = r.svg
      .replace(/ style="[^"]*"/, '')
      .replace(/ width="[^"]*"/, ` x="${fmt(pad)}" y="${fmt(pad)}" width="${fmt(w)}"`)
      .replace(/ height="[^"]*"/, ` height="${fmt(h)}"`)
      .replace(/ role="img" focusable="false"/, ' overflow="visible"')
      .replace(/currentColor/g, escapeXml(color));
    return { width: w + 2 * pad, height: h + 2 * pad, markup };
  } catch (e) {
    const msg = e instanceof LatexError ? e.message : String(e);
    const width = Math.max(120, Math.min(600, latex.length * fontSize * 0.5));
    const height = fontSize * 1.6;
    const shown = latex.length > 60 ? latex.slice(0, 57) + '…' : latex || '?';
    const markup =
      `<g><rect width="${width}" height="${height}" rx="4" fill="#fef2f2" stroke="#ef4444" stroke-dasharray="4 3"/>` +
      `<text x="8" y="${height / 2}" dominant-baseline="middle" font-family="Consolas, monospace" font-size="${Math.max(11, fontSize * 0.45)}" fill="#b91c1c">${escapeXml(shown)}</text></g>`;
    return { width, height, markup, error: msg };
  }
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

export type TextMeasurer = (text: string, font: string) => number;

/** Fallback measurer for non-DOM environments (tests, workers). */
export const approxMeasure: TextMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? '16');
  return [...text].length * size * 0.55;
};

export function textFont(n: TextNode): string {
  return `${n.italic ? 'italic ' : ''}${n.bold ? '700 ' : ''}${n.fontSize}px ${n.fontFamily}`;
}

export const TEXT_LINE_HEIGHT = 1.3;

export interface TextLayout {
  width: number;
  height: number;
  markup: string;
}

export function layoutText(n: TextNode, measure: TextMeasurer = approxMeasure): TextLayout {
  const lines = (n.text || ' ').split('\n');
  const font = textFont(n);
  const lh = n.fontSize * TEXT_LINE_HEIGHT;
  const width = Math.max(n.fontSize * 0.5, ...lines.map((l) => measure(l, font))) + 4;
  const height = lines.length * lh;
  const tspans = lines
    .map((l, i) => `<tspan x="2" y="${fmt(i * lh + lh * 0.78)}">${escapeXml(l) || ' '}</tspan>`)
    .join('');
  const markup =
    `<text font-family="${escapeXml(n.fontFamily)}" font-size="${n.fontSize}" fill="${escapeXml(n.color)}"` +
    `${n.bold ? ' font-weight="700"' : ''}${n.italic ? ' font-style="italic"' : ''} xml:space="preserve">${tspans}</text>`;
  return { width, height, markup };
}

export interface NodeLayout {
  id: NodeId;
  x: number;
  y: number;
  width: number;
  height: number;
  markup: string;
  /** Equation number label "(n)" if numbered. */
  label?: { text: string; x: number; y: number; fontSize: number; color: string };
  error?: string;
}

export function layoutNode(n: SciNode, numbers?: Map<NodeId, number>, measure?: TextMeasurer): NodeLayout {
  if (n.type === 'math') {
    const l = layoutMath(n.latex, n.display, n.fontSize, n.color);
    const num = numbers?.get(n.id);
    const label =
      num !== undefined
        ? { text: `(${num})`, x: l.width + n.fontSize * 1.2, y: l.height / 2, fontSize: n.fontSize * 0.8, color: n.color }
        : undefined;
    return { id: n.id, x: n.x, y: n.y, width: l.width, height: l.height, markup: l.markup, label, error: l.error };
  }
  const l = layoutText(n, measure);
  return { id: n.id, x: n.x, y: n.y, width: l.width, height: l.height, markup: l.markup };
}

const labelMarkup = (l: NonNullable<NodeLayout['label']>) =>
  `<text x="${fmt(l.x)}" y="${fmt(l.y)}" dominant-baseline="central" font-family="Times New Roman, serif" font-size="${fmt(l.fontSize)}" fill="${escapeXml(l.color)}">${escapeXml(l.text)}</text>`;

export function labelWidth(l: NonNullable<NodeLayout['label']>): number {
  return l.x - 0 + l.text.length * l.fontSize * 0.5;
}

export interface SceneSvgOptions {
  numbers?: Map<NodeId, number>;
  measure?: TextMeasurer;
  padding?: number;
  background?: string | null;
  /** Embedded source for single-equation exports (round-trip). */
  source?: MathSource;
  title?: string;
}

/** Render nodes into one standalone SVG document (cropped to content). */
export function sceneToSvg(nodes: SciNode[], opts: SceneSvgOptions = {}): { svg: string; width: number; height: number } {
  const pad = opts.padding ?? 8;
  const layouts = nodes.map((n) => layoutNode(n, opts.numbers, opts.measure));
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const l of layouts) {
    x1 = Math.min(x1, l.x);
    y1 = Math.min(y1, l.y);
    x2 = Math.max(x2, l.x + (l.label ? Math.max(l.width, labelWidth(l.label)) : l.width));
    y2 = Math.max(y2, l.y + l.height);
  }
  if (!layouts.length) [x1, y1, x2, y2] = [0, 0, 1, 1];
  const width = Math.ceil(x2 - x1 + 2 * pad);
  const height = Math.ceil(y2 - y1 + 2 * pad);
  const body = layouts
    .map(
      (l) =>
        `<g transform="translate(${fmt(l.x - x1 + pad)} ${fmt(l.y - y1 + pad)})">${l.markup}${l.label ? labelMarkup(l.label) : ''}</g>`,
    )
    .join('\n');
  const meta = opts.source
    ? `<metadata><sciforge:source xmlns:sciforge="${SOURCE_NS}">${escapeXml(JSON.stringify(opts.source))}</sciforge:source></metadata>\n`
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

/** Extract embedded SciForge source from an SVG document, if present. */
export function readSvgSource(svgText: string): MathSource | null {
  try {
    const root = parseXml(svgText);
    const el = findFirst(root, (e) => localName(e) === 'source' && Object.values(e.attrs).includes(SOURCE_NS));
    return el ? parseSource(textContent(el)) : null;
  } catch {
    return null;
  }
}

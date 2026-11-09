/**
 * Equation layout (LaTeX → positioned SVG) and the editable-source metadata embedded in exports.
 * Scene layout for all node types lives in @sciforge/figure-core.
 */
import type { MathNode } from '@sciforge/doc-model';
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

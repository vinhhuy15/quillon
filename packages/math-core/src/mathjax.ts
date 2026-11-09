/**
 * MathJax pipeline: LaTeX → SVG (with inline glyph paths) and LaTeX → MathML.
 * Uses the lite DOM adaptor so it runs identically in the browser, Node and tests.
 */
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor, type LiteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { STATE } from 'mathjax-full/js/core/MathItem.js';
import { SerializedMmlVisitor } from 'mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js';
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
import type { MmlNode } from 'mathjax-full/js/core/MmlTree/MmlNode.js';
import { normalizeLatex } from './latex';

/** Macros for commands emitted by MathLive or commonly used but missing in MathJax. */
export const MACROS: Record<string, string | [string, number]> = {
  differentialD: '\\mathrm{d}',
  capitalDifferentialD: '\\mathrm{D}',
  exponentialE: '\\mathrm{e}',
  imaginaryI: '\\mathrm{i}',
  imaginaryJ: '\\mathrm{j}',
  mleft: '\\left',
  mright: '\\right',
  R: '\\mathbb{R}',
  N: '\\mathbb{N}',
  Z: '\\mathbb{Z}',
  Q: '\\mathbb{Q}',
  C: '\\mathbb{C}',
  dd: '\\mathrm{d}',
  abs: ['\\left|#1\\right|', 1],
  norm: ['\\left\\|#1\\right\\|', 1],
};

// noerrors/noundefined would silently render bad input in red; we want real errors instead.
const PACKAGES = AllPackages.filter(
  (p: string) => !['autoload', 'require', 'bussproofs', 'noerrors', 'noundefined'].includes(p),
);

interface Pipeline {
  adaptor: LiteAdaptor;
  doc: MathDocument<unknown, unknown, unknown>;
  visitor: SerializedMmlVisitor;
}

let pipeline: Pipeline | null = null;

function getPipeline(): Pipeline {
  if (pipeline) return pipeline;
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({ packages: PACKAGES, macros: MACROS, formatError: (_jax: unknown, err: Error) => { throw err; } });
  // fontCache 'none' → every glyph is an inline <path>, so each SVG is fully standalone.
  const svg = new SVG({ fontCache: 'none' });
  const doc = mathjax.document('', { InputJax: tex, OutputJax: svg }) as MathDocument<unknown, unknown, unknown>;
  pipeline = { adaptor, doc, visitor: new SerializedMmlVisitor() };
  return pipeline;
}

export class LatexError extends Error {
  constructor(message: string, readonly latex: string) {
    super(message);
    this.name = 'LatexError';
  }
}

export interface RenderedSvg {
  /** Standalone <svg> markup (viewBox in MathJax units: 1000 = 1em). */
  svg: string;
  /** Size in em. */
  widthEm: number;
  heightEm: number;
  /** Distance from the bottom edge to the baseline, in em. */
  depthEm: number;
}

const svgCache = new Map<string, RenderedSvg>();

export function latexToSvg(latex: string, display = true): RenderedSvg {
  const key = `${display ? 'D' : 'I'}:${latex}`;
  const hit = svgCache.get(key);
  if (hit) return hit;
  const { adaptor, doc } = getPipeline();
  let node;
  try {
    node = doc.convert(normalizeLatex(latex) || '\\,', { display, em: 16, ex: 8, containerWidth: 80 * 16 });
  } catch (e) {
    throw new LatexError((e as Error).message, latex);
  }
  const svgNode = adaptor.firstChild(node as never) as Parameters<LiteAdaptor['outerHTML']>[0];
  let svg = adaptor.outerHTML(svgNode);
  // MathJax renders TeX errors as <g data-mml-node="merror">; surface them as exceptions.
  if (svg.includes('data-mml-node="merror"')) {
    const m = /<title>([^<]*)<\/title>/.exec(svg) ?? /data-mjx-error="([^"]*)"/.exec(svg);
    throw new LatexError(m ? m[1] : 'Invalid LaTeX', latex);
  }
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg);
  const [minX, minY, w, h] = vb ? vb.slice(1).map(Number) : [0, 0, 1000, 1000];
  void minX;
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const result: RenderedSvg = { svg, widthEm: w / 1000, heightEm: h / 1000, depthEm: (h + minY) / 1000 };
  if (svgCache.size > 2000) svgCache.clear();
  svgCache.set(key, result);
  return result;
}

const mmlCache = new Map<string, string>();

/** LaTeX → presentation MathML (`<math>` root with the MathML namespace). */
export function latexToMathML(latex: string, display = true): string {
  const key = `${display ? 'D' : 'I'}:${latex}`;
  const hit = mmlCache.get(key);
  if (hit) return hit;
  const { doc, visitor } = getPipeline();
  let root: MmlNode;
  try {
    root = doc.convert(normalizeLatex(latex) || '', { display, end: STATE.CONVERT }) as MmlNode;
  } catch (e) {
    throw new LatexError((e as Error).message, latex);
  }
  let mml = visitor.visitTree(root);
  if (mml.includes('<merror')) throw new LatexError('Invalid LaTeX', latex);
  mml = mml
    .replace(/ data-[\w-]+="[^"]*"/g, '')
    .replace(/<math([^>]*)>/, (_m, attrs: string) =>
      attrs.includes('xmlns') ? `<math${attrs}>` : `<math xmlns="http://www.w3.org/1998/Math/MathML"${attrs}>`,
    );
  if (mmlCache.size > 2000) mmlCache.clear();
  mmlCache.set(key, mml);
  return mml;
}

/** Returns an error message, or null when the LaTeX is valid. */
export function validateLatex(latex: string): string | null {
  try {
    latexToSvg(latex, true);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

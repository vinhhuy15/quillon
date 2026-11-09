/**
 * TikZ export. Coordinates are written in canvas px with `x=0.75pt, y=-0.75pt`, so the picture has
 * the same size as the on-screen figure at 96 DPI and the y axis points down like on the canvas.
 */
import type { Dash, LineCap, Point, SciNode } from '@quillon/doc-model';
import { toPortableLatex } from '@quillon/math-core';
import { lineGeometry, routePoints, smoothCurve } from './lines';
import { cornerClash, PLOT_FONT, plotGeometry } from './plot';
import { parseSpans } from './richtext';
import { cropOf, hasAdjustments, imageScale, scaleBarGeometry, scaleBarText } from './image';
import { layoutNode, symbolLabel, type LayoutContext } from './scene';
import { roundRadius, shapePolygon } from './shapes';
import { getSymbol, localPrims, type Seg } from './symbols';

const n2 = (v: number) => (Math.round(v * 100) / 100).toString();
const pt = (p: Point) => `(${n2(p.x)},${n2(p.y)})`;

const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω';
const GREEK_NAMES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'o', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'];
const UPPER: Record<string, string> = { Γ: 'Gamma', Δ: 'Delta', Θ: 'Theta', Λ: 'Lambda', Ξ: 'Xi', Π: 'Pi', Σ: 'Sigma', Φ: 'Phi', Ψ: 'Psi', Ω: 'Omega' };
/** Characters pdflatex's utf8 input cannot typeset in text mode. */
const UNICODE: Record<string, string> = {
  '−': '-', '×': '\\times', '±': '\\pm', '·': '\\cdot', '°': '^\\circ', '≤': '\\le', '≥': '\\ge', '≠': '\\ne', '≈': '\\approx',
  '→': '\\to', '←': '\\leftarrow', '∞': '\\infty', '√': '\\surd', 'µ': '\\mu', 'Ω': '\\Omega', '…': '\\ldots',
};

export function texEscape(s: string): string {
  return s.replace(/[\\#$%&_{}~^]|[^\x00-\x7f -ÿ–—‘’“”]/g, (c) => {
    if (c === '\\') return '\\textbackslash{}';
    if (c === '~') return '\\textasciitilde{}';
    if (c === '^') return '\\textasciicircum{}';
    if ('#$%&_{}'.includes(c)) return `\\${c}`;
    const g = GREEK.indexOf(c);
    const math = UNICODE[c] ?? (g >= 0 ? `\\${GREEK_NAMES[g]}` : UPPER[c] ? `\\${UPPER[c]}` : null);
    if (math === '\\ldots') return '\\ldots{}';
    return math ? `\\ensuremath{${math}}` : c;
  });
}

/** Rich text (`$…$` spans, newlines) → LaTeX. */
export function richToLatex(text: string): string {
  return text
    .split('\n')
    .map((line) => parseSpans(line).map((s) => (s.math ? `$${toPortableLatex(s.text)}$` : texEscape(s.text))).join(''))
    .join('\\\\ ');
}

class Colors {
  private map = new Map<string, string>();
  name(c: string): string | null {
    if (!c || c === 'none' || c === 'transparent') return null;
    let hex = c.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(hex)) hex = '#' + [...hex.slice(1)].map((x) => x + x).join('');
    if (!/^#[0-9a-f]{6}$/.test(hex)) return 'black';
    if (hex === '#000000') return 'black';
    if (hex === '#ffffff') return 'white';
    let name = this.map.get(hex);
    if (!name) {
      name = `sf${this.map.size + 1}`;
      this.map.set(hex, name);
    }
    return name;
  }
  defs(): string[] {
    return [...this.map].map(([hex, name]) => `\\definecolor{${name}}{HTML}{${hex.slice(1).toUpperCase()}}`);
  }
}

function dashOpt(dash: Dash, w: number): string | null {
  const lw = w * 0.75;
  if (dash === 'dashed') return `dash pattern=on ${n2(lw * 4)}pt off ${n2(lw * 3)}pt`;
  if (dash === 'dotted') return `line cap=round, dash pattern=on 0pt off ${n2(lw * 2.4)}pt`;
  return null;
}

function fontOpt(px: number, family?: string, bold?: boolean, italic?: boolean): string {
  const size = n2(px * 0.75);
  const fam = !family || /times|serif\b(?!-)|cambria|georgia/i.test(family) && !/sans/i.test(family)
    ? ''
    : /mono|consolas|courier/i.test(family) ? '\\ttfamily' : '\\sffamily';
  return `font=\\fontsize{${size}}{${n2(px * 0.75 * 1.25)}}\\selectfont${fam}${bold ? '\\bfseries' : ''}${italic ? '\\itshape' : ''}`;
}

const ARROW: Record<LineCap, string> = { none: '', arrow: 'Stealth', open: 'Straight Barb', dot: 'Circle', bar: 'Bar' };

function segsToTikz(segs: Seg[], map: (p: Point) => Point = (p) => p): string {
  let out = '';
  for (const s of segs) {
    if (s.c === 'M') out += ` ${pt(map(s.p))}`;
    else if (s.c === 'L') out += ` -- ${pt(map(s.p))}`;
    else if (s.c === 'C') out += ` .. controls ${pt(map(s.c1))} and ${pt(map(s.c2))} .. ${pt(map(s.p))}`;
    else out += ' -- cycle';
  }
  return out.trim();
}

export interface TikzOptions extends LayoutContext {
  /** Wrap in a compilable standalone document (default true). */
  standalone?: boolean;
}

/** File name an embedded image is referenced by in TikZ output (the image is not written into the .tex). */
export function tikzImageFile(n: Extract<SciNode, { type: 'image' }>, index: number): string {
  const ext = /^data:image\/(png|jpeg|webp|gif|svg\+xml|bmp|avif)/.exec(n.src)?.[1] ?? 'png';
  const e = ext === 'jpeg' ? 'jpg' : ext === 'svg+xml' ? 'svg' : ext;
  const base = (n.name ?? '').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || `image-${index}`}.${e}`;
}

/** Export nodes as a TikZ picture. */
export function sceneToTikz(nodes: SciNode[], opts: TikzOptions = {}): string {
  const colors = new Colors();
  const body: string[] = [];
  const emit = (s: string) => body.push(s);
  const style = (o: { stroke?: string; fill?: string; width?: number; dash?: Dash }) => {
    const parts: string[] = [];
    const d = o.stroke !== undefined ? colors.name(o.stroke) : null;
    const f = o.fill !== undefined ? colors.name(o.fill) : null;
    if (o.stroke !== undefined) parts.push(d ? `draw=${d}` : 'draw=none');
    if (f) parts.push(`fill=${f}`);
    if (o.width !== undefined) parts.push(`line width=${n2(o.width * 0.75)}pt`);
    const da = o.dash ? dashOpt(o.dash, o.width ?? 1) : null;
    if (da) parts.push(da);
    return parts.join(', ');
  };
  const nodeAt = (p: Point, text: string, opt: string) => emit(`\\node[${opt}] at ${pt(p)} {${text}};`);
  let images = 0;

  for (const n of nodes) {
    emit(`% ${n.type} ${n.id}`);
    switch (n.type) {
      case 'math': {
        if (!n.latex.trim()) break;
        const l = layoutNode(n, opts);
        const num = opts.numbers?.get(n.id);
        const tex = `$${n.display ? '\\displaystyle ' : ''}${toPortableLatex(n.latex)}$${num !== undefined ? `\\quad(${num})` : ''}`;
        nodeAt({ x: n.x, y: n.y + l.height / 2 }, tex, `anchor=west, inner sep=0pt, ${fontOpt(n.fontSize)}, text=${colors.name(n.color)}`);
        break;
      }
      case 'text': {
        if (!n.text.trim()) break;
        const align = n.align ?? 'left';
        nodeAt({ x: n.x, y: n.y }, richToLatex(n.text), `anchor=north west, inner sep=1pt, align=${align}, ${fontOpt(n.fontSize, n.fontFamily, n.bold, n.italic)}, text=${colors.name(n.color)}`);
        break;
      }
      case 'shape': {
        const c = { x: n.x + n.width / 2, y: n.y + n.height / 2 };
        // TikZ rotates in its own y-up frame, so a clockwise on-screen angle is negative there.
        const rot = n.rotation ? `rotate around={${n2(-n.rotation)}:${pt(c)}}` : '';
        const st = style({ stroke: n.strokeWidth > 0 ? n.stroke : 'none', fill: n.fill, width: n.strokeWidth, dash: n.dash });
        const opt = [st, rot].filter(Boolean).join(', ');
        if (n.shape === 'rect' || n.shape === 'roundrect' || n.shape === 'stadium') {
          const r = n.shape === 'rect' ? 0 : n.shape === 'stadium' ? Math.min(n.width, n.height) / 2 : roundRadius(n.width, n.height);
          emit(`\\path[${opt}${r ? `, rounded corners=${n2(r * 0.75)}pt` : ''}] ${pt({ x: n.x, y: n.y })} rectangle ${pt({ x: n.x + n.width, y: n.y + n.height })};`);
        } else if (n.shape === 'ellipse') {
          emit(`\\path[${opt}] ${pt(c)} ellipse [x radius=${n2(n.width / 2)}, y radius=${n2(n.height / 2)}];`);
        } else {
          const poly = shapePolygon(n.shape, n.width, n.height).map((p) => pt({ x: p.x + n.x, y: p.y + n.y }));
          emit(`\\path[${opt}] ${poly.join(' -- ')} -- cycle;`);
        }
        if (n.label.trim()) {
          nodeAt(c, richToLatex(n.label), `align=center, inner sep=0pt, ${fontOpt(n.labelSize, 'sans')}, text=${colors.name(n.labelColor)}${n.rotation ? `, rotate=${n2(-n.rotation)}` : ''}`);
        }
        break;
      }
      case 'line': {
        const route = routePoints(n).map((p) => ({ x: p.x + n.x, y: p.y + n.y }));
        let path: string;
        if (n.routing === 'curve' && route.length > 2) {
          path = pt(route[0]) + smoothCurve(route).map((c) => ` .. controls ${pt(c.c1)} and ${pt(c.c2)} .. ${pt(c.p)}`).join('');
        } else path = route.map(pt).join(' -- ');
        const len = n2(Math.max(8, n.strokeWidth * 5) * 0.75);
        const head = (cap: LineCap) => (cap === 'none' ? '' : cap === 'dot' || cap === 'bar' ? `{${ARROW[cap]}}` : `{${ARROW[cap]}[length=${len}pt]}`);
        const arrows = n.startCap !== 'none' || n.endCap !== 'none' ? `, arrows={${head(n.startCap)}-${head(n.endCap)}}` : '';
        emit(`\\draw[${style({ stroke: n.stroke, width: n.strokeWidth, dash: n.dash })}${arrows}] ${path};`);
        if (n.label?.trim()) {
          const g = lineGeometry(n);
          nodeAt({ x: g.mid.x + n.x, y: g.mid.y + n.y }, richToLatex(n.label), `fill=white, inner sep=1.5pt, ${fontOpt(n.labelSize ?? 14, 'sans')}, text=${colors.name(n.stroke)}`);
        }
        break;
      }
      case 'symbol': {
        const def = getSymbol(n.symbol);
        if (!def) break;
        const c = { x: n.width / 2, y: n.height / 2 };
        const scope = [`shift={${pt({ x: n.x, y: n.y })}}`, n.rotation ? `rotate around={${n2(-n.rotation)}:${pt(c)}}` : ''].filter(Boolean).join(', ');
        emit(`\\begin{scope}[${scope}]`);
        for (const p of localPrims({ def, width: n.width, height: n.height, flip: n.flip, stroke: n.stroke, strokeWidth: n.strokeWidth, fill: n.fill })) {
          if (p.t === 'path') {
            emit(`  \\path[${style({ stroke: n.stroke, fill: p.fill, width: n.strokeWidth })}, line cap=round] ${segsToTikz(p.segs)};`);
          } else if (p.t === 'ellipse') {
            emit(`  \\path[${style({ stroke: n.stroke, fill: p.fill, width: n.strokeWidth })}] ${pt({ x: p.cx, y: p.cy })} ellipse [x radius=${n2(p.rx)}, y radius=${n2(p.ry)}];`);
          } else {
            emit(`  \\node[inner sep=0pt, ${fontOpt(p.size)}, text=${colors.name(n.stroke)}${n.rotation ? `, rotate=${n2(-n.rotation)}` : ''}] at ${pt({ x: p.x, y: p.y })} {${p.italic ? `\\textit{${texEscape(p.s)}}` : texEscape(p.s)}};`);
          }
        }
        emit('\\end{scope}');
        const lb = symbolLabel(n, opts.measure);
        if (lb) nodeAt({ x: n.x + lb.x + lb.width / 2, y: n.y + lb.y + lb.height / 2 }, richToLatex(n.label), `inner sep=0pt, align=center, ${fontOpt(n.labelSize)}, text=${colors.name(n.stroke)}`);
        break;
      }
      case 'plot':
        emitPlot(n, emit, colors, nodeAt, style);
        break;
      case 'image': {
        images++;
        const file = tikzImageFile(n, images);
        const c = cropOf(n);
        const { sx, sy } = imageScale(n);
        const fw = n.naturalWidth * sx, fh = n.naturalHeight * sy;
        emit(`% image file: ${file}${hasAdjustments(n) ? ' (colour adjustments are not exported; save the adjusted image from Quillon as PNG)' : ''}`);
        emit('\\begin{scope}');
        if (n.crop) emit(`  \\clip ${pt({ x: n.x, y: n.y })} rectangle ${pt({ x: n.x + n.width, y: n.y + n.height })};`);
        const at = { x: n.x - c.x * fw, y: n.y - c.y * fh };
        emit(`  \\node[anchor=north west, inner sep=0pt${n.opacity < 1 ? `, opacity=${n2(n.opacity)}` : ''}] at ${pt(at)} {\\includegraphics[width=${n2(fw * 0.75)}pt, height=${n2(fh * 0.75)}pt]{${file}}};`);
        emit('\\end{scope}');
        if (n.border !== 'none' && n.borderWidth > 0) {
          const h = n.borderWidth / 2;
          emit(`\\draw[${style({ stroke: n.border, width: n.borderWidth })}] ${pt({ x: n.x + h, y: n.y + h })} rectangle ${pt({ x: n.x + n.width - h, y: n.y + n.height - h })};`);
        }
        const b = n.scaleBar;
        if (b) {
          const g = scaleBarGeometry(n, b);
          emit(`\\fill[${colors.name(b.color) ?? 'white'}] ${pt({ x: n.x + g.x, y: n.y + g.y })} rectangle ${pt({ x: n.x + g.x + g.width, y: n.y + g.y + g.thickness })};`);
          if (b.showLabel) nodeAt({ x: n.x + g.x + g.width / 2, y: n.y + g.labelY }, `\\bfseries ${texEscape(scaleBarText(b))}`, `anchor=base, inner sep=0pt, ${fontOpt(g.fontSize, 'sans')}, text=${colors.name(b.color)}`);
        }
        break;
      }
    }
  }

  const picture = [
    '\\begin{tikzpicture}[x=0.75pt, y=-0.75pt, line join=round]',
    ...body.map((l) => `  ${l}`),
    '\\end{tikzpicture}',
  ];
  const defs = colors.defs();
  if (opts.standalone === false) return [...defs, ...picture, ''].join('\n');
  return [
    '% Generated by Quillon 0.4.0 — compile with pdflatex',
    '\\documentclass[tikz,border=4pt]{standalone}',
    '\\usepackage{amsmath,amssymb}',
    ...(images ? ['\\usepackage{graphicx}'] : []),
    '\\usepackage[version=4]{mhchem}',
    '\\usetikzlibrary{arrows.meta}',
    ...defs,
    '\\begin{document}',
    ...picture,
    '\\end{document}',
    '',
  ].join('\n');
}

type Style = (o: { stroke?: string; fill?: string; width?: number; dash?: Dash }) => string;

function emitPlot(
  n: Extract<SciNode, { type: 'plot' }>,
  emit: (s: string) => void,
  colors: Colors,
  nodeAt: (p: Point, text: string, opt: string) => void,
  style: Style,
) {
  const g = plotGeometry(n);
  const o = { x: n.x, y: n.y };
  const w = (p: Point) => ({ x: p.x + o.x, y: p.y + o.y });
  const a = g.area;
  const fs = n.fontSize;
  const font = fontOpt(fs, PLOT_FONT);
  const ink = colors.name('#1f2937');
  if (n.grid) {
    const lines = [
      ...g.ticksX.map((t) => `${pt(w({ x: t.px, y: a.y }))} -- ${pt(w({ x: t.px, y: a.y + a.height }))}`),
      ...g.ticksY.map((t) => `${pt(w({ x: a.x, y: t.px }))} -- ${pt(w({ x: a.x + a.width, y: t.px }))}`),
    ];
    emit(`\\draw[${style({ stroke: '#e5e7eb', width: 1 })}] ${lines.join(' ')};`);
  }
  if (n.axes === 'box') {
    emit(`\\draw[${style({ stroke: '#1f2937', width: 1 })}] ${pt(w({ x: a.x, y: a.y }))} rectangle ${pt(w({ x: a.x + a.width, y: a.y + a.height }))};`);
    const tl = fs * 0.4;
    for (const t of g.ticksX) {
      emit(`\\draw[${style({ stroke: '#1f2937', width: 1 })}] ${pt(w({ x: t.px, y: a.y + a.height }))} -- ++(0,${n2(-tl)});`);
      nodeAt(w({ x: t.px, y: a.y + a.height + fs * 0.9 }), `$${t.label.replace('−', '-')}$`, `inner sep=0pt, ${font}, text=${ink}`);
    }
    const clash = cornerClash(g, fs);
    for (const [i, t] of g.ticksY.entries()) {
      emit(`\\draw[${style({ stroke: '#1f2937', width: 1 })}] ${pt(w({ x: a.x, y: t.px }))} -- ++(${n2(tl)},0);`);
      if (i === 0 && clash) continue;
      nodeAt(w({ x: a.x - fs * 0.4, y: t.px }), `$${t.label.replace('−', '-')}$`, `anchor=east, inner sep=0pt, ${font}, text=${ink}`);
    }
    if (n.xLabel) nodeAt(w({ x: a.x + a.width / 2, y: n.height - fs * 0.2 }), richToLatex(n.xLabel), `anchor=south, inner sep=0pt, ${fontOpt(fs * 1.1, PLOT_FONT)}, text=${ink}`);
    if (n.yLabel) nodeAt(w({ x: fs * 0.2, y: a.y + a.height / 2 }), richToLatex(n.yLabel), `anchor=north, rotate=90, inner sep=0pt, ${fontOpt(fs * 1.1, PLOT_FONT)}, text=${ink}`);
  } else {
    const ax = g.axisX, ay = g.axisY;
    const arrow = `-{Stealth[length=${n2(fs * 0.55 * 0.75)}pt]}`;
    emit(`\\draw[${style({ stroke: '#1f2937', width: 1.1 })}, arrows={${arrow}}] ${pt(w({ x: a.x - fs * 0.4, y: ax }))} -- ${pt(w({ x: a.x + a.width + fs * 0.5, y: ax }))};`);
    emit(`\\draw[${style({ stroke: '#1f2937', width: 1.1 })}, arrows={${arrow}}] ${pt(w({ x: ay, y: a.y + a.height + fs * 0.4 }))} -- ${pt(w({ x: ay, y: a.y - fs * 0.5 }))};`);
    const tl = fs * 0.25;
    for (const t of g.ticksX) {
      if (Math.abs(t.value) < 1e-12 || t.px >= a.x + a.width - fs * 0.8) continue;
      emit(`\\draw[${style({ stroke: '#1f2937', width: 1.1 })}] ${pt(w({ x: t.px, y: ax - tl }))} -- ++(0,${n2(2 * tl)});`);
      nodeAt(w({ x: t.px, y: ax + fs * 0.85 }), `$${t.label.replace('−', '-')}$`, `inner sep=0pt, ${font}, text=${ink}`);
    }
    for (const t of g.ticksY) {
      if (Math.abs(t.value) < 1e-12 || t.px <= a.y + fs * 0.8) continue;
      emit(`\\draw[${style({ stroke: '#1f2937', width: 1.1 })}] ${pt(w({ x: ay - tl, y: t.px }))} -- ++(${n2(2 * tl)},0);`);
      nodeAt(w({ x: ay - fs * 0.45, y: t.px }), `$${t.label.replace('−', '-')}$`, `anchor=east, inner sep=0pt, ${font}, text=${ink}`);
    }
    if (g.originVisible) nodeAt(w({ x: ay - fs * 0.35, y: ax + fs * 0.8 }), '$O$', `anchor=east, inner sep=0pt, ${font}, text=${ink}`);
    if (n.xLabel) nodeAt(w({ x: a.x + a.width + fs * 0.4, y: ax - fs * 0.35 }), richToLatex(n.xLabel), `anchor=south east, inner sep=0pt, ${fontOpt(fs * 1.1, PLOT_FONT)}, text=${ink}`);
    if (n.yLabel) nodeAt(w({ x: ay + fs * 0.45, y: a.y - fs * 0.6 }), richToLatex(n.yLabel), `anchor=north west, inner sep=0pt, ${fontOpt(fs * 1.1, PLOT_FONT)}, text=${ink}`);
  }
  emit('\\begin{scope}');
  emit(`  \\clip ${pt(w({ x: a.x, y: a.y }))} rectangle ${pt(w({ x: a.x + a.width, y: a.y + a.height }))};`);
  for (const c of g.curves) {
    for (const seg of c.segments) {
      const coords = seg.map((p) => pt(w(p))).join(' ');
      emit(`  \\draw[${style({ stroke: c.fn.color, width: c.fn.width, dash: c.fn.dash })}, line cap=round] plot coordinates {${coords}};`);
    }
  }
  emit('\\end{scope}');
}

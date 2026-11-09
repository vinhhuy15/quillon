/**
 * Text with inline math: `The energy $E=mc^2$ is…`. Used by text nodes, shape/symbol labels,
 * line labels and plot legends. `\$` is a literal dollar sign.
 */
import { escapeXml, latexToSvg } from '@sciforge/math-core';
import type { TextAlign } from '@sciforge/doc-model';
import { fmt } from './geom';

export type TextMeasurer = (text: string, font: string) => number;

/** Fallback measurer for non-DOM environments (tests, workers). */
export const approxMeasure: TextMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? '16');
  return [...text].length * size * 0.55;
};

export interface Span {
  math: boolean;
  text: string;
}

/** Split one line into text and `$math$` spans. An unterminated `$` is literal text. */
export function parseSpans(line: string): Span[] {
  const out: Span[] = [];
  let buf = '';
  let i = 0;
  const push = (math: boolean, text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.math === math && !math) last.text += text;
    else out.push({ math, text });
  };
  while (i < line.length) {
    const c = line[i];
    if (c === '\\' && line[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }
    if (c === '$') {
      // find the closing unescaped $
      let j = i + 1;
      while (j < line.length && !(line[j] === '$' && line[j - 1] !== '\\')) j++;
      if (j < line.length && j > i + 1) {
        push(false, buf);
        buf = '';
        push(true, line.slice(i + 1, j));
        i = j + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  push(false, buf);
  return out;
}

export const hasMath = (text: string) => parseSpans(text.replace(/\n/g, ' ')).some((s) => s.math);

export interface RichStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  align?: TextAlign;
  measure?: TextMeasurer;
}

export interface RichLayout {
  width: number;
  height: number;
  markup: string;
  /** Baseline of the first line (for aligning with other text). */
  baseline: number;
}

export const LINE_HEIGHT = 1.3;
// Pure-text lines keep the v0.1 metrics: baseline at 0.78 of a 1.3em line.
const ASC = 0.78 * LINE_HEIGHT;
const DESC = LINE_HEIGHT - ASC;

export function fontString(s: Pick<RichStyle, 'fontSize' | 'fontFamily' | 'bold' | 'italic'>): string {
  return `${s.italic ? 'italic ' : ''}${s.bold ? '700 ' : ''}${s.fontSize}px ${s.fontFamily}`;
}

interface Placed {
  span: Span;
  width: number;
  /** For math: rendered SVG metrics in px. */
  math?: { svg: string; height: number; depth: number };
}

/** Lay out rich text; markup is positioned with its top-left at (0, 0). */
export function layoutRich(text: string, style: RichStyle): RichLayout {
  const fs = style.fontSize;
  const measure = style.measure ?? approxMeasure;
  const font = fontString(style);
  const lines = (text || ' ').split('\n').map((line) => {
    const placed: Placed[] = parseSpans(line).map((span) => {
      if (!span.math) return { span, width: measure(span.text, font) };
      try {
        const r = latexToSvg(span.text, false);
        return { span, width: r.widthEm * fs, math: { svg: r.svg, height: r.heightEm * fs, depth: r.depthEm * fs } };
      } catch {
        // Invalid math shows as its source text, in red.
        return { span: { math: false, text: `$${span.text}$` }, width: measure(`$${span.text}$`, font), error: true } as Placed;
      }
    });
    let asc = fs * ASC, desc = fs * DESC;
    for (const p of placed) {
      if (!p.math) continue;
      asc = Math.max(asc, p.math.height - p.math.depth + fs * 0.12);
      desc = Math.max(desc, p.math.depth + fs * 0.12);
    }
    return { placed, width: placed.reduce((a, p) => a + p.width, 0), asc, desc };
  });
  const width = Math.max(fs * 0.5, ...lines.map((l) => l.width)) + 4;
  const attrs =
    `font-family="${escapeXml(style.fontFamily)}" font-size="${fmt(fs)}" fill="${escapeXml(style.color)}"` +
    `${style.bold ? ' font-weight="700"' : ''}${style.italic ? ' font-style="italic"' : ''}`;
  let y = 0;
  let firstBaseline = 0;
  const parts: string[] = [];
  lines.forEach((l, li) => {
    const base = y + l.asc;
    if (li === 0) firstBaseline = base;
    const align = style.align ?? 'left';
    let x = 2 + (align === 'center' ? (width - 4 - l.width) / 2 : align === 'right' ? width - 4 - l.width : 0);
    const texts: string[] = [];
    for (const p of l.placed) {
      if (p.math) {
        const top = base - (p.math.height - p.math.depth);
        parts.push(
          p.math.svg
            .replace(/ style="[^"]*"/, '')
            .replace(/ width="[^"]*"/, ` x="${fmt(x)}" y="${fmt(top)}" width="${fmt(p.width)}"`)
            .replace(/ height="[^"]*"/, ` height="${fmt(p.math.height)}"`)
            .replace(/ role="img" focusable="false"/, ' overflow="visible"')
            .replace(/currentColor/g, escapeXml(style.color)),
        );
      } else if (p.span.text) {
        const err = (p as Placed & { error?: boolean }).error;
        texts.push(
          `<tspan x="${fmt(x)}" y="${fmt(base)}"${err ? ' fill="#dc2626"' : ''}>${escapeXml(p.span.text)}</tspan>`,
        );
      }
      x += p.width;
    }
    if (texts.length) parts.unshift(`<text ${attrs} xml:space="preserve">${texts.join('')}</text>`);
    y += l.asc + l.desc;
  });
  // Merge all <text> runs into one element for compact output.
  const textRuns = parts.filter((p) => p.startsWith('<text')).map((p) => p.replace(/^<text[^>]*>|<\/text>$/g, ''));
  const others = parts.filter((p) => !p.startsWith('<text'));
  const markup = (textRuns.length ? `<text ${attrs} xml:space="preserve">${textRuns.join('')}</text>` : '') + others.join('');
  return { width, height: y, markup, baseline: firstBaseline };
}

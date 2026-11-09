/**
 * Colour-vision deficiency simulation (Machado, Oliveira & Fernandes 2009, severity 1.0),
 * applied in linear RGB, plus a check for colours that become hard to tell apart.
 */
import type { SciNode } from '@quillon/doc-model';

export type ColorVision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
export const COLOR_VISIONS: ColorVision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];

type M3 = [number, number, number, number, number, number, number, number, number];

const MATRICES: Record<Exclude<ColorVision, 'normal'>, M3> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  achromatopsia: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
};

/** `values` for an SVG feColorMatrix (type="matrix", linearRGB), or null for normal vision. */
export function cvdFilterValues(kind: ColorVision): string | null {
  if (kind === 'normal') return null;
  const m = MATRICES[kind];
  const row = (i: number) => `${m[i * 3]} ${m[i * 3 + 1]} ${m[i * 3 + 2]} 0 0`;
  return `${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0`;
}

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function parseHex(c: string): [number, number, number] | null {
  let h = c.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(h)) h = '#' + [...h.slice(1)].map((x) => x + x).join('');
  if (!/^#[0-9a-f]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255) as [number, number, number];
}

const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');

/** How a colour looks under the given colour vision. */
export function simulateColor(hex: string, kind: ColorVision): string {
  const rgb = parseHex(hex);
  if (!rgb || kind === 'normal') return hex;
  const m = MATRICES[kind];
  const l = rgb.map(toLin);
  const out = [0, 1, 2].map((i) => toSrgb(clamp01(m[i * 3] * l[0] + m[i * 3 + 1] * l[1] + m[i * 3 + 2] * l[2])));
  return toHex(out);
}

/** CIE L*a*b* (D65). */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = (parseHex(hex) ?? [0, 0, 0]).map(toLin);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference. */
export function deltaE(a: string, b: string): number {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Colours that carry meaning in a figure: plot curves, fills, strokes and text. */
export function figureColors(nodes: SciNode[]): string[] {
  const out = new Set<string>();
  const add = (c: string | undefined) => {
    if (c && parseHex(c)) out.add(c.toLowerCase());
  };
  for (const n of nodes) {
    if (n.type === 'plot') n.functions.forEach((f) => add(f.color));
    else if (n.type === 'shape') {
      add(n.fill);
      add(n.stroke);
    } else if (n.type === 'line' || n.type === 'symbol') add(n.stroke);
    else if (n.type === 'math' || n.type === 'text') add(n.color);
  }
  return [...out];
}

/**
 * Pairs of colours that are clearly distinct with normal vision but nearly identical under `kind`.
 * The threshold is CIE76 ΔE; ~10 is "hard to tell apart at a glance" for thin lines.
 */
export function confusablePairs(colors: string[], kind: ColorVision, threshold = 10): [string, string][] {
  if (kind === 'normal') return [];
  const pairs: [string, string][] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i], b = colors[j];
      if (deltaE(a, b) < threshold) continue;
      if (deltaE(simulateColor(a, kind), simulateColor(b, kind)) < threshold) pairs.push([a, b]);
    }
  }
  return pairs;
}

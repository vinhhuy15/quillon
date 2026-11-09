/**
 * Symbol library (circuits, mechanics, optics, lab glassware).
 *
 * Symbols are drawn in their natural size with a tiny vocabulary — paths (absolute M/L/C/A/Z),
 * circles and text — so the same definition renders to SVG and TikZ, scales without distorting
 * stroke widths, and exposes named ports that connectors snap to.
 */
import type { Point } from '@quillon/doc-model';
import { escapeXml } from '@quillon/math-core';
import { fmt } from './geom';

export type SymbolFill = 'none' | 'ink' | 'accent' | 'paper';

export type Prim =
  | { t: 'path'; d: string; fill?: SymbolFill }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: SymbolFill }
  | { t: 'text'; x: number; y: number; s: string; size: number; italic?: boolean };

export type SymbolCategory = 'circuit' | 'mechanics' | 'optics' | 'lab';

export interface SymbolDef {
  id: string;
  name: string;
  category: SymbolCategory;
  w: number;
  h: number;
  prims: Prim[];
  ports?: Record<string, Point>;
  /** Default accent fill for 'accent' primitives. */
  accent?: string;
  /** Where the label goes. */
  labelAt?: 'top' | 'bottom' | 'center' | 'right';
}

export const SYMBOL_CATEGORIES: { id: SymbolCategory; name: string }[] = [
  { id: 'circuit', name: 'Circuits' },
  { id: 'mechanics', name: 'Mechanics' },
  { id: 'optics', name: 'Optics' },
  { id: 'lab', name: 'Lab equipment' },
];

const P = (d: string, fill?: SymbolFill): Prim => ({ t: 'path', d, fill });
const C = (cx: number, cy: number, r: number, fill?: SymbolFill): Prim => ({ t: 'circle', cx, cy, r, fill });
const T = (x: number, y: number, s: string, size = 14, italic = false): Prim => ({ t: 'text', x, y, s, size, italic });

/** Zigzag from (x0,y) to (x1,y) with `n` half-waves of amplitude `a`. */
function zigzag(x0: number, x1: number, y: number, a: number, n: number): string {
  const step = (x1 - x0) / n;
  let d = `L ${x0} ${y}`;
  for (let i = 0; i < n; i++) d += ` L ${fmt(x0 + step * (i + 0.5))} ${i % 2 ? y + a : y - a}`;
  return `${d} L ${x1} ${y}`;
}

/** Diagonal hatch marks below (dir=1) a horizontal line, or left of a vertical one (dir=-1 → 'left'). */
function hatchH(x0: number, x1: number, y: number, len = 8, gap = 8): string {
  let d = '';
  for (let x = x0 + gap; x <= x1 + 0.01; x += gap) d += `M ${fmt(x)} ${y} L ${fmt(x - len)} ${y + len} `;
  return d.trim();
}
function hatchV(y0: number, y1: number, x: number, len = 8, gap = 8): string {
  let d = '';
  for (let y = y0; y <= y1 - gap + 0.01; y += gap) d += `M ${x} ${fmt(y)} L ${x - len} ${fmt(y + len)} `;
  return d.trim();
}

function hatchUp(x0: number, x1: number, y: number, len = 8, gap = 8): string {
  let d = '';
  for (let x = x0 + gap; x <= x1 + 0.01; x += gap) d += `M ${fmt(x)} ${y} L ${fmt(x - len)} ${y - len} `;
  return d.trim();
}
function hatchRight(y0: number, y1: number, x: number, len = 8, gap = 8): string {
  let d = '';
  for (let y = y0; y <= y1 - gap + 0.01; y += gap) d += `M ${x} ${fmt(y)} L ${x + len} ${fmt(y + len)} `;
  return d.trim();
}

const two = (w: number, y: number) => ({ a: { x: 0, y }, b: { x: w, y } });
const circleLeads = (cx: number, cy: number, r: number, w: number) => P(`M 0 ${cy} L ${cx - r} ${cy} M ${cx + r} ${cy} L ${w} ${cy}`);

export const SYMBOLS: SymbolDef[] = [
  // ------------------------------------------------------------ circuits
  {
    id: 'circuit.resistor', name: 'Resistor', category: 'circuit', w: 80, h: 24, labelAt: 'top',
    prims: [P('M 0 12 L 20 12 M 60 12 L 80 12'), P('M 20 4 L 60 4 L 60 20 L 20 20 Z')], ports: two(80, 12),
  },
  {
    id: 'circuit.resistor-us', name: 'Resistor (zigzag)', category: 'circuit', w: 80, h: 24, labelAt: 'top',
    prims: [P(`M 0 12 ${zigzag(18, 62, 12, 8, 6)} L 80 12`)], ports: two(80, 12),
  },
  {
    id: 'circuit.potentiometer', name: 'Variable resistor', category: 'circuit', w: 80, h: 32, labelAt: 'top',
    prims: [P('M 0 18 L 20 18 M 60 18 L 80 18'), P('M 20 10 L 60 10 L 60 26 L 20 26 Z'), P('M 22 30 L 58 4'), P('M 58 4 L 50.5 5.5 L 55 10.5 Z', 'ink')],
    ports: two(80, 18),
  },
  {
    id: 'circuit.capacitor', name: 'Capacitor', category: 'circuit', w: 60, h: 32, labelAt: 'top',
    prims: [P('M 0 16 L 26 16 M 26 2 L 26 30 M 34 2 L 34 30 M 34 16 L 60 16')], ports: two(60, 16),
  },
  {
    id: 'circuit.capacitor-pol', name: 'Polarized capacitor', category: 'circuit', w: 60, h: 32, labelAt: 'top',
    prims: [P('M 0 16 L 26 16 M 26 2 L 26 30 M 34 16 L 60 16'), P('M 38 2 A 24 24 0 0 0 38 30'), T(18, 6, '+', 11)],
    ports: two(60, 16),
  },
  {
    id: 'circuit.inductor', name: 'Inductor', category: 'circuit', w: 80, h: 24, labelAt: 'top',
    prims: [P('M 0 16 L 16 16 A 6 6 0 0 1 28 16 A 6 6 0 0 1 40 16 A 6 6 0 0 1 52 16 A 6 6 0 0 1 64 16 L 80 16')],
    ports: two(80, 16),
  },
  {
    id: 'circuit.battery', name: 'Cell / battery', category: 'circuit', w: 60, h: 36, labelAt: 'top',
    prims: [P('M 0 18 L 26 18 M 26 2 L 26 34 M 34 18 L 60 18'), P('M 33 10 L 36 10 L 36 26 L 33 26 Z', 'ink'), T(19, 7, '+', 11)],
    ports: two(60, 18),
  },
  {
    id: 'circuit.dc-source', name: 'Voltage source', category: 'circuit', w: 64, h: 40, labelAt: 'top',
    prims: [circleLeads(32, 20, 16, 64), C(32, 20, 16), T(25, 20, '+', 12), T(39, 20, '−', 12)], ports: two(64, 20),
  },
  {
    id: 'circuit.ac-source', name: 'AC source', category: 'circuit', w: 64, h: 40, labelAt: 'top',
    prims: [circleLeads(32, 20, 16, 64), C(32, 20, 16), P('M 22 20 C 25 11 29 11 32 20 C 35 29 39 29 42 20')], ports: two(64, 20),
  },
  {
    id: 'circuit.current-source', name: 'Current source', category: 'circuit', w: 64, h: 40, labelAt: 'top',
    prims: [circleLeads(32, 20, 16, 64), C(32, 20, 16), P('M 22 20 L 38 20'), P('M 43 20 L 36 16 L 36 24 Z', 'ink')], ports: two(64, 20),
  },
  {
    id: 'circuit.ammeter', name: 'Ammeter', category: 'circuit', w: 64, h: 40, labelAt: 'top',
    prims: [circleLeads(32, 20, 16, 64), C(32, 20, 16), T(32, 20, 'A', 16)], ports: two(64, 20),
  },
  {
    id: 'circuit.voltmeter', name: 'Voltmeter', category: 'circuit', w: 64, h: 40, labelAt: 'top',
    prims: [circleLeads(32, 20, 16, 64), C(32, 20, 16), T(32, 20, 'V', 16)], ports: two(64, 20),
  },
  {
    id: 'circuit.galvanometer', name: 'Galvanometer', category: 'circuit', w: 64, h: 40, labelAt: 'top',
    prims: [circleLeads(32, 20, 16, 64), C(32, 20, 16), T(32, 20, 'G', 16)], ports: two(64, 20),
  },
  {
    id: 'circuit.lamp', name: 'Lamp', category: 'circuit', w: 60, h: 36, labelAt: 'top',
    prims: [circleLeads(30, 18, 14, 60), C(30, 18, 14), P('M 20.1 8.1 L 39.9 27.9 M 20.1 27.9 L 39.9 8.1')], ports: two(60, 18),
  },
  {
    id: 'circuit.switch', name: 'Switch', category: 'circuit', w: 80, h: 24, labelAt: 'top',
    prims: [P('M 0 18 L 24 18 M 58 18 L 80 18 M 27.5 16.5 L 54 3'), C(26, 18, 2.2, 'paper'), C(56, 18, 2.2, 'paper')], ports: two(80, 18),
  },
  {
    id: 'circuit.diode', name: 'Diode', category: 'circuit', w: 70, h: 28, labelAt: 'top',
    prims: [P('M 0 14 L 24 14 M 42 14 L 70 14 M 42 3 L 42 25'), P('M 24 3 L 24 25 L 42 14 Z', 'ink')], ports: two(70, 14),
  },
  {
    id: 'circuit.led', name: 'LED', category: 'circuit', w: 70, h: 38, labelAt: 'bottom',
    prims: [
      P('M 0 24 L 24 24 M 42 24 L 70 24 M 42 13 L 42 35'), P('M 24 13 L 24 35 L 42 24 Z', 'ink'),
      P('M 34 10 L 41 3 M 41 10 L 48 3'), P('M 42.5 1.5 L 37.6 3.4 L 40.6 6.4 Z', 'ink'), P('M 49.5 1.5 L 44.6 3.4 L 47.6 6.4 Z', 'ink'),
    ],
    ports: two(70, 24),
  },
  {
    id: 'circuit.ground', name: 'Ground', category: 'circuit', w: 30, h: 28,
    prims: [P('M 15 0 L 15 13 M 3 13 L 27 13 M 8 19 L 22 19 M 12 25 L 18 25')], ports: { a: { x: 15, y: 0 } },
  },
  {
    id: 'circuit.opamp', name: 'Op-amp', category: 'circuit', w: 84, h: 64, labelAt: 'top',
    prims: [P('M 16 2 L 16 62 L 72 32 Z'), P('M 0 18 L 16 18 M 0 46 L 16 46 M 72 32 L 84 32'), T(23, 18, '−', 13), T(23, 46, '+', 13)],
    ports: { minus: { x: 0, y: 18 }, plus: { x: 0, y: 46 }, out: { x: 84, y: 32 } },
  },
  {
    id: 'circuit.junction', name: 'Junction', category: 'circuit', w: 8, h: 8,
    prims: [C(4, 4, 3, 'ink')], ports: { c: { x: 4, y: 4 } },
  },
  {
    id: 'circuit.terminal', name: 'Terminal', category: 'circuit', w: 10, h: 10,
    prims: [C(5, 5, 3.5, 'paper')], ports: { c: { x: 5, y: 5 } },
  },

  // ------------------------------------------------------------ mechanics
  {
    id: 'mech.spring', name: 'Spring', category: 'mechanics', w: 100, h: 24, labelAt: 'top',
    prims: [P(`M 0 12 ${zigzag(14, 86, 12, 9, 10)} L 100 12`)], ports: two(100, 12),
  },
  {
    id: 'mech.damper', name: 'Damper', category: 'mechanics', w: 100, h: 30, labelAt: 'top',
    prims: [P('M 0 15 L 40 15 M 62 3 L 40 3 L 40 27 L 62 27 M 52 6 L 52 24 M 52 15 L 100 15')], ports: two(100, 15),
  },
  {
    id: 'mech.mass', name: 'Mass block', category: 'mechanics', w: 60, h: 60, labelAt: 'center', accent: '#e5e7eb',
    prims: [P('M 0 0 L 60 0 L 60 60 L 0 60 Z', 'accent')],
    ports: { left: { x: 0, y: 30 }, right: { x: 60, y: 30 }, top: { x: 30, y: 0 }, bottom: { x: 30, y: 60 } },
  },
  {
    id: 'mech.cart', name: 'Cart', category: 'mechanics', w: 100, h: 60, labelAt: 'center', accent: '#e5e7eb',
    prims: [P('M 0 0 L 100 0 L 100 40 L 0 40 Z', 'accent'), C(22, 49, 10, 'paper'), C(78, 49, 10, 'paper')],
    ports: { left: { x: 0, y: 20 }, right: { x: 100, y: 20 } },
  },
  {
    id: 'mech.ground', name: 'Fixed ground', category: 'mechanics', w: 100, h: 12,
    prims: [P(`M 0 2 L 100 2 ${hatchH(0, 100, 2)}`)],
  },
  {
    id: 'mech.wall', name: 'Wall', category: 'mechanics', w: 12, h: 100,
    prims: [P(`M 10 0 L 10 100 ${hatchV(0, 100, 10)}`)], ports: { a: { x: 10, y: 50 } },
  },
  {
    id: 'mech.ceiling', name: 'Ceiling', category: 'mechanics', w: 100, h: 12,
    prims: [P(`M 0 10 L 100 10 ${hatchUp(0, 100, 10)}`)],
    ports: { a: { x: 50, y: 10 } },
  },
  {
    id: 'mech.pulley', name: 'Pulley', category: 'mechanics', w: 50, h: 60,
    prims: [C(25, 35, 20), C(25, 35, 3, 'ink'), P('M 25 35 L 25 0')],
    ports: { left: { x: 5, y: 35 }, right: { x: 45, y: 35 }, top: { x: 25, y: 0 } },
  },
  {
    id: 'mech.incline', name: 'Inclined plane', category: 'mechanics', w: 120, h: 70, accent: '#f3f4f6',
    prims: [P('M 0 70 L 120 70 L 120 0 Z', 'accent'), P('M 26 70 A 26 26 0 0 0 22.4 56.9')],
  },
  {
    id: 'mech.pin', name: 'Pin support', category: 'mechanics', w: 40, h: 38,
    prims: [P('M 20 6 L 5 28 L 35 28 Z'), P(`M 0 28 L 40 28 ${hatchH(0, 40, 28, 7, 8)}`), C(20, 6, 3.5, 'paper')],
    ports: { a: { x: 20, y: 6 } },
  },
  {
    id: 'mech.roller', name: 'Roller support', category: 'mechanics', w: 40, h: 42,
    prims: [P('M 20 6 L 5 26 L 35 26 Z'), C(11, 30, 4), C(29, 30, 4), P(`M 0 34 L 40 34 ${hatchH(0, 40, 34, 7, 8)}`), C(20, 6, 3.5, 'paper')],
    ports: { a: { x: 20, y: 6 } },
  },
  {
    id: 'mech.pendulum', name: 'Pendulum', category: 'mechanics', w: 60, h: 110, accent: '#e5e7eb',
    prims: [P(`M 0 6 L 60 6 ${hatchUp(0, 60, 6, 6, 8)}`), P('M 30 6 L 30 92'), C(30, 98, 10, 'accent')],
    ports: { bob: { x: 30, y: 98 } },
  },

  // ------------------------------------------------------------ optics
  {
    id: 'optics.convex', name: 'Converging lens', category: 'optics', w: 26, h: 120, accent: '#dbeafe', labelAt: 'top',
    prims: [P('M 13 0 C 27 30 27 90 13 120 C -1 90 -1 30 13 0 Z', 'accent')],
  },
  {
    id: 'optics.concave', name: 'Diverging lens', category: 'optics', w: 30, h: 120, accent: '#dbeafe', labelAt: 'top',
    prims: [P('M 0 0 L 30 0 C 19 30 19 90 30 120 L 0 120 C 11 90 11 30 0 0 Z', 'accent')],
  },
  {
    id: 'optics.lens-thin', name: 'Thin lens (converging)', category: 'optics', w: 20, h: 120, labelAt: 'top',
    prims: [P('M 10 4 L 10 116'), P('M 10 0 L 3 10 L 17 10 Z', 'ink'), P('M 10 120 L 3 110 L 17 110 Z', 'ink')],
  },
  {
    id: 'optics.lens-thin-div', name: 'Thin lens (diverging)', category: 'optics', w: 20, h: 120, labelAt: 'top',
    prims: [P('M 10 0 L 10 120'), P('M 10 10 L 3 0 L 17 0 Z', 'ink'), P('M 10 110 L 3 120 L 17 120 Z', 'ink')],
  },
  {
    id: 'optics.mirror', name: 'Plane mirror', category: 'optics', w: 12, h: 120, labelAt: 'top',
    prims: [P(`M 2 0 L 2 120 ${hatchRight(0, 120, 2)}`)],
  },
  {
    id: 'optics.prism', name: 'Prism', category: 'optics', w: 100, h: 90, accent: '#e0f2fe',
    prims: [P('M 50 0 L 100 90 L 0 90 Z', 'accent')],
  },
  {
    id: 'optics.screen', name: 'Screen', category: 'optics', w: 10, h: 120,
    prims: [P('M 0 0 L 10 0 L 10 120 L 0 120 Z', 'ink')],
  },
  {
    id: 'optics.eye', name: 'Eye', category: 'optics', w: 60, h: 40,
    prims: [P('M 0 20 C 15 2 45 2 60 20 C 45 38 15 38 0 20 Z'), C(30, 20, 9, 'ink')],
  },

  // ------------------------------------------------------------ lab
  {
    id: 'lab.beaker', name: 'Beaker', category: 'lab', w: 60, h: 80, accent: '#dbeafe',
    prims: [P('M 7 40 L 53 40 L 53 76 L 7 76 Z', 'accent'), P('M 0 0 L 6 4 L 6 76 L 54 76 L 54 4 L 60 0')],
  },
  {
    id: 'lab.flask', name: 'Erlenmeyer flask', category: 'lab', w: 60, h: 80, accent: '#dbeafe',
    prims: [P('M 12.5 52 L 47.5 52 L 57 78 L 3 78 Z', 'accent'), P('M 22 0 L 22 24 L 2 78 L 58 78 L 38 24 L 38 0')],
  },
  {
    id: 'lab.test-tube', name: 'Test tube', category: 'lab', w: 20, h: 90, accent: '#dbeafe',
    prims: [P('M 3 50 L 17 50 L 17 80 A 7 7 0 0 1 3 80 Z', 'accent'), P('M 3 0 L 3 80 A 7 7 0 0 0 17 80 L 17 0')],
  },
  {
    id: 'lab.burner', name: 'Burner', category: 'lab', w: 40, h: 80, accent: '#fde68a',
    prims: [P('M 20 4 C 28 16 28 26 20 32 C 12 26 12 16 20 4 Z', 'accent'), P('M 14 36 L 26 36 L 26 70 L 14 70 Z M 4 70 L 36 70 L 36 78 L 4 78 Z')],
  },
];

const byId = new Map(SYMBOLS.map((s) => [s.id, s]));
export const getSymbol = (id: string): SymbolDef | undefined => byId.get(id);

// ------------------------------------------------------------------ path handling

export type Seg =
  | { c: 'M' | 'L'; p: Point }
  | { c: 'C'; c1: Point; c2: Point; p: Point }
  | { c: 'Z' };

/** Parse an absolute M/L/C/A/Z path; arcs are converted to cubic Béziers. */
export function parsePath(d: string): Seg[] {
  const toks = d.match(/[MLCAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: Seg[] = [];
  let i = 0;
  let cmd = '';
  let cur: Point = { x: 0, y: 0 };
  let start: Point = cur;
  const n = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++].toUpperCase();
    if (cmd === 'Z') {
      out.push({ c: 'Z' });
      cur = start;
      continue;
    }
    if (cmd === 'M' || cmd === 'L') {
      const p = { x: n(), y: n() };
      out.push({ c: cmd as 'M' | 'L', p });
      if (cmd === 'M') {
        start = p;
        cmd = 'L';
      }
      cur = p;
    } else if (cmd === 'C') {
      const c1 = { x: n(), y: n() }, c2 = { x: n(), y: n() }, p = { x: n(), y: n() };
      out.push({ c: 'C', c1, c2, p });
      cur = p;
    } else if (cmd === 'A') {
      const rx = n(), ry = n(), rot = n(), large = n(), sweep = n();
      const p = { x: n(), y: n() };
      out.push(...arcToCubics(cur, p, rx, ry, rot, !!large, !!sweep));
      cur = p;
    } else {
      i++; // unknown token
    }
  }
  return out;
}

/** SVG elliptical arc (endpoint form) → cubic Bézier segments. */
function arcToCubics(p0: Point, p1: Point, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean): Seg[] {
  if (!rx || !ry) return [{ c: 'L', p: p1 }];
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry, cy1 = (-k * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0.x + p1.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0.y + p1.y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / segs;
  const kappa = (4 / 3) * Math.tan(step / 4);
  const pt = (t: number) => ({
    x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  });
  const deriv = (t: number) => ({
    x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  });
  const out: Seg[] = [];
  for (let s = 0; s < segs; s++) {
    const a = t1 + s * step, b = a + step;
    const pa = pt(a), pb = s === segs - 1 ? p1 : pt(b);
    const da = deriv(a), db = deriv(b);
    out.push({
      c: 'C',
      c1: { x: pa.x + kappa * da.x, y: pa.y + kappa * da.y },
      c2: { x: pb.x - kappa * db.x, y: pb.y - kappa * db.y },
      p: pb,
    });
  }
  return out;
}

export function mapSegs(segs: Seg[], f: (p: Point) => Point): Seg[] {
  return segs.map((s) => (s.c === 'Z' ? s : s.c === 'C' ? { c: 'C', c1: f(s.c1), c2: f(s.c2), p: f(s.p) } : { c: s.c, p: f(s.p) }));
}

export function segsToSvg(segs: Seg[]): string {
  return segs
    .map((s) => (s.c === 'Z' ? 'Z' : s.c === 'C' ? `C${fmt(s.c1.x)} ${fmt(s.c1.y)} ${fmt(s.c2.x)} ${fmt(s.c2.y)} ${fmt(s.p.x)} ${fmt(s.p.y)}` : `${s.c}${fmt(s.p.x)} ${fmt(s.p.y)}`))
    .join('');
}

// ------------------------------------------------------------------ instances

export interface SymbolInstance {
  def: SymbolDef;
  width: number;
  height: number;
  flip?: boolean;
  stroke: string;
  strokeWidth: number;
  fill: string;
}

/** Maps natural symbol coordinates to the node's local box (scale + optional mirror). */
export function symbolMapper(inst: Pick<SymbolInstance, 'def' | 'width' | 'height' | 'flip'>) {
  const sx = inst.width / inst.def.w, sy = inst.height / inst.def.h;
  return (p: Point): Point => ({ x: inst.flip ? inst.width - p.x * sx : p.x * sx, y: p.y * sy });
}

function fillColor(f: SymbolFill | undefined, inst: SymbolInstance): string {
  if (f === 'ink') return inst.stroke;
  if (f === 'paper') return '#ffffff';
  if (f === 'accent') return inst.fill && inst.fill !== 'none' ? inst.fill : (inst.def.accent ?? 'none');
  return 'none';
}

/** Resolved primitives in local coordinates (shared by the SVG and TikZ writers). */
export type LocalPrim =
  | { t: 'path'; segs: Seg[]; fill: string }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string }
  | { t: 'text'; x: number; y: number; s: string; size: number; italic: boolean };

export function localPrims(inst: SymbolInstance): LocalPrim[] {
  const map = symbolMapper(inst);
  const sx = inst.width / inst.def.w, sy = inst.height / inst.def.h;
  return inst.def.prims.map((p): LocalPrim => {
    if (p.t === 'path') return { t: 'path', segs: mapSegs(parsePath(p.d), map), fill: fillColor(p.fill, inst) };
    if (p.t === 'circle') {
      const c = map({ x: p.cx, y: p.cy });
      return { t: 'ellipse', cx: c.x, cy: c.y, rx: p.r * sx, ry: p.r * sy, fill: fillColor(p.fill, inst) };
    }
    const c = map({ x: p.x, y: p.y });
    return { t: 'text', x: c.x, y: c.y, s: p.s, size: p.size * Math.min(sx, sy), italic: !!p.italic };
  });
}

export function symbolMarkup(inst: SymbolInstance): string {
  const sw = fmt(inst.strokeWidth);
  const st = escapeXml(inst.stroke);
  return localPrims(inst)
    .map((p) => {
      if (p.t === 'path') {
        return `<path d="${segsToSvg(p.segs)}" fill="${escapeXml(p.fill)}" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      if (p.t === 'ellipse') {
        return `<ellipse cx="${fmt(p.cx)}" cy="${fmt(p.cy)}" rx="${fmt(p.rx)}" ry="${fmt(p.ry)}" fill="${escapeXml(p.fill)}" stroke="${st}" stroke-width="${sw}"/>`;
      }
      return `<text x="${fmt(p.x)}" y="${fmt(p.y)}" text-anchor="middle" dominant-baseline="central" font-family="Times New Roman, serif" font-size="${fmt(p.size)}"${p.italic ? ' font-style="italic"' : ''} fill="${st}">${escapeXml(p.s)}</text>`;
    })
    .join('');
}

/** Port positions in local (unrotated) coordinates. */
export function symbolPorts(inst: Pick<SymbolInstance, 'def' | 'width' | 'height' | 'flip'>): Record<string, Point> {
  const map = symbolMapper(inst);
  return Object.fromEntries(Object.entries(inst.def.ports ?? {}).map(([k, p]) => [k, map(p)]));
}

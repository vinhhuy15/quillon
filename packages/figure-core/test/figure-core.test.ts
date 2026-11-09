import { describe, expect, it } from 'vitest';
import {
  addNodes,
  createDocument,
  createLineNode,
  createMathNode,
  createPlotFunction,
  createPlotNode,
  createShapeNode,
  createSymbolNode,
  createTextNode,
  moveNodes,
  parseDocument,
  removeNodes,
  type SciNode,
} from '@sciforge/doc-model';
import { parseXml, readSvgSource } from '@sciforge/math-core';
import {
  attachGeometry,
  compileExpr,
  checkExpr,
  formatTick,
  layoutNode,
  layoutRich,
  lineGeometry,
  mathToSvg,
  niceStep,
  parsePath,
  parseSpans,
  plotGeometry,
  rayExit,
  resolveConnectors,
  richToLatex,
  routePoints,
  sceneToSvg,
  sceneToTikz,
  SYMBOLS,
  SYMBOL_CATEGORIES,
  symbolPorts,
} from '../src';

const L = String.raw;

describe('expressions', () => {
  const ev = (s: string, x = 0) => compileExpr(s)({ x });
  it('follows precedence and implicit multiplication', () => {
    expect(ev('1 + 2*3')).toBe(7);
    expect(ev('2x^2 - 3x + 1', 2)).toBe(3);
    expect(ev('-x^2', 3)).toBe(-9);
    expect(ev('2^3^2')).toBe(512);
    expect(ev('(x+1)(x-1)', 3)).toBe(8);
    expect(ev('2pi')).toBeCloseTo(2 * Math.PI);
    expect(ev('x2', 4)).toBe(8);
    expect(ev('e^-x', 1)).toBeCloseTo(1 / Math.E);
  });
  it('knows functions, constants and abs bars', () => {
    expect(ev('sin x cos x', 1)).toBeCloseTo(Math.sin(1) * Math.cos(1));
    expect(ev('sin^2 x + cos^2 x', 0.7)).toBeCloseTo(1);
    expect(ev('sqrt(16) + |x|', -3)).toBe(7);
    expect(ev('ln e + log 100')).toBe(3);
    expect(ev('max(1, x, 3)', 5)).toBe(5);
    expect(ev('3!')).toBe(6);
    expect(ev('2 × 3 − 1')).toBe(5);
  });
  it('supports theta for polar curves', () => {
    expect(compileExpr('1 + cos(theta)', ['t'])({ t: 0 })).toBe(2);
    expect(compileExpr('θ/π', ['t'])({ t: Math.PI })).toBe(1);
  });
  it('reports errors with positions', () => {
    expect(checkExpr('2 +')).toMatch(/end/);
    expect(checkExpr('foo(x)')).toMatch(/Unknown/);
    expect(checkExpr('y + 1')).toMatch(/Unknown/);
    expect(checkExpr('(x')).toMatch(/\)/);
    expect(checkExpr('')).toMatch(/Empty/);
    expect(checkExpr('x; alert(1)')).toBeTruthy();
  });
});

describe('rich text', () => {
  it('splits inline math', () => {
    expect(parseSpans('Energy $E=mc^2$ here')).toEqual([
      { math: false, text: 'Energy ' },
      { math: true, text: 'E=mc^2' },
      { math: false, text: ' here' },
    ]);
    expect(parseSpans(L`costs \$5 and $x$`)).toEqual([
      { math: false, text: 'costs $5 and ' },
      { math: true, text: 'x' },
    ]);
    expect(parseSpans('a lone $ sign')).toEqual([{ math: false, text: 'a lone $ sign' }]);
  });
  it('lays out text with math taller than plain text', () => {
    const plain = layoutRich('Hello', { fontSize: 20, fontFamily: 'serif', color: '#000' });
    const mixed = layoutRich(L`Area $\dfrac{a}{b}$`, { fontSize: 20, fontFamily: 'serif', color: '#000' });
    expect(plain.height).toBeCloseTo(26);
    expect(mixed.height).toBeGreaterThan(plain.height);
    expect(mixed.markup).toContain('<svg');
    expect(mixed.markup).toContain('Area');
  });
  it('converts to LaTeX for TikZ', () => {
    expect(richToLatex('50% of $x_1$\nline 2')).toBe(L`50\% of $x_1$\\ line 2`);
  });
});

describe('plots', () => {
  it('picks nice ticks', () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(1, 4)).toBe(0.2);
    expect(niceStep(700, 6)).toBe(100);
    expect(formatTick(-2, 1)).toBe('−2');
    expect(formatTick(0.30000000000000004, 0.1)).toBe('0.3');
  });
  it('samples y=f(x) and breaks at asymptotes', () => {
    const p = createPlotNode({ functions: [createPlotFunction({ expr: 'tan(x)' })], xMin: -4, xMax: 4, yMin: -5, yMax: 5 });
    const g = plotGeometry(p);
    expect(g.curves[0].error).toBeUndefined();
    // tan has asymptotes at ±π/2 inside [-4, 4] → 3 pieces
    expect(g.curves[0].segments.length).toBe(3);
    expect(g.originVisible).toBe(true);
  });
  it('samples parametric and polar curves', () => {
    const circle = createPlotFunction({ kind: 'param', expr: 'cos(t)', expr2: 'sin(t)' });
    const cardioid = createPlotFunction({ kind: 'polar', expr: '1 + cos(t)' });
    const p = createPlotNode({ functions: [circle, cardioid], xMin: -3, xMax: 3, yMin: -3, yMax: 3 });
    const g = plotGeometry(p);
    expect(g.curves.every((c) => c.segments.length === 1)).toBe(true);
    const pts = g.curves[0].segments[0];
    const first = pts[0], last = pts[pts.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(0.5);
  });
  it('shows expression errors instead of throwing', () => {
    const p = createPlotNode({ functions: [createPlotFunction({ expr: 'sin(' })] });
    const l = layoutNode(p);
    expect(l.error).toMatch(/sin\(/);
    expect(parseXml(`<svg xmlns="http://www.w3.org/2000/svg">${l.markup}</svg>`).name).toBe('svg');
  });
});

describe('symbols', () => {
  it('has well-formed definitions', () => {
    const ids = new Set<string>();
    for (const s of SYMBOLS) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(SYMBOL_CATEGORIES.some((c) => c.id === s.category)).toBe(true);
      expect(s.id.split('.')[0]).toMatch(/^(circuit|mech|optics|lab)$/);
      for (const p of s.prims) if (p.t === 'path') expect(parsePath(p.d).length).toBeGreaterThan(1);
      for (const port of Object.values(s.ports ?? {})) {
        expect(port.x).toBeGreaterThanOrEqual(0);
        expect(port.x).toBeLessThanOrEqual(s.w);
        expect(port.y).toBeGreaterThanOrEqual(0);
        expect(port.y).toBeLessThanOrEqual(s.h);
      }
      const n = createSymbolNode({ symbol: s.id, width: s.w, height: s.h, label: 'R_1' });
      const l = layoutNode(n);
      expect(l.error).toBeUndefined();
      expect(() => parseXml(`<svg xmlns="http://www.w3.org/2000/svg">${l.markup}${l.overlay}</svg>`)).not.toThrow();
    }
  });
  it('converts arcs to cubic curves', () => {
    const segs = parsePath('M 0 0 A 10 10 0 0 1 20 0');
    expect(segs[0]).toEqual({ c: 'M', p: { x: 0, y: 0 } });
    const last = segs[segs.length - 1];
    expect(last.c).toBe('C');
    if (last.c === 'C') expect(last.p).toEqual({ x: 20, y: 0 });
    // the top of a clockwise (screen) half circle from (0,0) to (20,0) is at y = -10
    const mid = segs[1];
    if (mid.c === 'C') expect(mid.p.y).toBeCloseTo(-10, 5);
  });
  it('scales and mirrors ports', () => {
    const def = SYMBOLS.find((s) => s.id === 'circuit.opamp')!;
    const ports = symbolPorts({ def, width: def.w * 2, height: def.h, flip: true });
    expect(ports.out).toEqual({ x: 0, y: 32 });
    expect(ports.minus.x).toBe(def.w * 2);
  });
});

describe('lines and connectors', () => {
  it('routes elbow lines orthogonally', () => {
    const pts = routePoints({ points: [{ x: 0, y: 0 }, { x: 100, y: 40 }], routing: 'elbow' });
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 40 }]);
  });
  it('pulls the stroke back under arrow heads', () => {
    const l = createLineNode({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], endCap: 'arrow', strokeWidth: 2 });
    const g = lineGeometry(l);
    expect(g.d).toMatch(/L92\.5 0$/);
    expect(g.hitD).toMatch(/L100 0$/);
    expect(g.caps).toContain('<path');
  });
  it('finds where a ray leaves a polygon', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(rayExit(sq, { x: 5, y: 5 }, { x: 50, y: 5 })).toEqual({ x: 10, y: 5 });
  });

  const geo = (n: SciNode) => attachGeometry(n, layoutNode(n));

  it('keeps connectors attached when nodes move, and detaches from deleted nodes', () => {
    const a = createShapeNode({ id: 'a', x: 0, y: 0, width: 100, height: 50 });
    const b = createShapeNode({ id: 'b', x: 300, y: 0, width: 100, height: 50 });
    const c = createLineNode({ id: 'c', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], start: { node: 'a' }, end: { node: 'b' }, endCap: 'arrow' });
    let doc = resolveConnectors(addNodes(createDocument(), [a, b, c]), geo);
    let line = doc.nodes[2] as typeof c;
    expect(line.x).toBeCloseTo(100);
    expect(line.y).toBeCloseTo(25);
    expect(line.points[1].x + line.x).toBeCloseTo(300);
    doc = resolveConnectors(moveNodes(doc, ['b'], 0, 200), geo);
    line = doc.nodes[2] as typeof c;
    const end = { x: line.x + line.points[1].x, y: line.y + line.points[1].y };
    // ends on the boundary of b, which now sits at y=200..250
    expect(end.y).toBeGreaterThanOrEqual(199.9);
    expect(end.y).toBeLessThanOrEqual(250.1);
    // unchanged geometry → same document object
    expect(resolveConnectors(doc, geo)).toBe(doc);
    doc = resolveConnectors(removeNodes(doc, ['a']), geo);
    line = doc.nodes[1] as typeof c;
    expect(line.start).toBeUndefined();
    expect(line.end).toEqual({ node: 'b' });
  });
  it('snaps to symbol ports, following rotation', () => {
    const r = createSymbolNode({ id: 'r', symbol: 'circuit.resistor', x: 0, y: 0, width: 80, height: 24, rotation: 90 });
    const c = createLineNode({ id: 'w', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], start: { node: 'r', port: 'a' } });
    const doc = resolveConnectors(addNodes(createDocument(), [r, c]), geo);
    const line = doc.nodes[1] as typeof c;
    // rotated 90° around (40,12): the left lead end (0,12) moves to (40,-28)
    expect(line.x).toBeCloseTo(40);
    expect(line.y).toBeCloseTo(-28);
  });
  it('detaches a connector dragged on its own', () => {
    const a = createShapeNode({ id: 'a' });
    const c = createLineNode({ id: 'c', start: { node: 'a' } });
    const doc = moveNodes(addNodes(createDocument(), [a, c]), ['c'], 10, 0);
    expect((doc.nodes[1] as typeof c).start).toBeUndefined();
    const both = moveNodes(addNodes(createDocument(), [a, c]), ['a', 'c'], 10, 0);
    expect((both.nodes[1] as typeof c).start).toEqual({ node: 'a' });
  });
});

describe('scene', () => {
  it('lays out every node type with world bounds', () => {
    const nodes: SciNode[] = [
      createShapeNode({ x: 10, y: 10, width: 100, height: 40, rotation: 90, label: 'Start $x$' }),
      createLineNode({ x: 0, y: 0, points: [{ x: 0, y: 0 }, { x: 50, y: 50 }], label: 'yes' }),
      createPlotNode({ x: 200, y: 0 }),
      createSymbolNode({ symbol: 'circuit.battery', x: 0, y: 200, label: '$E$' }),
      createTextNode({ x: 0, y: 300, text: 'Inline $\\alpha$' }),
    ];
    const [shape] = nodes.map((n) => layoutNode(n));
    // rotated 90°: 40 wide, 100 tall around the center (60, 30)
    expect(shape.bounds.width).toBeCloseTo(40 + 1.5, 1);
    expect(shape.bounds.height).toBeCloseTo(100 + 1.5, 1);
    const { svg, width, height } = sceneToSvg(nodes);
    expect(parseXml(svg).name).toBe('svg');
    expect(width).toBeGreaterThan(500);
    expect(height).toBeGreaterThan(300);
    expect(svg).toContain('rotate(90');
    expect(svg).toContain('clip-path');
  });

  it('embeds and reads back equation source in SVG', () => {
    const { svg } = mathToSvg({ latex: L`\alpha<\beta & "q"`, display: true, fontSize: 30, color: '#123456' });
    expect(parseXml(svg).name).toBe('svg');
    const src = readSvgSource(svg);
    expect(src?.latex).toBe(L`\alpha<\beta & "q"`);
    expect(src?.fontSize).toBe(30);
    expect(readSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeNull();
  });

  it('renders a scene with numbers and text', () => {
    const m = createMathNode({ id: 'm', latex: 'E=mc^2', x: 100, y: 50, numbered: true });
    const t = createTextNode({ id: 't', text: 'Line 1\nLine <2>', x: 100, y: 150 });
    const { svg, width, height } = sceneToSvg([m, t], { numbers: new Map([['m', 1]]) });
    expect(parseXml(svg).name).toBe('svg');
    expect(svg).toContain('>(1)</text>');
    expect(svg).toContain('Line &lt;2&gt;');
    expect(width).toBeGreaterThan(50);
    expect(height).toBeGreaterThan(100);
  });
});

describe('TikZ export', () => {
  it('writes a standalone picture for every node type', () => {
    const nodes: SciNode[] = [
      createMathNode({ latex: L`\frac{a}{b}`, x: 0, y: 0, color: '#ff0000' }),
      createTextNode({ text: '100% $x_1$', x: 0, y: 60 }),
      createShapeNode({ shape: 'diamond', x: 100, y: 0, fill: '#fef3c7', label: 'ok?' }),
      createShapeNode({ shape: 'roundrect', x: 100, y: 100, dash: 'dashed', rotation: 30 }),
      createShapeNode({ shape: 'ellipse', x: 300, y: 0 }),
      createLineNode({ x: 0, y: 200, points: [{ x: 0, y: 0 }, { x: 60, y: 40 }, { x: 120, y: 0 }], routing: 'curve', endCap: 'arrow', startCap: 'dot', label: 'f' }),
      createSymbolNode({ symbol: 'circuit.inductor', x: 0, y: 300, rotation: 90, label: 'L' }),
      createPlotNode({ x: 300, y: 200, axes: 'box', legend: true, functions: [createPlotFunction({ expr: 'x^2', label: '$x^2$' })] }),
      createPlotNode({ x: 300, y: 500 }),
    ];
    const tex = sceneToTikz(nodes, { numbers: new Map() });
    expect(tex).toContain('\\documentclass[tikz,border=4pt]{standalone}');
    expect(tex).toContain('\\begin{tikzpicture}[x=0.75pt, y=-0.75pt');
    expect(tex).toContain('$\\displaystyle \\frac{a}{b}$');
    expect(tex).toContain('100\\% $x_1$');
    expect(tex).toContain('arrows={{Circle}-{Stealth[length=');
    // clockwise on screen = negative in TikZ's y-up frame
    expect(tex).toContain('rotate around={-30:');
    expect(tex).toContain('ellipse [x radius=60');
    expect(tex).toContain('plot coordinates');
    expect(tex).toContain('\\definecolor{sf1}{HTML}{FF0000}');
    expect(tex).toContain('.. controls');
    // balanced braces and environments
    let depth = 0;
    for (const ch of tex.replace(/\\[{}]/g, '')) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
    expect(tex.match(/\\begin\{scope\}/g)?.length).toBe(tex.match(/\\end\{scope\}/g)?.length);
    expect(sceneToTikz(nodes, { standalone: false })).not.toContain('documentclass');
  });
});

describe('documents v2', () => {
  it('migrates v1 files and validates new node types', () => {
    const v1 = { schema: 'sciforge/document', version: 1, nodes: [{ type: 'math', id: 'm', latex: 'x', x: 1, y: 2 }] };
    const d = parseDocument(v1);
    expect(d.version).toBe(2);
    expect(d.nodes[0].type).toBe('math');
    const v2 = parseDocument({
      schema: 'sciforge/document',
      version: 2,
      nodes: [
        { type: 'shape', id: 's', shape: 'blob', width: -5, fill: 3 },
        { type: 'line', id: 'l', points: [{ x: 0, y: 0 }] },
        { type: 'line', id: 'l2', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], endCap: 'arrow', start: { node: 's' }, group: 'g1' },
        { type: 'plot', id: 'p', xMin: 5, xMax: 1, functions: [{ expr: 'x' }, { nope: 1 }] },
        { type: 'symbol', id: 'y' },
        { type: 'symbol', id: 'y2', symbol: 'circuit.resistor' },
      ],
    });
    expect(v2.nodes.map((n) => n.id)).toEqual(['s', 'l2', 'p', 'y2']);
    const s = v2.nodes[0];
    if (s.type === 'shape') {
      expect(s.shape).toBe('rect');
      expect(s.width).toBe(1);
      expect(s.fill).toBe('none');
    }
    const l = v2.nodes[1];
    if (l.type === 'line') {
      expect(l.start).toEqual({ node: 's' });
      expect(l.group).toBe('g1');
    }
    const p = v2.nodes[2];
    if (p.type === 'plot') {
      expect(p.xMin).toBe(-6.5);
      expect(p.functions.length).toBe(1);
    }
  });
});

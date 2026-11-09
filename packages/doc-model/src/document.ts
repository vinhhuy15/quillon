import {
  LEGACY_SCHEMA_IDS,
  SCHEMA_ID,
  SCHEMA_VERSION,
  type Binding,
  type Dash,
  type LineCap,
  type LineNode,
  type LineRouting,
  type MathNode,
  type PlotAxes,
  type PlotFunction,
  type PlotKind,
  type PlotNode,
  type Point,
  type SciDocument,
  type SciNode,
  type ShapeKind,
  type ShapeNode,
  type SymbolNode,
  type TextAlign,
  type TextNode,
} from './types';

export const APP_NAME = 'Quillon';
export const APP_VERSION = '0.3.0';

export const DEFAULT_FONT = 'Segoe UI, Roboto, Helvetica, Arial, sans-serif';
export const INK = '#1f2937';

let idCounter = 0;
/** Short unique id; collision-safe enough for a single document. */
export function newId(prefix = 'n'): string {
  idCounter = (idCounter + 1) % 1_000_000;
  const rand = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

export function createDocument(title = 'Untitled'): SciDocument {
  const now = new Date().toISOString();
  return {
    schema: SCHEMA_ID,
    version: SCHEMA_VERSION,
    meta: { title, created: now, modified: now, generator: `${APP_NAME} ${APP_VERSION}` },
    settings: { defaultFontSize: 28, defaultColor: INK },
    nodes: [],
  };
}

/** Optional base fields, only present when set (keeps files small and diffs clean). */
function extras(init: { locked?: boolean; group?: string }) {
  return { ...(init.locked ? { locked: true } : {}), ...(init.group ? { group: init.group } : {}) };
}

export function createMathNode(init: Partial<Omit<MathNode, 'type'>> = {}): MathNode {
  return {
    id: init.id ?? newId('m'),
    type: 'math',
    x: init.x ?? 0,
    y: init.y ?? 0,
    latex: init.latex ?? '',
    fontSize: init.fontSize ?? 28,
    color: init.color ?? INK,
    display: init.display ?? true,
    numbered: init.numbered ?? false,
    ...extras(init),
  };
}

export function createTextNode(init: Partial<Omit<TextNode, 'type'>> = {}): TextNode {
  return {
    id: init.id ?? newId('t'),
    type: 'text',
    x: init.x ?? 0,
    y: init.y ?? 0,
    text: init.text ?? '',
    fontSize: init.fontSize ?? 20,
    color: init.color ?? INK,
    fontFamily: init.fontFamily ?? DEFAULT_FONT,
    bold: init.bold ?? false,
    italic: init.italic ?? false,
    ...(init.align && init.align !== 'left' ? { align: init.align } : {}),
    ...extras(init),
  };
}

export function createShapeNode(init: Partial<Omit<ShapeNode, 'type'>> = {}): ShapeNode {
  return {
    id: init.id ?? newId('s'),
    type: 'shape',
    x: init.x ?? 0,
    y: init.y ?? 0,
    shape: init.shape ?? 'rect',
    width: init.width ?? 120,
    height: init.height ?? 80,
    rotation: init.rotation ?? 0,
    stroke: init.stroke ?? INK,
    strokeWidth: init.strokeWidth ?? 1.5,
    dash: init.dash ?? 'solid',
    fill: init.fill ?? 'none',
    label: init.label ?? '',
    labelSize: init.labelSize ?? 16,
    labelColor: init.labelColor ?? INK,
    ...extras(init),
  };
}

export function createLineNode(init: Partial<Omit<LineNode, 'type'>> = {}): LineNode {
  const points = init.points && init.points.length >= 2 ? init.points : [{ x: 0, y: 0 }, { x: 120, y: 0 }];
  return {
    id: init.id ?? newId('l'),
    type: 'line',
    x: init.x ?? 0,
    y: init.y ?? 0,
    points,
    stroke: init.stroke ?? INK,
    strokeWidth: init.strokeWidth ?? 1.5,
    dash: init.dash ?? 'solid',
    startCap: init.startCap ?? 'none',
    endCap: init.endCap ?? 'none',
    routing: init.routing ?? 'straight',
    ...(init.start ? { start: init.start } : {}),
    ...(init.end ? { end: init.end } : {}),
    ...(init.label ? { label: init.label, labelSize: init.labelSize ?? 14 } : {}),
    ...extras(init),
  };
}

export function createPlotFunction(init: Partial<PlotFunction> = {}): PlotFunction {
  const kind = init.kind ?? 'y';
  return {
    id: init.id ?? newId('f'),
    kind,
    expr: init.expr ?? (kind === 'param' ? 'cos(t)' : kind === 'polar' ? '1 + cos(t)' : 'sin(x)'),
    ...(kind === 'param' ? { expr2: init.expr2 ?? 'sin(t)' } : {}),
    ...(kind !== 'y' ? { tMin: init.tMin ?? 0, tMax: init.tMax ?? 2 * Math.PI } : {}),
    color: init.color ?? '#2563eb',
    width: init.width ?? 2,
    dash: init.dash ?? 'solid',
    ...(init.label ? { label: init.label } : {}),
  };
}

export function createPlotNode(init: Partial<Omit<PlotNode, 'type'>> = {}): PlotNode {
  return {
    id: init.id ?? newId('p'),
    type: 'plot',
    x: init.x ?? 0,
    y: init.y ?? 0,
    width: init.width ?? 360,
    height: init.height ?? 260,
    xMin: init.xMin ?? -6.5,
    xMax: init.xMax ?? 6.5,
    yMin: init.yMin ?? -2,
    yMax: init.yMax ?? 2,
    functions: init.functions ?? [createPlotFunction()],
    axes: init.axes ?? 'cross',
    grid: init.grid ?? true,
    xLabel: init.xLabel ?? '$x$',
    yLabel: init.yLabel ?? '$y$',
    fontSize: init.fontSize ?? 13,
    legend: init.legend ?? false,
    ...extras(init),
  };
}

export function createSymbolNode(init: Partial<Omit<SymbolNode, 'type'>> & { symbol: string }): SymbolNode {
  return {
    id: init.id ?? newId('y'),
    type: 'symbol',
    x: init.x ?? 0,
    y: init.y ?? 0,
    symbol: init.symbol,
    width: init.width ?? 80,
    height: init.height ?? 40,
    rotation: init.rotation ?? 0,
    ...(init.flip ? { flip: true } : {}),
    stroke: init.stroke ?? INK,
    strokeWidth: init.strokeWidth ?? 1.5,
    fill: init.fill ?? 'none',
    label: init.label ?? '',
    labelSize: init.labelSize ?? 14,
    ...extras(init),
  };
}

export class DocumentFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentFormatError';
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const pos = (v: unknown, d: number, min = 1) => Math.max(min, num(v, d));
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

const DASHES: readonly Dash[] = ['solid', 'dashed', 'dotted'];
const SHAPES: readonly ShapeKind[] = ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'parallelogram', 'hexagon', 'stadium'];
const CAPS: readonly LineCap[] = ['none', 'arrow', 'open', 'dot', 'bar'];
const ROUTINGS: readonly LineRouting[] = ['straight', 'elbow', 'curve'];
const PLOT_KINDS: readonly PlotKind[] = ['y', 'param', 'polar'];
const AXES: readonly PlotAxes[] = ['cross', 'box'];
const ALIGNS: readonly TextAlign[] = ['left', 'center', 'right'];

function point(v: unknown): Point | null {
  return isObj(v) && typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y)
    ? { x: v.x, y: v.y }
    : null;
}

function binding(v: unknown): Binding | undefined {
  if (!isObj(v) || typeof v.node !== 'string' || !v.node) return undefined;
  return typeof v.port === 'string' && v.port ? { node: v.node, port: v.port } : { node: v.node };
}

function plotFunction(v: unknown): PlotFunction | null {
  if (!isObj(v) || typeof v.expr !== 'string') return null;
  return createPlotFunction({
    id: str(v.id, '') || undefined,
    kind: oneOf(v.kind, PLOT_KINDS, 'y'),
    expr: v.expr,
    expr2: typeof v.expr2 === 'string' ? v.expr2 : undefined,
    tMin: typeof v.tMin === 'number' ? v.tMin : undefined,
    tMax: typeof v.tMax === 'number' ? v.tMax : undefined,
    color: str(v.color, '#2563eb'),
    width: pos(v.width, 2, 0.1),
    dash: oneOf(v.dash, DASHES, 'solid'),
    label: typeof v.label === 'string' ? v.label : undefined,
  });
}

function normalizeNode(raw: unknown, seen: Set<string>): SciNode | null {
  if (!isObj(raw)) return null;
  let id = str(raw.id, '');
  if (!id || seen.has(id)) id = newId();
  seen.add(id);
  const base = {
    id,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    locked: bool(raw.locked, false),
    group: typeof raw.group === 'string' && raw.group ? raw.group : undefined,
  };
  switch (raw.type) {
    case 'math':
      return createMathNode({
        ...base,
        latex: str(raw.latex, ''),
        fontSize: pos(raw.fontSize, 28),
        color: str(raw.color, INK),
        display: bool(raw.display, true),
        numbered: bool(raw.numbered, false),
      });
    case 'text':
      return createTextNode({
        ...base,
        text: str(raw.text, ''),
        fontSize: pos(raw.fontSize, 20),
        color: str(raw.color, INK),
        fontFamily: str(raw.fontFamily, DEFAULT_FONT),
        bold: bool(raw.bold, false),
        italic: bool(raw.italic, false),
        align: oneOf(raw.align, ALIGNS, 'left'),
      });
    case 'shape':
      return createShapeNode({
        ...base,
        shape: oneOf(raw.shape, SHAPES, 'rect'),
        width: pos(raw.width, 120),
        height: pos(raw.height, 80),
        rotation: num(raw.rotation, 0),
        stroke: str(raw.stroke, INK),
        strokeWidth: pos(raw.strokeWidth, 1.5, 0),
        dash: oneOf(raw.dash, DASHES, 'solid'),
        fill: str(raw.fill, 'none'),
        label: str(raw.label, ''),
        labelSize: pos(raw.labelSize, 16),
        labelColor: str(raw.labelColor, INK),
      });
    case 'line': {
      const points = Array.isArray(raw.points) ? raw.points.map(point).filter((p): p is Point => p !== null) : [];
      if (points.length < 2) return null;
      return createLineNode({
        ...base,
        points,
        stroke: str(raw.stroke, INK),
        strokeWidth: pos(raw.strokeWidth, 1.5, 0.1),
        dash: oneOf(raw.dash, DASHES, 'solid'),
        startCap: oneOf(raw.startCap, CAPS, 'none'),
        endCap: oneOf(raw.endCap, CAPS, 'none'),
        routing: oneOf(raw.routing, ROUTINGS, 'straight'),
        start: binding(raw.start),
        end: binding(raw.end),
        label: typeof raw.label === 'string' ? raw.label : undefined,
        labelSize: typeof raw.labelSize === 'number' ? raw.labelSize : undefined,
      });
    }
    case 'plot': {
      const xMin = num(raw.xMin, -6.5), xMax = num(raw.xMax, 6.5);
      const yMin = num(raw.yMin, -2), yMax = num(raw.yMax, 2);
      return createPlotNode({
        ...base,
        width: pos(raw.width, 360, 40),
        height: pos(raw.height, 260, 40),
        // Degenerate ranges would divide by zero; fall back to the defaults.
        ...(xMax > xMin ? { xMin, xMax } : {}),
        ...(yMax > yMin ? { yMin, yMax } : {}),
        functions: Array.isArray(raw.functions)
          ? raw.functions.map(plotFunction).filter((f): f is PlotFunction => f !== null)
          : [],
        axes: oneOf(raw.axes, AXES, 'cross'),
        grid: bool(raw.grid, true),
        xLabel: str(raw.xLabel, '$x$'),
        yLabel: str(raw.yLabel, '$y$'),
        fontSize: pos(raw.fontSize, 13),
        legend: bool(raw.legend, false),
      });
    }
    case 'symbol':
      if (typeof raw.symbol !== 'string' || !raw.symbol) return null;
      return createSymbolNode({
        ...base,
        symbol: raw.symbol,
        width: pos(raw.width, 80),
        height: pos(raw.height, 40),
        rotation: num(raw.rotation, 0),
        flip: bool(raw.flip, false),
        stroke: str(raw.stroke, INK),
        strokeWidth: pos(raw.strokeWidth, 1.5, 0.1),
        fill: str(raw.fill, 'none'),
        label: str(raw.label, ''),
        labelSize: pos(raw.labelSize, 14),
      });
  }
  // Unknown node types (from a newer version) are dropped rather than crashing.
  return null;
}

/**
 * Validate an untrusted parsed JSON value and return a well-formed document.
 * Applies migrations for older schema versions.
 */
export function parseDocument(raw: unknown): SciDocument {
  if (!isObj(raw)) throw new DocumentFormatError('Document is not a JSON object');
  if (raw.schema !== SCHEMA_ID && !LEGACY_SCHEMA_IDS.includes(raw.schema as string)) {
    throw new DocumentFormatError('Not a Quillon document');
  }
  const version = num(raw.version, 0);
  if (version < 1) throw new DocumentFormatError(`Unsupported document version ${version}`);
  if (version > SCHEMA_VERSION) {
    throw new DocumentFormatError(
      `This file was made with a newer Quillon (format v${version}); please update the app.`,
    );
  }
  const migrated = migrate(raw, version);
  const base = createDocument();
  const meta = isObj(migrated.meta) ? migrated.meta : {};
  const settings = isObj(migrated.settings) ? migrated.settings : {};
  const seen = new Set<string>();
  const nodes = Array.isArray(migrated.nodes)
    ? migrated.nodes.map((n) => normalizeNode(n, seen)).filter((n): n is SciNode => n !== null)
    : [];
  return {
    schema: SCHEMA_ID,
    version: SCHEMA_VERSION,
    meta: {
      title: str(meta.title, base.meta.title),
      created: str(meta.created, base.meta.created),
      modified: str(meta.modified, base.meta.modified),
      generator: str(meta.generator, base.meta.generator),
    },
    settings: {
      defaultFontSize: num(settings.defaultFontSize, base.settings.defaultFontSize),
      defaultColor: str(settings.defaultColor, base.settings.defaultColor),
    },
    nodes,
  };
}

/** Schema migrations: each step upgrades `version` → `version + 1`. */
function migrate(raw: Record<string, unknown>, version: number): Record<string, unknown> {
  let doc = raw;
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new DocumentFormatError(`No migration from v${v}`);
    doc = step(doc);
  }
  return doc;
}

const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  // v2 only adds node types and optional fields; v1 documents are valid as-is.
  1: (d) => ({ ...d, version: 2 }),
};

export function serializeDocument(doc: SciDocument): string {
  return JSON.stringify(doc, null, 2);
}

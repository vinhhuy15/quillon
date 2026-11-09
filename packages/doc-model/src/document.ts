import {
  SCHEMA_ID,
  SCHEMA_VERSION,
  type MathNode,
  type SciDocument,
  type SciNode,
  type TextNode,
} from './types';

export const APP_NAME = 'SciForge';
export const APP_VERSION = '0.1.0';

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
    settings: { defaultFontSize: 28, defaultColor: '#1f2937' },
    nodes: [],
  };
}

export function createMathNode(init: Partial<Omit<MathNode, 'type'>> = {}): MathNode {
  return {
    id: init.id ?? newId('m'),
    type: 'math',
    x: init.x ?? 0,
    y: init.y ?? 0,
    latex: init.latex ?? '',
    fontSize: init.fontSize ?? 28,
    color: init.color ?? '#1f2937',
    display: init.display ?? true,
    numbered: init.numbered ?? false,
    ...(init.locked ? { locked: true } : {}),
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
    color: init.color ?? '#1f2937',
    fontFamily: init.fontFamily ?? 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    bold: init.bold ?? false,
    italic: init.italic ?? false,
    ...(init.locked ? { locked: true } : {}),
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

function normalizeNode(raw: unknown, seen: Set<string>): SciNode | null {
  if (!isObj(raw)) return null;
  let id = str(raw.id, '');
  if (!id || seen.has(id)) id = newId();
  seen.add(id);
  const base = { id, x: num(raw.x, 0), y: num(raw.y, 0), locked: bool(raw.locked, false) };
  if (raw.type === 'math') {
    return createMathNode({
      ...base,
      latex: str(raw.latex, ''),
      fontSize: num(raw.fontSize, 28),
      color: str(raw.color, '#1f2937'),
      display: bool(raw.display, true),
      numbered: bool(raw.numbered, false),
    });
  }
  if (raw.type === 'text') {
    return createTextNode({
      ...base,
      text: str(raw.text, ''),
      fontSize: num(raw.fontSize, 20),
      color: str(raw.color, '#1f2937'),
      fontFamily: str(raw.fontFamily, 'Segoe UI, Roboto, Helvetica, Arial, sans-serif'),
      bold: bool(raw.bold, false),
      italic: bool(raw.italic, false),
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
  if (raw.schema !== SCHEMA_ID) throw new DocumentFormatError('Not a SciForge document');
  const version = num(raw.version, 0);
  if (version < 1) throw new DocumentFormatError(`Unsupported document version ${version}`);
  if (version > SCHEMA_VERSION) {
    throw new DocumentFormatError(
      `This file was made with a newer SciForge (format v${version}); please update the app.`,
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

const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {};

export function serializeDocument(doc: SciDocument): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * App-level commands, shared by toolbar, menus, keyboard shortcuts and panels.
 */
import {
  addNodes,
  createDocument,
  createLineNode,
  createMathNode,
  createPlotNode,
  createShapeNode,
  createSymbolNode,
  createTextNode,
  decodeSci,
  encodeSci,
  expandGroups,
  groupNodes,
  moveNodes,
  newId,
  rectsIntersect,
  removeNodes,
  reorderNodes,
  ungroupNodes,
  updateNodes,
  type LineNode,
  type MathNode,
  type NodePatch,
  type Point,
  type Rect,
  type SciDocument,
  type SciNode,
  type ShapeKind,
} from '@sciforge/doc-model';
import {
  buildDocx,
  getPngTexts,
  isPng,
  latexToMathML,
  latexToOmml,
  looksLikeLatex,
  makeSource,
  normalizeLatex,
  parseSource,
  readSvgSource,
  setPngText,
  SOURCE_KEY,
  toPortableLatex,
  wordClipboardHtml,
  type DocxBlock,
  type MathSource,
} from '@sciforge/math-core';
import { boundsOf, getSymbol, inflate, isBlankNode, mathToSvg, rectPolygon, richToLatex, sceneToSvg, sceneToTikz } from '@sciforge/figure-core';
import { t } from './i18n';
import { getNumbers, measureText, nodeBounds } from './layout';
import { FILTERS, openFile, saveFile, type FileFilter } from './platform';
import { editor, toast, ui } from './state/store';

const VERSION = '0.2.0';

// ------------------------------------------------------------------ viewport

export const viewport = { width: 800, height: 600 };
/** Last pointer position over the canvas, in canvas coordinates (null when outside). */
export const pointer: { current: Point | null } = { current: null };

export function viewCenter(): Point {
  const { zoom, panX, panY } = ui.get();
  return { x: (viewport.width / 2 - panX) / zoom, y: (viewport.height / 2 - panY) / zoom };
}

export function zoomAt(factor: number, sx = viewport.width / 2, sy = viewport.height / 2) {
  const { zoom, panX, panY } = ui.get();
  const z = Math.min(8, Math.max(0.1, zoom * factor));
  // Keep the canvas point under (sx, sy) fixed.
  ui.set({ zoom: z, panX: sx - ((sx - panX) / zoom) * z, panY: sy - ((sy - panY) / zoom) * z });
}

export function zoomReset() {
  zoomAt(1 / ui.get().zoom);
}

export function zoomFit() {
  const doc = editor.doc;
  if (!doc.nodes.length) return ui.set({ zoom: 1, panX: 80, panY: 60 });
  const b = boundsOf(doc.nodes.flatMap((n) => rectPolygon(nodeBounds(n, doc))));
  const margin = 48;
  const z = Math.min(2, Math.max(0.1, Math.min((viewport.width - 2 * margin) / (b.width || 1), (viewport.height - 2 * margin) / (b.height || 1))));
  ui.set({
    zoom: z,
    panX: (viewport.width - b.width * z) / 2 - b.x * z,
    panY: (viewport.height - b.height * z) / 2 - b.y * z,
  });
}

// ------------------------------------------------------------------ helpers

export const readingOrder = <T extends SciNode>(nodes: T[]) =>
  nodes.slice().sort((a, b) => (Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x));

export function selectedNodes(): SciNode[] {
  const sel = new Set(editor.selection);
  return editor.doc.nodes.filter((n) => sel.has(n.id));
}

/** Select nodes, pulling in the rest of any group they belong to. */
export function selectNodes(ids: string[]) {
  editor.select(expandGroups(editor.doc, ids));
}

/** Remove an equation or text box that was created but left empty. */
export function dropIfEmpty(id: string | null) {
  const n = id ? editor.doc.nodes.find((x) => x.id === id) : undefined;
  if (n && isBlankNode(n)) {
    editor.seal();
    editor.apply('Remove empty', (d) => removeNodes(d, [n.id]));
  }
}

/** The equation commands like "Copy for Word" act on. */
export function targetMath(): MathNode | null {
  const sel = selectedNodes().filter((n): n is MathNode => n.type === 'math');
  if (sel.length >= 1) return sel[0];
  const id = ui.get().activeMathId;
  const n = id ? editor.doc.nodes.find((x) => x.id === id) : undefined;
  return n?.type === 'math' ? n : null;
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export const snapValue = (v: number) => (ui.get().snap ? Math.round(v / 10) * 10 : Math.round(v));

/** Nudge a spot away from nodes that already sit exactly there, so repeated inserts don't stack. */
function freeSpot(p: Point): Point {
  let q = { x: Math.round(p.x), y: Math.round(p.y) };
  for (let i = 0; i < 30 && editor.doc.nodes.some((n) => Math.abs(n.x - q.x) < 6 && Math.abs(n.y - q.y) < 6); i++) {
    q = { x: q.x + 24, y: q.y + 24 };
  }
  return q;
}

function insert(label: string, nodes: SciNode[]) {
  editor.seal();
  editor.apply(label, (d) => addNodes(d, nodes), { select: nodes.map((n) => n.id) });
  editor.seal();
}

// ------------------------------------------------------------------ create

export function addMath(latex = '', at?: Point, extra: Partial<MathNode> = {}): MathNode {
  const pos = at ?? freeSpot({ x: viewCenter().x - 60, y: viewCenter().y - 20 });
  const s = editor.doc.settings;
  const node = createMathNode({ latex, x: Math.round(pos.x), y: Math.round(pos.y), fontSize: s.defaultFontSize, color: s.defaultColor, ...extra });
  editor.seal();
  editor.apply('Add equation', (d) => addNodes(d, [node]), { select: [node.id] });
  ui.set((u) => ({ activeMathId: node.id, editingTextId: null, dockOpen: true, focusEditorTick: u.focusEditorTick + 1 }));
  return node;
}

export function addText(at?: Point, text = '') {
  const pos = at ?? freeSpot(viewCenter());
  const node = createTextNode({ x: Math.round(pos.x), y: Math.round(pos.y), text });
  editor.seal();
  editor.apply('Add text', (d) => addNodes(d, [node]), { select: [node.id] });
  ui.set({ editingTextId: node.id });
}

export function addShape(shape: ShapeKind, r?: Rect) {
  const c = viewCenter();
  const box = r ?? { ...freeSpot({ x: c.x - 60, y: c.y - 40 }), width: 120, height: shape === 'ellipse' || shape === 'diamond' ? 90 : 80 };
  const node = createShapeNode({ shape, x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) });
  insert('Add shape', [node]);
  return node;
}

export function addLine(abs: Point[], opts: Partial<LineNode> = {}) {
  const [p0] = abs;
  const node = createLineNode({ ...opts, x: p0.x, y: p0.y, points: abs.map((p) => ({ x: p.x - p0.x, y: p.y - p0.y })) });
  insert(opts.endCap === 'arrow' ? 'Add arrow' : 'Add line', [node]);
  return node;
}

export function addPlot(r?: Rect) {
  const c = viewCenter();
  const box = r ?? { ...freeSpot({ x: c.x - 180, y: c.y - 130 }), width: 360, height: 260 };
  const node = createPlotNode({ x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) });
  insert('Add plot', [node]);
  return node;
}

export function addSymbol(id: string, at?: Point) {
  const def = getSymbol(id);
  if (!def) return;
  const c = viewCenter();
  const p = at ? { x: at.x - def.w / 2, y: at.y - def.h / 2 } : freeSpot({ x: c.x - def.w / 2, y: c.y - def.h / 2 });
  insert('Add symbol', [createSymbolNode({ symbol: id, x: Math.round(p.x), y: Math.round(p.y), width: def.w, height: def.h })]);
}

/** Insert a template: into the equation being edited, or as a new equation. */
export function insertTemplate(latex: string, at?: Point) {
  const ins = editorInsertHook.current;
  if (!at && ins && ui.get().activeMathId && ins(latex)) return;
  addMath(latex, at);
}

/** Set by the EquationEditor so other UI can insert at the caret. */
export const editorInsertHook: { current: ((latex: string) => boolean) | null } = { current: null };

// ------------------------------------------------------------------ edit

export function patchNodes(label: string, patches: Record<string, NodePatch>, coalesce?: string) {
  editor.apply(label, (d) => updateNodes(d, patches), { coalesce });
}

export function patchSelection(label: string, patch: NodePatch | ((n: SciNode) => NodePatch | null), coalesce?: string) {
  const patches: Record<string, NodePatch> = {};
  for (const n of selectedNodes()) {
    const p = typeof patch === 'function' ? patch(n) : patch;
    if (p) patches[n.id] = p;
  }
  patchNodes(label, patches, coalesce);
}

export function deleteSelection() {
  const ids = editor.selection;
  if (!ids.length) return;
  editor.seal();
  editor.apply('Delete', (d) => removeNodes(d, ids), { select: [] });
}

export function nudge(dx: number, dy: number) {
  const ids = editor.selection;
  if (ids.length) editor.apply('Move', (d) => moveNodes(d, ids, dx, dy), { coalesce: 'nudge' });
}

export function reorder(mode: 'front' | 'back' | 'forward' | 'backward') {
  editor.seal();
  const label = { front: 'Bring to front', back: 'Send to back', forward: 'Bring forward', backward: 'Send backward' }[mode];
  editor.apply(label, (d) => reorderNodes(d, editor.selection, mode));
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Align selected nodes to the selection's bounds (moving whole groups together). */
export function align(mode: AlignMode) {
  const nodes = selectedNodes().filter((n) => !n.locked);
  if (nodes.length < 2) return;
  const units = unitsOf(nodes);
  const all = boundsOf(units.flatMap((u) => rectPolygon(u.box)));
  editor.seal();
  editor.apply('Align', (d) => {
    let next = d;
    for (const u of units) {
      const b = u.box;
      const dx = mode === 'left' ? all.x - b.x : mode === 'right' ? all.x + all.width - b.x - b.width : mode === 'hcenter' ? all.x + all.width / 2 - b.x - b.width / 2 : 0;
      const dy = mode === 'top' ? all.y - b.y : mode === 'bottom' ? all.y + all.height - b.y - b.height : mode === 'vcenter' ? all.y + all.height / 2 - b.y - b.height / 2 : 0;
      next = moveNodes(next, u.ids, Math.round(dx), Math.round(dy));
    }
    return next;
  });
}

/** Even spacing between selected nodes along an axis. */
export function distribute(axis: 'h' | 'v') {
  const units = unitsOf(selectedNodes().filter((n) => !n.locked));
  if (units.length < 3) return;
  const key = axis === 'h' ? 'x' : 'y';
  const size = axis === 'h' ? 'width' : 'height';
  units.sort((a, b) => a.box[key] - b.box[key]);
  const first = units[0].box, last = units[units.length - 1].box;
  const total = units.reduce((s, u) => s + u.box[size], 0);
  const gap = (last[key] + last[size] - first[key] - total) / (units.length - 1);
  editor.seal();
  editor.apply('Distribute', (d) => {
    let next = d;
    let pos = first[key];
    for (const u of units) {
      const delta = Math.round(pos - u.box[key]);
      next = moveNodes(next, u.ids, axis === 'h' ? delta : 0, axis === 'v' ? delta : 0);
      pos += u.box[size] + gap;
    }
    return next;
  });
}

/** Groups count as one unit when aligning. Connectors are left to follow their targets. */
function unitsOf(nodes: SciNode[]): { ids: string[]; box: Rect }[] {
  const doc = editor.doc;
  const map = new Map<string, SciNode[]>();
  for (const n of nodes) {
    if (n.type === 'line' && (n.start || n.end)) continue;
    const k = n.group ?? n.id;
    map.set(k, [...(map.get(k) ?? []), n]);
  }
  return [...map.values()].map((list) => ({
    ids: list.map((n) => n.id),
    box: boundsOf(list.flatMap((n) => rectPolygon(nodeBounds(n, doc)))),
  }));
}

export function groupSelection() {
  const ids = editor.selection;
  if (ids.length < 2) return;
  editor.seal();
  editor.apply('Group', (d) => groupNodes(d, ids, newId('g')));
}

export function ungroupSelection() {
  const ids = editor.selection.filter((id) => editor.doc.nodes.find((n) => n.id === id)?.group);
  if (!ids.length) return;
  editor.seal();
  editor.apply('Ungroup', (d) => ungroupNodes(d, ids));
}

export function rotateSelection(deg: number) {
  editor.seal();
  patchSelection('Rotate', (n) => (n.type === 'shape' || n.type === 'symbol' ? { rotation: (((n.rotation + deg) % 360) + 360) % 360 } : null));
}

export function flipSelection() {
  editor.seal();
  patchSelection('Flip', (n) => (n.type === 'symbol' ? { flip: !n.flip } : null));
}

export function toggleLock() {
  const nodes = selectedNodes();
  if (!nodes.length) return;
  const lock = !nodes.every((n) => n.locked);
  editor.seal();
  patchSelection(lock ? 'Lock' : 'Unlock', { locked: lock ? true : undefined });
}

/** Copies get fresh ids; connectors and groups inside the copied set are re-linked to the copies. */
function cloneNodes(nodes: SciNode[], dx: number, dy: number): SciNode[] {
  const ids = new Map(nodes.map((n) => [n.id, newId(n.id.split('_')[0] || 'n')]));
  const groups = new Map<string, string>();
  return nodes.map((n) => {
    const copy = { ...n, id: ids.get(n.id)!, x: n.x + dx, y: n.y + dy } as SciNode;
    if (n.group) {
      if (!groups.has(n.group)) groups.set(n.group, newId('g'));
      copy.group = groups.get(n.group);
    }
    if (copy.type === 'line' && n.type === 'line') {
      if (n.start) n.start.node && ids.has(n.start.node) ? (copy.start = { ...n.start, node: ids.get(n.start.node)! }) : delete copy.start;
      if (n.end) n.end.node && ids.has(n.end.node) ? (copy.end = { ...n.end, node: ids.get(n.end.node)! }) : delete copy.end;
    }
    return copy;
  });
}

export function duplicateSelection() {
  const copies = cloneNodes(selectedNodes(), 20, 20);
  if (!copies.length) return;
  insert('Duplicate', copies);
}

// ------------------------------------------------------------------ clipboard

let internalClipboard: { text: string; nodes: SciNode[] } | null = null;

function plainTextOf(nodes: SciNode[]): string {
  const text = readingOrder(nodes)
    .map((n) => (n.type === 'math' ? toPortableLatex(n.latex) : n.type === 'text' ? n.text : ''))
    .filter(Boolean)
    .join('\n');
  return text || `[SciForge: ${nodes.length} object${nodes.length > 1 ? 's' : ''}]`;
}

/** Handles the DOM `copy`/`cut` event (keyboard shortcuts). */
export function onCopyEvent(e: ClipboardEvent, cut: boolean) {
  const nodes = selectedNodes();
  if (!nodes.length || !e.clipboardData) return;
  e.preventDefault();
  const text = plainTextOf(nodes);
  internalClipboard = { text, nodes };
  e.clipboardData.setData('text/plain', text);
  if (nodes.length === 1 && nodes[0].type === 'math') {
    try {
      const n = nodes[0];
      e.clipboardData.setData('text/html', wordClipboardHtml(latexToOmml(n.latex, n.display), latexToMathML(n.latex, n.display)));
    } catch {
      /* invalid LaTeX: plain text only */
    }
  }
  if (cut) deleteSelection();
}

/** Handles the DOM `paste` event. */
export async function onPasteEvent(e: ClipboardEvent) {
  const data = e.clipboardData;
  if (!data) return;
  const file = [...data.files].find((f) => f.type === 'image/png' || f.type === 'image/svg+xml');
  const text = data.getData('text/plain');
  e.preventDefault();
  if (file) {
    await importBytes(file.name || 'clipboard.png', new Uint8Array(await file.arrayBuffer()));
    return;
  }
  pasteText(text);
}

export function pasteText(text: string, at?: Point) {
  if (internalClipboard && text === internalClipboard.text) {
    const copies = cloneNodes(internalClipboard.nodes, 20, 20);
    internalClipboard = { text, nodes: copies };
    insert('Paste', copies);
    return;
  }
  const trimmed = text.trim();
  if (!trimmed) return;
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
    const nodes = /<sciforge:nodes[^>]*>([\s\S]*?)<\/sciforge:nodes>/.exec(trimmed);
    if (nodes) return insertNodesJson(decodeXmlText(nodes[1]), at);
    const src = readSvgSource(trimmed);
    if (src) return insertFromSource(src, at);
  }
  if (looksLikeLatex(trimmed)) addMath(normalizeLatex(trimmed), at);
  else addText(at, trimmed);
}

async function writeClipboard(items: Record<string, string | Blob>, okMsg = t('copied')) {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const entries = Object.fromEntries(
        Object.entries(items).map(([k, v]) => [k, typeof v === 'string' ? new Blob([v], { type: k }) : v]),
      );
      await navigator.clipboard.write([new ClipboardItem(entries)]);
    } else {
      await navigator.clipboard.writeText(String(items['text/plain'] ?? ''));
    }
    toast(okMsg, 'success');
  } catch (e) {
    toast(`${t('clipboardFailed')}: ${errorText(e)}`, 'error');
  }
}

function requireMath(): MathNode | null {
  const n = targetMath();
  if (!n) toast(t('nothingSelected'), 'error');
  return n;
}

/** Equations become native Word equations; drawings are copied as a high-resolution picture. */
export async function copyForWord() {
  const sel = selectedNodes();
  if (sel.length && !(sel.length === 1 && sel[0].type === 'math')) return copyImage(t('copiedPicture'));
  const n = requireMath();
  if (!n) return;
  try {
    const mathml = latexToMathML(n.latex, n.display);
    const omml = latexToOmml(n.latex, n.display);
    // text/html carries native OMML; text/plain MathML is converted by Word too.
    await writeClipboard({ 'text/html': wordClipboardHtml(omml, mathml), 'text/plain': mathml }, t('copiedWord'));
  } catch (e) {
    toast(`${t('latexError')}: ${errorText(e)}`, 'error');
  }
}

export async function copyLatex() {
  const n = requireMath();
  if (n) await writeClipboard({ 'text/plain': toPortableLatex(n.latex) });
}

export async function copyMathml() {
  const n = requireMath();
  if (!n) return;
  try {
    await writeClipboard({ 'text/plain': latexToMathML(n.latex, n.display) });
  } catch (e) {
    toast(`${t('latexError')}: ${errorText(e)}`, 'error');
  }
}

export async function copySvg() {
  const nodes = selectedNodes();
  const svg = nodes.length ? scopeSvg(nodes, null) : null;
  if (!svg) return toast(t('selectSomething'), 'error');
  await writeClipboard({ 'text/plain': svg.svg });
}

export async function copyTikz() {
  const nodes = exportable(selectedNodes().length ? selectedNodes() : editor.doc.nodes);
  if (!nodes.length) return toast(t('emptyDoc'), 'error');
  await writeClipboard({ 'text/plain': sceneToTikz(nodes, { numbers: getNumbers(editor.doc), measure: measureText, standalone: false }) }, t('copiedTikz'));
}

export async function copyImage(msg?: string) {
  const nodes = selectedNodes();
  if (!nodes.length) return toast(t('selectSomething'), 'error');
  try {
    const png = await scopePng(nodes, 300, null);
    await writeClipboard({ 'image/png': new Blob([png as BlobPart], { type: 'image/png' }) }, msg);
  } catch (e) {
    toast(errorText(e), 'error');
  }
}

// ------------------------------------------------------------------ files

export function confirmDiscard(): boolean {
  return !editor.getState().dirty || window.confirm(t('unsavedConfirm'));
}

export function fileNew() {
  if (!confirmDiscard()) return;
  editor.load(createDocument(t('untitled')));
  ui.set({ activeMathId: null, editingTextId: null, zoom: 1, panX: 80, panY: 60 });
}

const OPEN_FILTERS: FileFilter[] = [
  { name: 'SciForge / PNG / SVG', extensions: ['sci', 'png', 'svg', 'json'], mime: 'application/x-sciforge' },
];

export async function fileOpen() {
  try {
    const f = await openFile(OPEN_FILTERS);
    if (f) await importBytes(f.name, f.bytes, undefined, f.path);
  } catch (e) {
    toast(`${t('openFailed')}: ${errorText(e)}`, 'error');
  }
}

function previewSvg(doc: SciDocument): string | undefined {
  if (!doc.nodes.length) return undefined;
  try {
    return sceneToSvg(doc.nodes, { numbers: getNumbers(doc), measure: measureText, padding: 16, background: '#ffffff' }).svg;
  } catch {
    return undefined;
  }
}

export async function fileSave(saveAs = false): Promise<boolean> {
  const st = editor.getState();
  const doc = st.doc;
  try {
    const bytes = encodeSci({ ...doc, meta: { ...doc.meta, generator: `SciForge ${VERSION}` } }, { previewSvg: previewSvg(doc) });
    const base = (st.fileName ?? `${doc.meta.title || t('untitled')}.sci`).replace(/\.\w+$/, '');
    const res = await saveFile(bytes, { suggestedName: `${base}.sci`, filter: FILTERS.sci, path: saveAs ? null : st.filePath });
    if (!res) return false;
    editor.markSaved(res);
    toast(`${t('saved')}: ${res.name}`, 'success');
    clearAutosave();
    return true;
  } catch (e) {
    toast(errorText(e), 'error');
    return false;
  }
}

function insertFromSource(src: MathSource, at?: Point) {
  addMath(src.latex, at, { display: src.display, fontSize: src.fontSize, color: src.color });
  toast(t('importedEquation'), 'success');
}

/** Open a .sci file, or import an exported PNG/SVG back as editable nodes. */
export async function importBytes(name: string, bytes: Uint8Array, at?: Point, path: string | null = null) {
  const lower = name.toLowerCase();
  if (isPng(bytes)) {
    const texts = getPngTexts(bytes);
    const nodesJson = texts[`${SOURCE_KEY}-nodes`];
    if (nodesJson) return insertNodesJson(nodesJson, at);
    const src = parseSource(texts[SOURCE_KEY]);
    return src ? insertFromSource(src, at) : toast(t('imageNoSource'), 'error');
  }
  if (lower.endsWith('.svg')) {
    const text = new TextDecoder().decode(bytes);
    const nodesMatch = /<sciforge:nodes[^>]*>([\s\S]*?)<\/sciforge:nodes>/.exec(text);
    if (nodesMatch) return insertNodesJson(decodeXmlText(nodesMatch[1]), at);
    const src = readSvgSource(text);
    return src ? insertFromSource(src, at) : toast(t('imageNoSource'), 'error');
  }
  if (!confirmDiscard()) return;
  const doc = decodeSci(bytes);
  editor.load(doc, { name, path: lower.endsWith('.sci') ? path : null });
  ui.set({ activeMathId: null, editingTextId: null });
  requestAnimationFrame(zoomFit);
}

const decodeXmlText = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

function insertNodesJson(json: string, at?: Point) {
  try {
    const doc = decodeSci(new TextEncoder().encode(json));
    const nodes = doc.nodes;
    if (!nodes.length) return;
    const b = boundsOf(nodes.flatMap((n) => rectPolygon(nodeBounds(n, doc))));
    const origin = at ?? { x: viewCenter().x - b.width / 2, y: viewCenter().y - b.height / 2 };
    insert('Import', cloneNodes(nodes, Math.round(origin.x - b.x), Math.round(origin.y - b.y)));
    toast(t('importedObjects'), 'success');
  } catch (e) {
    toast(errorText(e), 'error');
  }
}

// ------------------------------------------------------------------ export

export type ExportFormat = 'png' | 'svg' | 'tikz' | 'docx' | 'tex' | 'html';

const exportable = (nodes: SciNode[]) => nodes.filter((n) => !isBlankNode(n));

/** A doc fragment (JSON) embedded in multi-node exports so they can be re-imported. */
function fragmentJson(nodes: SciNode[]): string {
  return JSON.stringify({ ...createDocument('fragment'), nodes });
}

function scopeSvg(nodes: SciNode[], background: string | null) {
  if (!nodes.length) return null;
  const single = nodes.length === 1 && nodes[0].type === 'math' ? nodes[0] : null;
  if (single && !single.numbered && !background) return mathToSvg(single);
  const res = sceneToSvg(nodes, { numbers: getNumbers(editor.doc), measure: measureText, padding: 12, background, source: single ? makeSource(single) : undefined });
  if (!single) {
    const esc = fragmentJson(nodes).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    res.svg = res.svg.replace(
      /(<svg[^>]*>\n)/,
      `$1<metadata><sciforge:nodes xmlns:sciforge="https://sciforge.dev/ns/source/1">${esc}</sciforge:nodes></metadata>\n`,
    );
  }
  return res;
}

export async function rasterize(svg: string, width: number, height: number, scale: number, background: string | null): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('SVG rasterization failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const c = canvas.getContext('2d')!;
    if (background) {
      c.fillStyle = background;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    c.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function scopePng(nodes: SciNode[], dpi: number, background: string | null): Promise<Uint8Array> {
  const s = scopeSvg(nodes, null)!;
  let png = await rasterize(s.svg, s.width, s.height, dpi / 96, background);
  const single = nodes.length === 1 && nodes[0].type === 'math' ? nodes[0] : null;
  png = single
    ? setPngText(png, SOURCE_KEY, JSON.stringify(makeSource(single)))
    : setPngText(png, `${SOURCE_KEY}-nodes`, fragmentJson(nodes));
  return setPngText(png, 'Software', `SciForge ${VERSION}`);
}

type Block = { kind: 'node'; node: Extract<SciNode, { type: 'math' | 'text' }> } | { kind: 'figure'; nodes: SciNode[]; box: Rect };

/**
 * Split a page into flowing blocks for document formats: equations and text that stand alone stay
 * native; drawings (and any labels overlapping them) become figures.
 */
function documentBlocks(nodes: SciNode[]): Block[] {
  const doc = editor.doc;
  const isFlow = (n: SciNode): n is Extract<SciNode, { type: 'math' | 'text' }> => n.type === 'math' || n.type === 'text';
  const figures: { nodes: SciNode[]; box: Rect }[] = [];
  for (const n of nodes.filter((x) => !isFlow(x))) {
    const b = inflate(nodeBounds(n, doc), 16);
    const hits = figures.filter((f) => rectsIntersect(f.box, b));
    const merged = { nodes: [n, ...hits.flatMap((f) => f.nodes)], box: boundsOf([b, ...hits.map((f) => f.box)].flatMap(rectPolygon)) };
    for (const h of hits) figures.splice(figures.indexOf(h), 1);
    figures.push(merged);
  }
  const loose: Block[] = [];
  for (const n of nodes.filter(isFlow)) {
    const b = nodeBounds(n, doc);
    const f = figures.find((x) => rectsIntersect(x.box, b));
    if (f) {
      f.nodes.push(n);
      f.box = boundsOf([f.box, b].flatMap(rectPolygon));
    } else loose.push({ kind: 'node', node: n });
  }
  const blocks: (Block & { y: number; x: number })[] = [
    ...loose.map((b) => ({ ...b, y: (b as { node: SciNode }).node.y, x: (b as { node: SciNode }).node.x })),
    // Keep the original z-order inside each figure.
    ...figures.map((f) => ({ kind: 'figure' as const, nodes: doc.nodes.filter((n) => f.nodes.includes(n)), box: f.box, y: f.box.y, x: f.box.x })),
  ];
  return blocks.sort((a, b) => (Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x));
}

function buildTex(nodes: SciNode[]): string {
  const nums = getNumbers(editor.doc);
  const blocks = documentBlocks(nodes);
  const hasFigure = blocks.some((b) => b.kind === 'figure');
  const body = blocks
    .map((b) => {
      if (b.kind === 'figure') {
        const pic = sceneToTikz(b.nodes, { numbers: nums, measure: measureText, standalone: false });
        return `\\begin{center}\n${pic}\\end{center}\n`;
      }
      const n = b.node;
      if (n.type === 'text') return n.text.split('\n').map((l) => richToLatex(l)).join('\\\\\n') + '\n';
      const tex = toPortableLatex(n.latex);
      if (!n.display) return `$${tex}$\n`;
      return nums.has(n.id) ? `\\begin{equation}\n  ${tex}\n\\end{equation}\n` : `\\[\n  ${tex}\n\\]\n`;
    })
    .join('\n');
  return [
    `% Generated by SciForge ${VERSION}`,
    '\\documentclass{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{amsmath,amssymb,amsfonts,mathtools}',
    '\\usepackage[version=4]{mhchem}',
    '\\usepackage{xcolor}',
    ...(hasFigure ? ['\\usepackage{tikz}', '\\usetikzlibrary{arrows.meta}'] : []),
    '\\begin{document}',
    '',
    body,
    '\\end{document}',
    '',
  ].join('\n');
}

function buildHtml(nodes: SciNode[]): string {
  const nums = getNumbers(editor.doc);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = documentBlocks(nodes)
    .map((b) => {
      if (b.kind === 'figure') {
        const svg = sceneToSvg(b.nodes, { numbers: nums, measure: measureText, padding: 8 }).svg;
        return `<figure>${svg}</figure>`;
      }
      const n = b.node;
      if (n.type === 'text') return `<p>${esc(n.text).replace(/\n/g, '<br>')}</p>`;
      let mml: string;
      try {
        mml = latexToMathML(n.latex, n.display);
      } catch {
        mml = `<code>${esc(n.latex)}</code>`;
      }
      const num = nums.get(n.id);
      return `<div class="eq">${mml}${num ? `<span class="num">(${num})</span>` : ''}</div>`;
    })
    .join('\n');
  return `<!doctype html>\n<html><head><meta charset="utf-8"><title>${esc(editor.doc.meta.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.5}
.eq{display:flex;align-items:center;justify-content:center;gap:2em;margin:1em 0}.num{margin-left:auto}math{font-size:1.2em}
figure{margin:1.5em 0;text-align:center}figure svg{max-width:100%;height:auto}</style>
</head><body>\n${body}\n</body></html>\n`;
}

async function buildDocxBytes(nodes: SciNode[]): Promise<Uint8Array> {
  const nums = getNumbers(editor.doc);
  const blocks: DocxBlock[] = [];
  for (const b of documentBlocks(nodes)) {
    if (b.kind === 'figure') {
      const s = sceneToSvg(b.nodes, { numbers: nums, measure: measureText, padding: 8 });
      blocks.push({ kind: 'image', png: await rasterize(s.svg, s.width, s.height, 3, '#ffffff'), width: s.width, height: s.height, alt: 'SciForge figure' });
      continue;
    }
    const n = b.node;
    if (n.type === 'text') {
      blocks.push({ kind: 'text', text: n.text, bold: n.bold, italic: n.italic, fontSizePt: n.fontSize * 0.75, color: n.color });
      continue;
    }
    try {
      blocks.push({ kind: 'math', omml: latexToOmml(n.latex, true), number: nums.get(n.id) });
    } catch {
      blocks.push({ kind: 'text', text: n.latex });
    }
  }
  return buildDocx(blocks, editor.doc.meta.title);
}

export interface ExportRequest {
  format: ExportFormat;
  scope: 'selection' | 'all';
  dpi: number;
  background: string | null;
}

export async function exportFile(req: ExportRequest): Promise<boolean> {
  const nodes = exportable(req.scope === 'selection' ? selectedNodes() : editor.doc.nodes);
  if (!nodes.length) {
    toast(t('emptyDoc'), 'error');
    return false;
  }
  const base = (editor.getState().fileName ?? editor.doc.meta.title ?? 'sciforge').replace(/\.\w+$/, '') || 'sciforge';
  try {
    let bytes: Uint8Array;
    const enc = new TextEncoder();
    switch (req.format) {
      case 'png':
        bytes = await scopePng(nodes, req.dpi, req.background);
        break;
      case 'svg':
        bytes = enc.encode(scopeSvg(nodes, req.background)!.svg);
        break;
      case 'tikz':
        bytes = enc.encode(sceneToTikz(nodes, { numbers: getNumbers(editor.doc), measure: measureText }));
        break;
      case 'docx':
        bytes = await buildDocxBytes(nodes);
        break;
      case 'tex':
        bytes = enc.encode(buildTex(nodes));
        break;
      case 'html':
        bytes = enc.encode(buildHtml(nodes));
        break;
    }
    const filter = req.format === 'tikz' ? FILTERS.tex : FILTERS[req.format];
    const suffix = req.format === 'tikz' ? '-tikz' : '';
    const res = await saveFile(bytes, { suggestedName: `${base}${suffix}.${filter.extensions[0]}`, filter });
    if (res) toast(`${t('exported')}: ${res.name}`, 'success');
    return !!res;
  } catch (e) {
    toast(errorText(e), 'error');
    return false;
  }
}

// ------------------------------------------------------------------ autosave

const AUTOSAVE_KEY = 'sciforge:autosave';
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

export function startAutosave() {
  editor.subscribe(() => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      const st = editor.getState();
      if (!st.dirty) return;
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc: st.doc, fileName: st.fileName, at: Date.now() }));
      } catch {
        /* quota or disabled */
      }
    }, 800);
  });
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function restoreAutosave(): boolean {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const doc = decodeSci(new TextEncoder().encode(JSON.stringify(saved.doc)));
    if (!doc.nodes.length) return false;
    // Load as an unsaved document so the user is reminded to save it.
    editor.load(doc, { name: saved.fileName ?? null, path: null });
    editor.markDirty();
    return true;
  } catch {
    return false;
  }
}

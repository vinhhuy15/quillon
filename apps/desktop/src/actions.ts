/**
 * App-level commands, shared by toolbar, menus, keyboard shortcuts and panels.
 */
import {
  addNodes,
  createDocument,
  createMathNode,
  createTextNode,
  decodeSci,
  encodeSci,
  moveNodes,
  newId,
  removeNodes,
  reorderNodes,
  type MathNode,
  type SciDocument,
  type SciNode,
} from '@sciforge/doc-model';
import {
  buildDocx,
  getPngTexts,
  isBlankNode,
  isPng,
  latexToMathML,
  latexToOmml,
  looksLikeLatex,
  makeSource,
  mathToSvg,
  normalizeLatex,
  parseSource,
  readSvgSource,
  sceneToSvg,
  setPngText,
  SOURCE_KEY,
  toPortableLatex,
  wordClipboardHtml,
  type DocxBlock,
  type MathSource,
} from '@sciforge/math-core';
import { t } from './i18n';
import { getNumbers, measureText, nodeBounds } from './layout';
import { FILTERS, openFile, saveFile, type FileFilter } from './platform';
import { editor, toast, ui } from './state/store';

// ------------------------------------------------------------------ viewport

export const viewport = { width: 800, height: 600 };

export function viewCenter(): { x: number; y: number } {
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
  const rects = doc.nodes.map((n) => nodeBounds(n, doc));
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.width));
  const y2 = Math.max(...rects.map((r) => r.y + r.height));
  const margin = 40;
  const z = Math.min(4, Math.max(0.1, Math.min((viewport.width - 2 * margin) / (x2 - x1 || 1), (viewport.height - 2 * margin) / (y2 - y1 || 1))));
  ui.set({
    zoom: z,
    panX: (viewport.width - (x2 - x1) * z) / 2 - x1 * z,
    panY: (viewport.height - (y2 - y1) * z) / 2 - y1 * z,
  });
}

// ------------------------------------------------------------------ helpers

export const readingOrder = (nodes: SciNode[]) =>
  nodes.slice().sort((a, b) => (Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x));

export function selectedNodes(): SciNode[] {
  const sel = new Set(editor.selection);
  return editor.doc.nodes.filter((n) => sel.has(n.id));
}

/** Remove an equation that was created but left empty. */
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

// ------------------------------------------------------------------ create / edit

export function addMath(latex = '', at?: { x: number; y: number }, extra: Partial<MathNode> = {}): MathNode {
  const pos = at ?? viewCenter();
  const s = editor.doc.settings;
  const node = createMathNode({
    latex,
    x: Math.round(pos.x - (at ? 0 : 60)),
    y: Math.round(pos.y - (at ? 0 : 20)),
    fontSize: s.defaultFontSize,
    color: s.defaultColor,
    ...extra,
  });
  editor.seal();
  editor.apply('Add equation', (d) => addNodes(d, [node]), { select: [node.id] });
  ui.set((u) => ({ activeMathId: node.id, editingTextId: null, focusEditorTick: u.focusEditorTick + 1 }));
  return node;
}

export function addText(at?: { x: number; y: number }, text = '') {
  const pos = at ?? viewCenter();
  const node = createTextNode({ x: Math.round(pos.x), y: Math.round(pos.y), text });
  editor.seal();
  editor.apply('Add text', (d) => addNodes(d, [node]), { select: [node.id] });
  ui.set({ editingTextId: node.id });
}

/** Insert a template: into the equation being edited, or as a new equation. */
export function insertTemplate(latex: string) {
  const insert = editorInsertHook.current;
  if (insert && ui.get().activeMathId && insert(latex)) return;
  addMath(latex);
}

/** Set by the EquationEditor so other UI can insert at the caret. */
export const editorInsertHook: { current: ((latex: string) => boolean) | null } = { current: null };

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

export function reorder(mode: 'front' | 'back') {
  editor.seal();
  editor.apply(mode === 'front' ? 'Bring to front' : 'Send to back', (d) => reorderNodes(d, editor.selection, mode));
}

function cloneNodes(nodes: SciNode[], dx: number, dy: number): SciNode[] {
  return nodes.map((n) => ({ ...n, id: newId(n.type === 'math' ? 'm' : 't'), x: n.x + dx, y: n.y + dy }));
}

export function duplicateSelection() {
  const copies = cloneNodes(selectedNodes(), 20, 20);
  if (!copies.length) return;
  editor.seal();
  editor.apply('Duplicate', (d) => addNodes(d, copies), { select: copies.map((n) => n.id) });
}

// ------------------------------------------------------------------ clipboard

let internalClipboard: { text: string; nodes: SciNode[] } | null = null;

function plainTextOf(nodes: SciNode[]): string {
  return readingOrder(nodes)
    .map((n) => (n.type === 'math' ? toPortableLatex(n.latex) : n.text))
    .join('\n');
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

export function pasteText(text: string, at?: { x: number; y: number }) {
  if (internalClipboard && text === internalClipboard.text) {
    const copies = cloneNodes(internalClipboard.nodes, 20, 20);
    internalClipboard = { text, nodes: copies };
    editor.seal();
    editor.apply('Paste', (d) => addNodes(d, copies), { select: copies.map((n) => n.id) });
    return;
  }
  const trimmed = text.trim();
  if (!trimmed) return;
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
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

export async function copyForWord() {
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
  if (!svg) return toast(t('nothingSelected'), 'error');
  await writeClipboard({ 'text/plain': svg.svg });
}

export async function copyImage() {
  const nodes = selectedNodes();
  if (!nodes.length) return toast(t('nothingSelected'), 'error');
  try {
    const png = await scopePng(nodes, 300, null);
    await writeClipboard({ 'image/png': new Blob([png as BlobPart], { type: 'image/png' }) });
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
    const bytes = encodeSci(doc, { previewSvg: previewSvg(doc) });
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

function insertFromSource(src: MathSource, at?: { x: number; y: number }) {
  addMath(src.latex, at, { display: src.display, fontSize: src.fontSize, color: src.color });
  toast(t('importedEquation'), 'success');
}

/** Open a .sci file, or import an exported PNG/SVG back as editable nodes. */
export async function importBytes(name: string, bytes: Uint8Array, at?: { x: number; y: number }, path: string | null = null) {
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

function insertNodesJson(json: string, at?: { x: number; y: number }) {
  try {
    const doc = decodeSci(new TextEncoder().encode(json));
    const nodes = doc.nodes;
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const origin = at ?? viewCenter();
    const placed = cloneNodes(nodes, origin.x - minX, origin.y - minY);
    editor.seal();
    editor.apply('Import', (d) => addNodes(d, placed), { select: placed.map((n) => n.id) });
    toast(t('importedEquation'), 'success');
  } catch (e) {
    toast(errorText(e), 'error');
  }
}

// ------------------------------------------------------------------ export

export type ExportFormat = 'png' | 'svg' | 'docx' | 'tex' | 'html';

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
  return setPngText(png, 'Software', 'SciForge 0.1.0');
}

const texEscape = (s: string) =>
  s.replace(/[\\#$%&_{}~^]/g, (c) =>
    c === '\\' ? '\\textbackslash{}' : c === '~' ? '\\textasciitilde{}' : c === '^' ? '\\textasciicircum{}' : `\\${c}`,
  );

function buildTex(nodes: SciNode[]): string {
  const nums = getNumbers(editor.doc);
  const body = readingOrder(nodes)
    .map((n) => {
      if (n.type === 'text') return n.text.split('\n').map(texEscape).join('\\\\\n') + '\n';
      const tex = toPortableLatex(n.latex);
      if (!n.display) return `$${tex}$\n`;
      return nums.has(n.id) ? `\\begin{equation}\n  ${tex}\n\\end{equation}\n` : `\\[\n  ${tex}\n\\]\n`;
    })
    .join('\n');
  return [
    '% Generated by SciForge 0.1.0',
    '\\documentclass{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{amsmath,amssymb,amsfonts,mathtools}',
    '\\usepackage[version=4]{mhchem}',
    '\\usepackage{xcolor}',
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
  const body = readingOrder(nodes)
    .map((n) => {
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
.eq{display:flex;align-items:center;justify-content:center;gap:2em;margin:1em 0}.num{margin-left:auto}math{font-size:1.2em}</style>
</head><body>\n${body}\n</body></html>\n`;
}

function buildDocxBytes(nodes: SciNode[]): Uint8Array {
  const nums = getNumbers(editor.doc);
  const blocks: DocxBlock[] = readingOrder(nodes).map((n) => {
    if (n.type === 'text') {
      return { kind: 'text', text: n.text, bold: n.bold, italic: n.italic, fontSizePt: n.fontSize * 0.75, color: n.color };
    }
    try {
      return { kind: 'math', omml: latexToOmml(n.latex, true), number: nums.get(n.id) };
    } catch {
      return { kind: 'text', text: n.latex };
    }
  });
  return buildDocx(blocks, editor.doc.meta.title);
}

export interface ExportRequest {
  format: ExportFormat;
  scope: 'selection' | 'all';
  dpi: number;
  background: string | null;
}

export async function exportFile(req: ExportRequest): Promise<boolean> {
  const nodes = (req.scope === 'selection' ? selectedNodes() : editor.doc.nodes).filter((n) => !isBlankNode(n));
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
      case 'docx':
        bytes = buildDocxBytes(nodes);
        break;
      case 'tex':
        bytes = enc.encode(buildTex(nodes));
        break;
      case 'html':
        bytes = enc.encode(buildHtml(nodes));
        break;
    }
    const filter = FILTERS[req.format];
    const res = await saveFile(bytes, { suggestedName: `${base}.${filter.extensions[0]}`, filter });
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

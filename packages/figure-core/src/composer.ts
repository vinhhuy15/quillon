/**
 * Figure composer helpers: multi-panel grids, panel labels and image insets. All pure.
 */
import type { ImageCrop, ImageNode, NodeId, NodePatch, Rect, SciDocument } from '@quillon/doc-model';
import { updateNodes } from '@quillon/doc-model';
import { cropOf } from './image';

export type PanelLabelStyle = 'A' | 'a' | '(a)' | 'a)' | 'A.';
export const PANEL_LABEL_STYLES: PanelLabelStyle[] = ['A', 'a', '(a)', 'a)', 'A.'];

/** Letter for panel `i` (0-based): A…Z, then AA, AB… */
function letters(i: number): string {
  let s = '';
  let k = i;
  do {
    s = String.fromCharCode(65 + (k % 26)) + s;
    k = Math.floor(k / 26) - 1;
  } while (k >= 0);
  return s;
}

export function panelLabel(i: number, style: PanelLabelStyle): string {
  const up = letters(i);
  const lo = up.toLowerCase();
  switch (style) {
    case 'A': return up;
    case 'a': return lo;
    case '(a)': return `(${lo})`;
    case 'a)': return `${lo})`;
    case 'A.': return `${up}.`;
  }
}

/** Sort boxes into reading order: rows (by overlapping vertical extent), then left to right. */
export function readingOrderBoxes<T extends { box: Rect }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const rows: T[][] = [];
  for (const it of sorted) {
    const row = rows.find((r) => r.some((o) => {
      const top = Math.max(o.box.y, it.box.y);
      const bottom = Math.min(o.box.y + o.box.height, it.box.y + it.box.height);
      return bottom - top > Math.min(o.box.height, it.box.height) * 0.5;
    }));
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.box.x - b.box.x));
}

export interface GridOptions {
  columns: number;
  gap: number;
  /** Vertical gap between rows (defaults to `gap`), e.g. to leave room for panel labels. */
  rowGap?: number;
  /** Top-left corner of the grid. */
  origin: { x: number; y: number };
  /** Horizontal alignment inside a cell. */
  align?: 'start' | 'center';
}

/**
 * Lay boxes out in a grid (in the given order). Columns take the widest box in them and rows
 * the tallest; each box is placed at the top of its cell. Returns the new top-left of every box.
 */
export function gridPositions(boxes: Rect[], opts: GridOptions): { x: number; y: number }[] {
  const cols = Math.max(1, Math.min(opts.columns, boxes.length || 1));
  const rows = Math.ceil(boxes.length / cols);
  const colW = Array.from({ length: cols }, (_, c) => Math.max(0, ...boxes.filter((_, i) => i % cols === c).map((b) => b.width)));
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(0, ...boxes.slice(r * cols, r * cols + cols).map((b) => b.height)));
  const colX = colW.map((_, c) => opts.origin.x + colW.slice(0, c).reduce((a, w) => a + w + opts.gap, 0));
  const rowY = rowH.map((_, r) => opts.origin.y + rowH.slice(0, r).reduce((a, h) => a + h + (opts.rowGap ?? opts.gap), 0));
  return boxes.map((b, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const dx = opts.align === 'center' ? (colW[c] - b.width) / 2 : 0;
    return { x: colX[c] + dx, y: rowY[r] };
  });
}

/** A sensible default column count for n panels. */
export const defaultColumns = (n: number) => (n <= 3 ? n : n === 4 ? 2 : Math.ceil(Math.sqrt(n)));

/** Where the inset region sits on the source image, in world coordinates (or null if not visible). */
export function insetRegion(source: ImageNode, insetCrop: ImageCrop): Rect | null {
  const sc = cropOf(source);
  const x0 = Math.max(insetCrop.x, sc.x), y0 = Math.max(insetCrop.y, sc.y);
  const x1 = Math.min(insetCrop.x + insetCrop.width, sc.x + sc.width), y1 = Math.min(insetCrop.y + insetCrop.height, sc.y + sc.height);
  if (x1 <= x0 || y1 <= y0) return null;
  const kx = source.width / sc.width, ky = source.height / sc.height;
  return { x: source.x + (x0 - sc.x) * kx, y: source.y + (y0 - sc.y) * ky, width: (x1 - x0) * kx, height: (y1 - y0) * ky };
}

const close = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Keep every inset's marker rectangle on the region the inset shows. */
export function resolveInsets(doc: SciDocument): SciDocument {
  const byId = new Map<NodeId, SciDocument['nodes'][number]>(doc.nodes.map((n) => [n.id, n]));
  const patches: Record<NodeId, NodePatch> = {};
  for (const n of doc.nodes) {
    if (n.type !== 'image' || !n.inset?.marker) continue;
    const src = byId.get(n.inset.source);
    const marker = byId.get(n.inset.marker);
    if (!src || src.type !== 'image' || !marker || marker.type !== 'shape') continue;
    const r = insetRegion(src, cropOf(n));
    if (!r) continue;
    if (close(marker.x, r.x) && close(marker.y, r.y) && close(marker.width, r.width) && close(marker.height, r.height)) continue;
    patches[marker.id] = { x: r.x, y: r.y, width: r.width, height: r.height, rotation: 0 };
  }
  return Object.keys(patches).length ? updateNodes(doc, patches) : doc;
}

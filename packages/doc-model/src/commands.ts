/**
 * Pure document operations. Every function returns a new document (or the
 * same reference when nothing changed) and never mutates its input.
 */
import type { NodeId, NodePatch, SciDocument, SciNode } from './types';

function touch(doc: SciDocument, nodes: SciNode[]): SciDocument {
  return { ...doc, nodes, meta: { ...doc.meta, modified: new Date().toISOString() } };
}

export function getNode(doc: SciDocument, id: NodeId): SciNode | undefined {
  return doc.nodes.find((n) => n.id === id);
}

export function addNodes(doc: SciDocument, nodes: SciNode[], index = doc.nodes.length): SciDocument {
  if (nodes.length === 0) return doc;
  const existing = new Set(doc.nodes.map((n) => n.id));
  for (const n of nodes) {
    if (existing.has(n.id)) throw new Error(`Duplicate node id ${n.id}`);
    existing.add(n.id);
  }
  const next = doc.nodes.slice();
  next.splice(Math.max(0, Math.min(index, next.length)), 0, ...nodes);
  return touch(doc, next);
}

export function updateNodes(doc: SciDocument, patches: Record<NodeId, NodePatch>): SciDocument {
  let changed = false;
  const next = doc.nodes.map((n) => {
    const p = patches[n.id];
    if (!p) return n;
    const keys = Object.keys(p) as (keyof NodePatch)[];
    const applicable = keys.filter((k) => k in n && (n as unknown as Record<string, unknown>)[k] !== p[k]);
    if (applicable.length === 0) return n;
    changed = true;
    const merged: Record<string, unknown> = { ...n };
    for (const k of applicable) merged[k] = p[k];
    return merged as unknown as SciNode;
  });
  return changed ? touch(doc, next) : doc;
}

export function moveNodes(doc: SciDocument, ids: NodeId[], dx: number, dy: number): SciDocument {
  if (dx === 0 && dy === 0) return doc;
  const set = new Set(ids);
  let changed = false;
  const next = doc.nodes.map((n) => {
    if (!set.has(n.id) || n.locked) return n;
    changed = true;
    return { ...n, x: n.x + dx, y: n.y + dy };
  });
  return changed ? touch(doc, next) : doc;
}

export function removeNodes(doc: SciDocument, ids: NodeId[]): SciDocument {
  const set = new Set(ids);
  const next = doc.nodes.filter((n) => !set.has(n.id));
  return next.length === doc.nodes.length ? doc : touch(doc, next);
}

export type ReorderMode = 'front' | 'back' | 'forward' | 'backward';

export function reorderNodes(doc: SciDocument, ids: NodeId[], mode: ReorderMode): SciDocument {
  const set = new Set(ids);
  const picked = doc.nodes.filter((n) => set.has(n.id));
  if (picked.length === 0) return doc;
  const rest = doc.nodes.filter((n) => !set.has(n.id));
  let next: SciNode[];
  if (mode === 'front') next = [...rest, ...picked];
  else if (mode === 'back') next = [...picked, ...rest];
  else {
    next = doc.nodes.slice();
    const step = mode === 'forward' ? 1 : -1;
    const order = mode === 'forward' ? [...next.keys()].reverse() : [...next.keys()];
    for (const i of order) {
      const j = i + step;
      if (!set.has(next[i].id) || j < 0 || j >= next.length || set.has(next[j].id)) continue;
      [next[i], next[j]] = [next[j], next[i]];
    }
  }
  const same = next.every((n, i) => n === doc.nodes[i]);
  return same ? doc : touch(doc, next);
}

export function setTitle(doc: SciDocument, title: string): SciDocument {
  return doc.meta.title === title ? doc : { ...doc, meta: { ...doc.meta, title } };
}

/**
 * Equation numbers in reading order (top-to-bottom, then left-to-right)
 * for all numbered math nodes.
 */
export function equationNumbers(doc: SciDocument): Map<NodeId, number> {
  const numbered = doc.nodes.filter((n) => n.type === 'math' && n.numbered);
  numbered.sort((a, b) => (Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x));
  return new Map(numbered.map((n, i) => [n.id, i + 1]));
}

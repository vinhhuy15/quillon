import { equationNumbers, type NodeId, type Rect, type SciDocument, type SciNode } from '@quillon/doc-model';
import { attachGeometry, layoutNode, resolveConnectors, resolveInsets, type NodeLayout, type TextMeasurer } from '@quillon/figure-core';
import { editor } from './state/store';

let ctx: CanvasRenderingContext2D | null = null;
export const measureText: TextMeasurer = (text, font) => {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * 10;
  ctx.font = font;
  return ctx.measureText(text).width;
};

const cache = new WeakMap<SciNode, { num: number | undefined; layout: NodeLayout }>();

/** Cached layout per immutable node object. */
export function getLayout(n: SciNode, numbers: Map<NodeId, number>): NodeLayout {
  const num = numbers.get(n.id);
  const hit = cache.get(n);
  if (hit && hit.num === num) return hit.layout;
  const layout = layoutNode(n, { numbers, measure: measureText });
  cache.set(n, { num, layout });
  return layout;
}

const numCache = new WeakMap<SciDocument, Map<NodeId, number>>();
export function getNumbers(doc: SciDocument): Map<NodeId, number> {
  let m = numCache.get(doc);
  if (!m) {
    m = equationNumbers(doc);
    numCache.set(doc, m);
  }
  return m;
}

/** World bounds of a node including labels and equation numbers. */
export function nodeBounds(n: SciNode, doc: SciDocument): Rect {
  return getLayout(n, getNumbers(doc)).bounds;
}

export function attachOf(n: SciNode, doc: SciDocument) {
  return attachGeometry(n, getLayout(n, getNumbers(doc)));
}

// After every edit: keep inset markers on their regions, then connectors glued to the nodes they attach to.
editor.setNormalizer((doc) => {
  const d = resolveInsets(doc);
  return resolveConnectors(d, (n) => attachOf(n, d));
});

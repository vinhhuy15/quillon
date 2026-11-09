import { equationNumbers, type NodeId, type Rect, type SciDocument, type SciNode } from '@sciforge/doc-model';
import { labelWidth, layoutNode, type NodeLayout, type TextMeasurer } from '@sciforge/math-core';

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
  const layout = layoutNode(n, numbers, measureText);
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

/** Bounds of a node including its equation number label. */
export function nodeBounds(n: SciNode, doc: SciDocument): Rect {
  const l = getLayout(n, getNumbers(doc));
  const w = l.label ? Math.max(l.width, labelWidth(l.label)) : l.width;
  return { x: n.x, y: n.y, width: w, height: l.height };
}

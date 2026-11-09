import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createLineNode,
  createShapeNode,
  expandGroups,
  moveNodes,
  rectFromPoints,
  rectsIntersect,
  updateNodes,
  type Binding,
  type LineNode,
  type NodeId,
  type NodePatch,
  type Point,
  type Rect,
  type SciNode,
  type ShapeNode,
  type TextNode,
} from '@quillon/doc-model';
import { layoutNode, nodeGroup, rotatePoint, type NodeLayout } from '@quillon/figure-core';
import {
  addLine,
  addMath,
  addPlot,
  addShape,
  addSymbol,
  addText,
  importBytes,
  insertTemplate,
  pointer,
  snapValue,
  viewport,
  zoomAt,
} from '../actions';
import { Welcome } from './Welcome';
import { attachOf, getLayout, getNumbers, measureText, nodeBounds } from '../layout';
import { shapeOfTool } from '../tools';
import { editor, ui, useEditor, useUi, type Tool } from '../state/store';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

type Drag =
  | { kind: 'move'; start: Point; anchor: Point; anchorId: NodeId; key: string; moved: boolean }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; base: NodeId[] }
  | { kind: 'pan'; sx: number; sy: number; panX: number; panY: number }
  | { kind: 'resize'; id: NodeId; handle: Handle; start: SciNode; box: Box; p0: Point; key: string }
  | { kind: 'rotate'; id: NodeId; c: Point; key: string }
  | { kind: 'vertex'; id: NodeId; index: number; key: string; target: BindingHit | null }
  | { kind: 'draw'; tool: Tool; p0: Point; p1: Point; start: BindingHit | null; end: BindingHit | null };

interface BindingHit {
  binding: Binding;
  rect: Rect;
  ports: Point[];
  at: Point;
}

let dragSeq = 0;
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const NodeView = memo(function NodeView({ node, layout, selected }: { node: SciNode; layout: NodeLayout; selected: boolean }) {
  const rot = layout.rotation ? `rotate(${layout.rotation} ${layout.width / 2} ${layout.height / 2})` : undefined;
  return (
    <g transform={`translate(${node.x} ${node.y})`} data-id={node.id} className={`node node-${node.type}${selected ? ' selected' : ''}${node.locked ? ' locked' : ''}`}>
      <g transform={rot}>
        {layout.hit ? <g dangerouslySetInnerHTML={{ __html: layout.hit }} /> : <rect className="hit" width={layout.width} height={layout.height} />}
        <g dangerouslySetInnerHTML={{ __html: layout.markup }} />
      </g>
      {layout.overlay && <g dangerouslySetInnerHTML={{ __html: layout.overlay }} />}
      {layout.error && <title>{layout.error}</title>}
    </g>
  );
});

/** The editable box of a node (rotation only for shapes and symbols). */
function boxOf(n: SciNode, l: NodeLayout): Box | null {
  if (n.type === 'shape' || n.type === 'symbol') return { x: n.x, y: n.y, w: n.width, h: n.height, rot: n.rotation };
  if (n.type === 'plot') return { x: n.x, y: n.y, w: n.width, h: n.height, rot: 0 };
  if (n.type === 'math' || n.type === 'text') return { x: n.x, y: n.y, w: l.width, h: l.height, rot: 0 };
  return null;
}

function boxCorners(b: Box): Point[] {
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ].map((p) => rotatePoint(p, c, b.rot));
}

/** Resize a (possibly rotated) box by dragging one handle; the opposite side stays put. */
function resizeBox(b: Box, h: Handle, dWorld: Point, keepAspect: boolean, min = 6): Box {
  const d = rotatePoint(dWorld, { x: 0, y: 0 }, -b.rot);
  let l = 0, t = 0, r = b.w, btm = b.h;
  if (h.includes('w')) l += d.x;
  if (h.includes('e')) r += d.x;
  if (h.includes('n')) t += d.y;
  if (h.includes('s')) btm += d.y;
  if (keepAspect && h.length === 2) {
    const s = Math.max((r - l) / b.w, (btm - t) / b.h, min / Math.min(b.w, b.h));
    const nw = b.w * s, nh = b.h * s;
    if (h.includes('w')) l = r - nw;
    else r = l + nw;
    if (h.includes('n')) t = btm - nh;
    else btm = t + nh;
  }
  if (r - l < min) h.includes('w') ? (l = r - min) : (r = l + min);
  if (btm - t < min) h.includes('n') ? (t = btm - min) : (btm = t + min);
  const w = r - l, hh = btm - t;
  const off = rotatePoint({ x: (l + r) / 2 - b.w / 2, y: (t + btm) / 2 - b.h / 2 }, { x: 0, y: 0 }, b.rot);
  const cx = b.x + b.w / 2 + off.x, cy = b.y + b.h / 2 + off.y;
  return { x: cx - w / 2, y: cy - hh / 2, w, h: hh, rot: b.rot };
}

function lineAbs(n: LineNode): Point[] {
  return n.points.map((p) => ({ x: p.x + n.x, y: p.y + n.y }));
}

function fromAbs(abs: Point[]): Pick<LineNode, 'x' | 'y' | 'points'> {
  const [p0] = abs;
  return { x: p0.x, y: p0.y, points: abs.map((p) => ({ x: p.x - p0.x, y: p.y - p0.y })) };
}

/** Constrain the segment p0→p to 15° steps. */
function constrainAngle(p0: Point, p: Point): Point {
  const a = Math.atan2(p.y - p0.y, p.x - p0.x);
  const step = Math.PI / 12;
  const s = Math.round(a / step) * step;
  const len = Math.hypot(p.x - p0.x, p.y - p0.y);
  return { x: p0.x + Math.cos(s) * len, y: p0.y + Math.sin(s) * len };
}

export function Canvas() {
  const { doc, selection } = useEditor();
  const zoom = useUi((s) => s.zoom);
  const panX = useUi((s) => s.panX);
  const panY = useUi((s) => s.panY);
  const tool = useUi((s) => s.tool);
  const editingTextId = useUi((s) => s.editingTextId);
  const activeMathId = useUi((s) => s.activeMathId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const spaceDown = useRef(false);
  const [panning, setPanning] = useState(false);
  const [dropHint, setDropHint] = useState(false);

  const numbers = getNumbers(doc);
  const selSet = new Set(selection);

  // Track viewport size for zoom-to-fit / centering.
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      viewport.width = el.clientWidth;
      viewport.height = el.clientHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        spaceDown.current = true;
        setPanning(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        setPanning(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Wheel: pan, or zoom with Ctrl. Must be non-passive to preventDefault.
  useEffect(() => {
    const el = wrapRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      } else {
        const { panX, panY } = ui.get();
        ui.set({ panX: panX - (e.shiftKey ? e.deltaY : e.deltaX), panY: panY - (e.shiftKey ? 0 : e.deltaY) });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toCanvas = (clientX: number, clientY: number): Point => {
    const r = wrapRef.current!.getBoundingClientRect();
    const { zoom, panX, panY } = ui.get();
    return { x: (clientX - r.left - panX) / zoom, y: (clientY - r.top - panY) / zoom };
  };

  const nodeIdAt = (target: EventTarget | null): NodeId | null => {
    const g = (target as Element | null)?.closest?.('[data-id]');
    return g ? g.getAttribute('data-id') : null;
  };

  /** A node (not a line) under the pointer that a connector end could attach to. */
  const bindingAt = (clientX: number, clientY: number, exclude: NodeId | null): BindingHit | null => {
    const d = editor.doc;
    const p = toCanvas(clientX, clientY);
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      const id = el.closest?.('[data-id]')?.getAttribute('data-id');
      if (!id || id === exclude) continue;
      const n = d.nodes.find((x) => x.id === id);
      if (!n || n.type === 'line') continue;
      const g = attachOf(n, d);
      if (!g) continue;
      const ports = Object.entries(g.ports ?? {});
      const tol = 14 / ui.get().zoom;
      let best: [string, Point] | null = null;
      for (const [k, q] of ports) if (Math.hypot(q.x - p.x, q.y - p.y) < tol && (!best || Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best[1].x - p.x, best[1].y - p.y))) best = [k, q];
      return {
        binding: best ? { node: id, port: best[0] } : { node: id },
        rect: nodeBounds(n, d),
        ports: ports.map(([, q]) => q),
        at: best ? best[1] : g.center,
      };
    }
    return null;
  };

  const setDragBoth = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const finishTool = () => ui.set({ tool: 'select' });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    ui.set({ contextMenu: null });
    (document.activeElement as HTMLElement | null)?.blur?.();
    svgRef.current!.setPointerCapture(e.pointerId);
    const { panX, panY, tool } = ui.get();
    if (e.button === 1 || spaceDown.current || tool === 'hand') {
      setDragBoth({ kind: 'pan', sx: e.clientX, sy: e.clientY, panX, panY });
      return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    const target = e.target as Element;

    // Drawing tools
    if (tool !== 'select') {
      // The click must not move focus to the page, or the new editor loses it right away.
      if (tool === 'math' || tool === 'text') e.preventDefault();
      if (tool === 'math') {
        addMath('', { x: snapValue(p.x), y: snapValue(p.y - 20) });
        return finishTool();
      }
      if (tool === 'text') {
        addText({ x: snapValue(p.x), y: snapValue(p.y - 12) });
        return finishTool();
      }
      const sp = { x: snapValue(p.x), y: snapValue(p.y) };
      const start = tool === 'line' || tool === 'arrow' ? bindingAt(e.clientX, e.clientY, null) : null;
      setDragBoth({ kind: 'draw', tool, p0: start?.binding.port ? start.at : sp, p1: sp, start, end: null });
      return;
    }

    // Handles of the selected node
    const handleEl = target.closest('[data-handle]');
    if (handleEl) {
      const id = handleEl.getAttribute('data-node')!;
      const n = editor.doc.nodes.find((x) => x.id === id);
      if (!n) return;
      const kind = handleEl.getAttribute('data-handle')!;
      editor.seal();
      const key = `h-${++dragSeq}`;
      if (kind === 'rotate') {
        const l = getLayout(n, getNumbers(editor.doc));
        setDragBoth({ kind: 'rotate', id, c: { x: n.x + l.width / 2, y: n.y + l.height / 2 }, key });
      } else if (kind === 'vertex') {
        setDragBoth({ kind: 'vertex', id, index: Number(handleEl.getAttribute('data-index')), key, target: null });
      } else {
        const box = boxOf(n, getLayout(n, getNumbers(editor.doc)))!;
        setDragBoth({ kind: 'resize', id, handle: kind as Handle, start: n, box, p0: p, key });
      }
      return;
    }

    const id = nodeIdAt(target);
    if (id) {
      const sel = editor.selection;
      const doc = editor.doc;
      const group = expandGroups(doc, [id]);
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        editor.select(sel.includes(id) ? sel.filter((s) => !group.includes(s)) : [...sel, ...group.filter((g) => !sel.includes(g))]);
      } else if (!sel.includes(id)) {
        editor.select(group);
      }
      const node = doc.nodes.find((n) => n.id === id)!;
      if (node.type === 'math') ui.set({ activeMathId: id });
      if (ui.get().editingTextId && ui.get().editingTextId !== id) ui.set({ editingTextId: null });
      editor.seal();
      setDragBoth({ kind: 'move', start: p, anchor: { x: node.x, y: node.y }, anchorId: id, key: `drag-${++dragSeq}`, moved: false });
    } else {
      const base = e.shiftKey || e.ctrlKey || e.metaKey ? editor.selection : [];
      editor.select(base);
      ui.set({ editingTextId: null, activeMathId: null });
      setDragBoth({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, base });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toCanvas(e.clientX, e.clientY);
    pointer.current = p;
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'pan') {
      ui.set({ panX: d.panX + e.clientX - d.sx, panY: d.panY + e.clientY - d.sy });
      return;
    }
    if (d.kind === 'move') {
      if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) * ui.get().zoom < 3) return;
      const cur = editor.doc.nodes.find((n) => n.id === d.anchorId);
      if (!cur) return;
      const tx = snapValue(d.anchor.x + p.x - d.start.x), ty = snapValue(d.anchor.y + p.y - d.start.y);
      const dx = tx - cur.x, dy = ty - cur.y;
      if (dx || dy) editor.apply('Move', (doc) => moveNodes(doc, editor.selection, dx, dy), { coalesce: d.key });
      dragRef.current = { ...d, moved: true };
      return;
    }
    if (d.kind === 'resize') {
      const s = d.start;
      const keep = e.shiftKey || ((s.type === 'symbol' || s.type === 'math' || s.type === 'text') && d.handle.length === 2);
      const nb = resizeBox(d.box, d.handle, { x: p.x - d.p0.x, y: p.y - d.p0.y }, keep);
      let patch: NodePatch;
      if (s.type === 'math' || s.type === 'text') {
        const scale = nb.w / d.box.w;
        patch = { x: Math.round(nb.x), y: Math.round(nb.y), fontSize: Math.max(6, Math.round(s.fontSize * scale * 2) / 2) };
      } else {
        patch = { x: Math.round(nb.x), y: Math.round(nb.y), width: Math.round(nb.w), height: Math.round(nb.h) };
      }
      editor.apply('Resize', (doc) => updateNodes(doc, { [d.id]: patch }), { coalesce: d.key });
      return;
    }
    if (d.kind === 'rotate') {
      let deg = (Math.atan2(p.y - d.c.y, p.x - d.c.x) * 180) / Math.PI + 90;
      deg = e.shiftKey ? Math.round(deg / 15) * 15 : Math.abs(deg - Math.round(deg / 90) * 90) < 4 ? Math.round(deg / 90) * 90 : Math.round(deg);
      deg = ((deg % 360) + 360) % 360;
      editor.apply('Rotate', (doc) => updateNodes(doc, { [d.id]: { rotation: deg } }), { coalesce: d.key });
      return;
    }
    if (d.kind === 'vertex') {
      const n = editor.doc.nodes.find((x) => x.id === d.id);
      if (!n || n.type !== 'line') return;
      const abs = lineAbs(n);
      const isEnd = d.index === 0 || d.index === abs.length - 1;
      const target = isEnd ? bindingAt(e.clientX, e.clientY, d.id) : null;
      let q = { x: snapValue(p.x), y: snapValue(p.y) };
      const other = abs[d.index === 0 ? 1 : d.index - 1];
      if (e.shiftKey && other) q = constrainAngle(other, q);
      if (target?.binding.port) q = target.at;
      abs[d.index] = q;
      const patch: NodePatch = { ...fromAbs(abs) };
      if (isEnd) patch[d.index === 0 ? 'start' : 'end'] = target?.binding;
      editor.apply('Edit line', (doc) => updateNodes(doc, { [d.id]: patch }), { coalesce: d.key });
      dragRef.current = { ...d, target };
      setDrag(dragRef.current);
      return;
    }
    if (d.kind === 'draw') {
      let p1 = { x: snapValue(p.x), y: snapValue(p.y) };
      const isLine = d.tool === 'line' || d.tool === 'arrow';
      const end = isLine ? bindingAt(e.clientX, e.clientY, null) : null;
      if (isLine && e.shiftKey) p1 = constrainAngle(d.p0, p1);
      if (end?.binding.port) p1 = end.at;
      if (!isLine && e.shiftKey) {
        const s = Math.max(Math.abs(p1.x - d.p0.x), Math.abs(p1.y - d.p0.y));
        p1 = { x: d.p0.x + Math.sign(p1.x - d.p0.x || 1) * s, y: d.p0.y + Math.sign(p1.y - d.p0.y || 1) * s };
      }
      setDragBoth({ ...d, p1, end });
      return;
    }
    const next = { ...d, x1: p.x, y1: p.y };
    setDragBoth(next);
    const box = rectFromPoints(next.x0, next.y0, next.x1, next.y1);
    const doc = editor.doc;
    const hits = doc.nodes.filter((n) => rectsIntersect(box, nodeBounds(n, doc))).map((n) => n.id);
    editor.select(expandGroups(doc, [...new Set([...next.base, ...hits])]));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    svgRef.current?.releasePointerCapture(e.pointerId);
    const d = dragRef.current;
    setDragBoth(null);
    if (!d) return;
    if (d.kind === 'draw') {
      const dist = Math.hypot(d.p1.x - d.p0.x, d.p1.y - d.p0.y);
      const shape = shapeOfTool(d.tool);
      const clicked = dist * ui.get().zoom < 4;
      if (d.tool === 'line' || d.tool === 'arrow') {
        const p1 = clicked ? { x: d.p0.x + 120, y: d.p0.y } : d.p1;
        addLine([d.p0, p1], {
          endCap: d.tool === 'arrow' ? 'arrow' : 'none',
          start: d.start?.binding,
          end: clicked ? undefined : d.end?.binding,
        });
      } else if (shape) {
        const r = rectFromPoints(d.p0.x, d.p0.y, d.p1.x, d.p1.y);
        addShape(shape, clicked ? { x: d.p0.x - 60, y: d.p0.y - 40, width: 120, height: shape === 'ellipse' ? 90 : 80 } : r);
      } else if (d.tool === 'plot') {
        const r = rectFromPoints(d.p0.x, d.p0.y, d.p1.x, d.p1.y);
        addPlot(clicked || r.width < 60 || r.height < 60 ? { x: d.p0.x - 180, y: d.p0.y - 130, width: 360, height: 260 } : r);
      }
      finishTool();
      return;
    }
    if (d.kind !== 'marquee' && d.kind !== 'pan') editor.seal();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (ui.get().tool !== 'select') return;
    const id = nodeIdAt(e.target);
    const p = toCanvas(e.clientX, e.clientY);
    if (!id) {
      addMath('', { x: snapValue(p.x), y: snapValue(p.y - 20) });
      return;
    }
    const node = editor.doc.nodes.find((n) => n.id === id);
    if (!node || node.locked) return;
    if (node.type === 'text' || node.type === 'shape') ui.set({ editingTextId: id });
    else if (node.type === 'math') ui.set((u) => ({ activeMathId: id, dockOpen: true, focusEditorTick: u.focusEditorTick + 1 }));
    else ui.set((u) => ({ focusLabelTick: u.focusLabelTick + 1 }));
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const id = nodeIdAt(e.target);
    if (id && !editor.selection.includes(id)) editor.select(expandGroups(editor.doc, [id]));
    if (!id) editor.select([]);
    ui.set({ contextMenu: { x: e.clientX, y: e.clientY } });
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropHint(false);
    const p = toCanvas(e.clientX, e.clientY);
    const sym = e.dataTransfer.getData('application/x-quillon-symbol');
    const shape = e.dataTransfer.getData('application/x-quillon-shape');
    const latex = e.dataTransfer.getData('application/x-quillon-latex');
    if (sym) return addSymbol(sym, p);
    if (shape) return addShape(shape as ShapeNode['shape'], { x: p.x - 60, y: p.y - 40, width: 120, height: 80 });
    if (latex) return insertTemplate(latex, { x: p.x - 40, y: p.y - 20 });
    for (const f of [...e.dataTransfer.files]) await importBytes(f.name, new Uint8Array(await f.arrayBuffer()), p);
  };

  const marquee: Rect | null = drag?.kind === 'marquee' ? rectFromPoints(drag.x0, drag.y0, drag.x1, drag.y1) : null;
  const editingNode = editingTextId ? doc.nodes.find((n) => n.id === editingTextId) : undefined;
  const grid = 20 * zoom;
  const px = 1 / zoom;

  const selected = doc.nodes.filter((n) => selSet.has(n.id));
  const single = selected.length === 1 && !selected[0].locked ? selected[0] : null;
  const hover = drag?.kind === 'draw' ? drag.end ?? drag.start : drag?.kind === 'vertex' ? drag.target : null;

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap tool-${tool.split(':')[0]}${panning || drag?.kind === 'pan' ? ' panning' : ''}${dropHint ? ' drop' : ''}`}
      style={{ backgroundSize: `${grid}px ${grid}px, ${grid * 5}px ${grid * 5}px`, backgroundPosition: `${panX}px ${panY}px` }}
      onDragOver={(e) => {
        e.preventDefault();
        setDropHint(true);
      }}
      onDragLeave={() => setDropHint(false)}
      onDrop={onDrop}
      onPointerLeave={() => (pointer.current = null)}
    >
      <svg
        ref={svgRef}
        className="canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
          {doc.nodes.map((n) => (
            <NodeView key={n.id} node={n} layout={getLayout(n, numbers)} selected={selSet.has(n.id)} />
          ))}

          {/* selection outlines */}
          {doc.nodes
            .filter((n) => selSet.has(n.id) || n.id === activeMathId)
            .map((n) => {
              const l = getLayout(n, numbers);
              const cls = selSet.has(n.id) ? 'sel-box' : 'active-box';
              if (n.type === 'line') {
                return <path key={`sel-${n.id}`} className="sel-line" d={/d="([^"]*)"/.exec(l.hit ?? '')?.[1]} transform={`translate(${n.x} ${n.y})`} />;
              }
              const b = boxOf(n, l);
              if (!b) return null;
              const pad = 3 * px;
              const pts = boxCorners({ x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad, rot: b.rot });
              return <polygon key={`sel-${n.id}`} className={cls} points={pts.map((q) => `${q.x},${q.y}`).join(' ')} />;
            })}

          {/* handles */}
          {single && tool === 'select' && <Handles node={single} layout={getLayout(single, numbers)} px={px} />}

          {/* connector target */}
          {hover && (
            <g className="bind-target" pointerEvents="none">
              <rect x={hover.rect.x - 4 * px} y={hover.rect.y - 4 * px} width={hover.rect.width + 8 * px} height={hover.rect.height + 8 * px} rx={4 * px} />
              {hover.ports.map((q, i) => (
                <circle key={i} cx={q.x} cy={q.y} r={4 * px} className={hover.binding.port && q === hover.at ? 'on' : ''} />
              ))}
            </g>
          )}

          {drag?.kind === 'draw' && <Draft drag={drag} />}
          {marquee && <rect className="marquee" x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} />}
        </g>
      </svg>
      {editingNode && (editingNode.type === 'text' || editingNode.type === 'shape') && (
        <TextEditor key={editingNode.id} node={editingNode} zoom={zoom} panX={panX} panY={panY} />
      )}
      {doc.nodes.length === 0 && tool === 'select' && (
        <Welcome />
      )}
    </div>
  );
}

/** Resize / rotate handles for one node, or vertex handles for a line. */
function Handles({ node, layout, px }: { node: SciNode; layout: NodeLayout; px: number }) {
  if (node.type === 'line') {
    const abs = lineAbs(node);
    const pts = node.routing === 'elbow' ? [abs[0], abs[abs.length - 1]] : abs;
    return (
      <g>
        {pts.map((q, i) => {
          const index = node.routing === 'elbow' && i === 1 ? abs.length - 1 : i;
          const bound = (index === 0 && node.start) || (index === abs.length - 1 && node.end);
          return (
            <circle key={i} className={`handle vertex${bound ? ' bound' : ''}`} cx={q.x} cy={q.y} r={4.5 * px} data-handle="vertex" data-index={index} data-node={node.id} />
          );
        })}
      </g>
    );
  }
  const b = boxOf(node, layout);
  if (!b) return null;
  const canRotate = node.type === 'shape' || node.type === 'symbol';
  const corners = node.type === 'math' || node.type === 'text';
  const s = 7 * px;
  const pos: Record<Handle, Point> = {
    nw: { x: 0, y: 0 }, n: { x: b.w / 2, y: 0 }, ne: { x: b.w, y: 0 }, e: { x: b.w, y: b.h / 2 },
    se: { x: b.w, y: b.h }, s: { x: b.w / 2, y: b.h }, sw: { x: 0, y: b.h }, w: { x: 0, y: b.h / 2 },
  };
  const pad = 3 * px;
  return (
    <g transform={`translate(${b.x} ${b.y}) rotate(${b.rot} ${b.w / 2} ${b.h / 2})`}>
      {canRotate && (
        <>
          <line className="rot-stem" x1={b.w / 2} y1={-pad} x2={b.w / 2} y2={-22 * px} />
          <circle className="handle rot" cx={b.w / 2} cy={-24 * px} r={4.5 * px} data-handle="rotate" data-node={node.id} />
        </>
      )}
      {HANDLES.filter((h) => !corners || h.length === 2).map((h) => {
        const q = pos[h];
        const ox = h.includes('w') ? -pad : h.includes('e') ? pad : 0;
        const oy = h.includes('n') ? -pad : h.includes('s') ? pad : 0;
        return <rect key={h} className={`handle h-${h}`} x={q.x + ox - s / 2} y={q.y + oy - s / 2} width={s} height={s} rx={1.5 * px} data-handle={h} data-node={node.id} />;
      })}
    </g>
  );
}

/** Live preview of the node being drawn. */
function Draft({ drag }: { drag: Extract<Drag, { kind: 'draw' }> }) {
  let n: SciNode | null = null;
  const shape = shapeOfTool(drag.tool);
  const r = rectFromPoints(drag.p0.x, drag.p0.y, drag.p1.x, drag.p1.y);
  if (drag.tool === 'line' || drag.tool === 'arrow') {
    if (Math.hypot(drag.p1.x - drag.p0.x, drag.p1.y - drag.p0.y) < 1) return null;
    n = createLineNode({ id: 'draft', ...fromAbs([drag.p0, drag.p1]), endCap: drag.tool === 'arrow' ? 'arrow' : 'none' });
  } else if (shape) {
    if (r.width < 1 && r.height < 1) return null;
    n = createShapeNode({ id: 'draft', shape, x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) });
  } else if (drag.tool === 'plot') {
    return <rect className="marquee" x={r.x} y={r.y} width={r.width} height={r.height} />;
  }
  if (!n) return null;
  const l = layoutNode(n, { measure: measureText });
  return <g className="draft" pointerEvents="none" dangerouslySetInnerHTML={{ __html: nodeGroup(l) }} />;
}

function TextEditor({ node, zoom, panX, panY }: { node: TextNode | ShapeNode; zoom: number; panX: number; panY: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const field = node.type === 'text' ? 'text' : 'label';
  const initial = node.type === 'text' ? node.text : node.label;
  const [value, setValue] = useState(initial);
  const original = useRef(initial);

  // The click that created the box can still steal focus while it finishes; refocus during that window.
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
    const el = ref.current!;
    el.focus();
    el.select();
  }, []);

  const done = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const value = valueRef.current;
    const isText = node.type === 'text';
    if (commit && value !== original.current) {
      editor.seal();
      if (isText && value.trim() === '' && original.current === '') {
        editor.apply('Delete', (d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== node.id) }));
      } else {
        editor.apply(isText ? 'Edit text' : 'Edit label', (d) => updateNodes(d, { [node.id]: { [field]: value } }));
      }
    } else if (isText && original.current === '' && value.trim() === '') {
      // Empty new text box: drop it silently.
      editor.apply('Delete', (d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== node.id) }));
    }
    if (ui.get().editingTextId === node.id) ui.set({ editingTextId: null });
  };
  // Closed some other way (clicking elsewhere, switching tools, undo…): still keep what was typed.
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Deferred so React's StrictMode remount in development does not count as closing.
      setTimeout(() => !alive.current && finishRef.current(true), 0);
    };
  }, []);

  const lines = value.split('\n');
  const isShape = node.type === 'shape';
  const fs = (isShape ? node.labelSize : node.fontSize) * zoom;
  const style: React.CSSProperties = isShape
    ? {
        left: panX + node.x * zoom,
        top: panY + (node.y + node.height / 2) * zoom - (lines.length * fs * 1.3) / 2,
        width: node.width * zoom,
        fontSize: fs,
        textAlign: 'center',
        color: node.labelColor,
      }
    : {
        left: panX + node.x * zoom,
        top: panY + node.y * zoom,
        fontSize: fs,
        fontFamily: node.fontFamily,
        fontWeight: node.bold ? 700 : 400,
        fontStyle: node.italic ? 'italic' : 'normal',
        color: node.color,
        textAlign: node.align ?? 'left',
      };
  return (
    <textarea
      ref={ref}
      className={`text-editor${isShape ? ' label' : ''}`}
      value={value}
      spellCheck={false}
      rows={Math.max(1, lines.length)}
      cols={isShape ? undefined : Math.max(4, ...lines.map((l) => l.length + 1))}
      style={{ ...style, lineHeight: 1.3 }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        // A blur caused by the creating click itself: take focus back instead of closing.
        if (performance.now() - mountedAt.current < 300) return void setTimeout(() => ref.current?.focus(), 0);
        finish(true);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') finish(false);
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || isShape) && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'MATH-FIELD' || el.isContentEditable;
}

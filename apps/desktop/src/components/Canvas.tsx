import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  moveNodes,
  rectFromPoints,
  rectsIntersect,
  updateNodes,
  type NodeId,
  type Rect,
  type SciNode,
  type TextNode,
} from '@sciforge/doc-model';
import type { NodeLayout } from '@sciforge/math-core';
import { addMath, importBytes, viewport, zoomAt } from '../actions';
import { useT } from '../i18n';
import { getLayout, getNumbers, nodeBounds } from '../layout';
import { editor, ui, useEditor, useUi } from '../state/store';

type Drag =
  | { kind: 'move'; startX: number; startY: number; lastX: number; lastY: number; key: string; moved: boolean }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; base: NodeId[] }
  | { kind: 'pan'; sx: number; sy: number; panX: number; panY: number };

let dragSeq = 0;

const NodeView = memo(function NodeView({ node, layout, selected, error }: { node: SciNode; layout: NodeLayout; selected: boolean; error?: string }) {
  return (
    <g transform={`translate(${node.x} ${node.y})`} data-id={node.id} className={`node node-${node.type}${selected ? ' selected' : ''}`}>
      <rect className="hit" width={layout.width} height={layout.height} />
      <g dangerouslySetInnerHTML={{ __html: layout.markup }} />
      {layout.label && (
        <text x={layout.label.x} y={layout.label.y} dominantBaseline="central" fontFamily="Times New Roman, serif" fontSize={layout.label.fontSize} fill={layout.label.color}>
          {layout.label.text}
        </text>
      )}
      {error && <title>{error}</title>}
    </g>
  );
});

export function Canvas() {
  const t = useT();
  const { doc, selection } = useEditor();
  const zoom = useUi((s) => s.zoom);
  const panX = useUi((s) => s.panX);
  const panY = useUi((s) => s.panY);
  const editingTextId = useUi((s) => s.editingTextId);
  const activeMathId = useUi((s) => s.activeMathId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const spaceDown = useRef(false);
  const [panning, setPanning] = useState(false);

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

  const toCanvas = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const { zoom, panX, panY } = ui.get();
    return { x: (clientX - r.left - panX) / zoom, y: (clientY - r.top - panY) / zoom };
  };

  const nodeIdAt = (target: EventTarget | null): NodeId | null => {
    const g = (target as Element | null)?.closest?.('[data-id]');
    return g ? g.getAttribute('data-id') : null;
  };

  const setDragBoth = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    svgRef.current!.setPointerCapture(e.pointerId);
    const { panX, panY } = ui.get();
    if (e.button === 1 || spaceDown.current) {
      setDragBoth({ kind: 'pan', sx: e.clientX, sy: e.clientY, panX, panY });
      return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    const id = nodeIdAt(e.target);
    if (id) {
      const sel = editor.selection;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        editor.select(sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]);
      } else if (!sel.includes(id)) {
        editor.select([id]);
      }
      const node = editor.doc.nodes.find((n) => n.id === id);
      if (node?.type === 'math') ui.set({ activeMathId: id });
      if (ui.get().editingTextId && ui.get().editingTextId !== id) ui.set({ editingTextId: null });
      editor.seal();
      setDragBoth({ kind: 'move', startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, key: `drag-${++dragSeq}`, moved: false });
    } else {
      const base = e.shiftKey || e.ctrlKey || e.metaKey ? editor.selection : [];
      editor.select(base);
      ui.set({ editingTextId: null, activeMathId: null });
      setDragBoth({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, base });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'pan') {
      ui.set({ panX: d.panX + e.clientX - d.sx, panY: d.panY + e.clientY - d.sy });
      return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    if (d.kind === 'move') {
      const dx = Math.round(p.x - d.startX) - Math.round(d.lastX - d.startX);
      const dy = Math.round(p.y - d.startY) - Math.round(d.lastY - d.startY);
      if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) * ui.get().zoom < 3) return;
      if (dx || dy) editor.apply('Move', (doc) => moveNodes(doc, editor.selection, dx, dy), { coalesce: d.key });
      dragRef.current = { ...d, lastX: p.x, lastY: p.y, moved: true };
      return;
    }
    const next = { ...d, x1: p.x, y1: p.y };
    setDragBoth(next);
    const box = rectFromPoints(next.x0, next.y0, next.x1, next.y1);
    const doc = editor.doc;
    const hits = doc.nodes.filter((n) => rectsIntersect(box, nodeBounds(n, doc))).map((n) => n.id);
    editor.select([...new Set([...next.base, ...hits])]);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (dragRef.current?.kind === 'move') editor.seal();
    setDragBoth(null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = nodeIdAt(e.target);
    const p = toCanvas(e.clientX, e.clientY);
    if (!id) {
      addMath('', { x: Math.round(p.x), y: Math.round(p.y - 20) });
      return;
    }
    const node = editor.doc.nodes.find((n) => n.id === id);
    if (node?.type === 'text') ui.set({ editingTextId: id });
    else if (node?.type === 'math') ui.set((u) => ({ activeMathId: id, focusEditorTick: u.focusEditorTick + 1 }));
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const p = toCanvas(e.clientX, e.clientY);
    for (const f of [...e.dataTransfer.files]) await importBytes(f.name, new Uint8Array(await f.arrayBuffer()), p);
  };

  const marquee: Rect | null = drag?.kind === 'marquee' ? rectFromPoints(drag.x0, drag.y0, drag.x1, drag.y1) : null;
  const editingText = editingTextId ? (doc.nodes.find((n) => n.id === editingTextId) as TextNode | undefined) : undefined;
  const grid = 20 * zoom;

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap${panning || drag?.kind === 'pan' ? ' panning' : ''}`}
      style={{ backgroundSize: `${grid}px ${grid}px, ${grid * 5}px ${grid * 5}px`, backgroundPosition: `${panX}px ${panY}px` }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <svg
        ref={svgRef}
        className="canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
          {doc.nodes.map((n) => {
            const l = getLayout(n, numbers);
            return <NodeView key={n.id} node={n} layout={l} selected={selSet.has(n.id)} error={l.error} />;
          })}
          {doc.nodes
            .filter((n) => selSet.has(n.id) || n.id === activeMathId)
            .map((n) => {
              const b = nodeBounds(n, doc);
              const pad = 3 / zoom;
              return (
                <rect
                  key={`sel-${n.id}`}
                  className={selSet.has(n.id) ? 'sel-box' : 'active-box'}
                  x={b.x - pad}
                  y={b.y - pad}
                  width={b.width + 2 * pad}
                  height={b.height + 2 * pad}
                  rx={3 / zoom}
                />
              );
            })}
          {marquee && <rect className="marquee" x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} />}
        </g>
      </svg>
      {editingText && <TextEditor node={editingText} zoom={zoom} panX={panX} panY={panY} />}
      {doc.nodes.length === 0 && <div className="canvas-hint">{t('hintCanvas')}</div>}
    </div>
  );
}

function TextEditor({ node, zoom, panX, panY }: { node: TextNode; zoom: number; panX: number; panY: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(node.text);
  const original = useRef(node.text);

  useEffect(() => {
    const el = ref.current!;
    el.focus();
    el.select();
  }, []);

  const done = useRef(false);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit && value !== original.current) {
      editor.seal();
      if (value.trim() === '' && original.current === '') {
        editor.apply('Delete', (d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== node.id) }));
      } else {
        editor.apply('Edit text', (d) => updateNodes(d, { [node.id]: { text: value } }));
      }
    } else if (original.current === '' && value.trim() === '') {
      // Empty new text box: drop it silently.
      editor.apply('Delete', (d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== node.id) }));
    }
    ui.set({ editingTextId: null });
  };

  const lines = value.split('\n');
  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={value}
      spellCheck={false}
      rows={Math.max(1, lines.length)}
      cols={Math.max(4, ...lines.map((l) => l.length + 1))}
      style={{
        left: panX + node.x * zoom,
        top: panY + node.y * zoom,
        fontSize: node.fontSize * zoom,
        fontFamily: node.fontFamily,
        fontWeight: node.bold ? 700 : 400,
        fontStyle: node.italic ? 'italic' : 'normal',
        color: node.color,
        lineHeight: 1.3,
      }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') finish(false);
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true);
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

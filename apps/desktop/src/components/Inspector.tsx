import { useEffect, useRef } from 'react';
import {
  createPlotFunction,
  createScaleBar,
  DEFAULT_FONT,
  setTitle,
  updateNodes,
  type Corner,
  type Dash,
  type ImageNode,
  type LineCap,
  type LineNode,
  type MathNode,
  type NodePatch,
  type PlotFunction,
  type PlotKind,
  type PlotNode,
  type ScaleBar,
  type SciNode,
  type ShapeKind,
  type ShapeNode,
  type SymbolNode,
  type TextNode,
} from '@quillon/doc-model';
import { checkExpr, cropOf, getSymbol, imageScale, SHAPES } from '@quillon/figure-core';
import {
  align,
  copyForWord,
  createInset,
  niceLength,
  distribute,
  flipSelection,
  groupSelection,
  patchSelection,
  reorder,
  rotateSelection,
  setImageCrop,
  toggleLock,
  ungroupSelection,
} from '../actions';
import { useT, useTr, type StringKey } from '../i18n';
import { getLayout, getNumbers } from '../layout';
import { editor, persist, ui, useEditor, useUi } from '../state/store';
import { Check, ColorField, IconButton, NumberField, Row, Section, Segmented, Select, TextField, type SegOption } from './Controls';
import { CapIcon } from './Icons';

/** The shared value of a field across nodes, or null when they differ. */
function common<T extends SciNode, K extends keyof T>(nodes: T[], key: K): T[K] | null {
  if (!nodes.length) return null;
  const v = nodes[0][key];
  return nodes.every((n) => n[key] === v) ? v : null;
}

const FONTS: { value: string; label: StringKey }[] = [
  { value: DEFAULT_FONT, label: 'fontSans' },
  { value: 'Cambria, "Times New Roman", Times, serif', label: 'fontSerif' },
  { value: 'Consolas, "SF Mono", Menlo, monospace', label: 'fontMono' },
];

export function Inspector() {
  const t = useT();
  const { doc, selection } = useEditor();
  const sel = doc.nodes.filter((n) => selection.includes(n.id));
  const types = [...new Set(sel.map((n) => n.type))];
  const one = sel.length === 1 ? sel[0] : null;

  const typeName: Record<SciNode['type'], StringKey> = {
    math: 'typeMath', text: 'typeText', shape: 'typeShape', line: 'typeLine', plot: 'typePlot', symbol: 'typeSymbol', image: 'typeImage',
  };

  return (
    <aside className="inspector" aria-label={t('properties')}>
      <div className="panel-title">
        <span>{t('properties')}</span>
        {sel.length > 0 && (
          <span className="muted">
            {one ? t(typeName[one.type]) : `${sel.length} ${t('objects')}`}
          </span>
        )}
      </div>
      <div className="panel-scroll">
        {sel.length === 0 ? (
          <DocumentSection />
        ) : (
          <>
            {types.length === 1 && types[0] === 'math' && <MathSection nodes={sel as MathNode[]} />}
            {types.length === 1 && types[0] === 'text' && <TextSection nodes={sel as TextNode[]} />}
            {types.length === 1 && types[0] === 'shape' && <ShapeSection nodes={sel as ShapeNode[]} />}
            {types.length === 1 && types[0] === 'line' && <LineSection nodes={sel as LineNode[]} />}
            {types.length === 1 && types[0] === 'symbol' && <SymbolSection nodes={sel as SymbolNode[]} />}
            {one?.type === 'plot' && <PlotSection node={one} />}
            {one?.type === 'image' && <ImageSection key={one.id} node={one} />}
            {types.length > 1 && <StrokeSection nodes={sel} />}
            <ArrangeSection nodes={sel} />
          </>
        )}
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ document

function DocumentSection() {
  const t = useT();
  const doc = useEditor((s) => s.doc);
  const snap = useUi((s) => s.snap);
  return (
    <>
      <Section title={t('document')}>
        <Row label={t('title')}>
          <TextField value={doc.meta.title} onChange={(v) => editor.apply('Rename', (d) => setTitle(d, v), { coalesce: 'title' })} />
        </Row>
        <Row label={t('eqSize')}>
          <NumberField
            value={doc.settings.defaultFontSize}
            min={6}
            max={200}
            suffix="px"
            onChange={(v) => editor.apply('Settings', (d) => ({ ...d, settings: { ...d.settings, defaultFontSize: v } }), { coalesce: 'settings' })}
          />
        </Row>
        <Row label={t('eqColor')}>
          <ColorField
            value={doc.settings.defaultColor}
            onChange={(v) => editor.apply('Settings', (d) => ({ ...d, settings: { ...d.settings, defaultColor: v } }), { coalesce: 'settings' })}
          />
        </Row>
      </Section>
      <Section title={t('canvas')}>
        <Check
          checked={snap}
          label={t('snapToGrid')}
          onChange={(v) => {
            ui.set({ snap: v });
            persist('quillon:snap', v ? 'on' : 'off');
          }}
        />
      </Section>
      <div className="insp-empty">
        <p>{t('inspectorEmpty')}</p>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ type sections

const patch = (label: string, p: NodePatch, key?: string) => patchSelection(label, p, key);

function MathSection({ nodes }: { nodes: MathNode[] }) {
  const t = useT();
  return (
    <Section title={t('typeMath')}>
      <Row label={t('fontSize')}>
        <NumberField value={common(nodes, 'fontSize')} min={6} max={300} suffix="px" onChange={(v) => patch('Equation size', { fontSize: v }, 'eq-size')} />
      </Row>
      <Row label={t('color')}>
        <ColorField value={common(nodes, 'color')} onChange={(v) => patch('Equation color', { color: v }, 'eq-color')} />
      </Row>
      <div className="insp-checks">
        <Check checked={common(nodes, 'display')} label={t('displayStyle')} onChange={(v) => patch('Display style', { display: v })} />
        <Check checked={common(nodes, 'numbered')} label={t('numbered')} onChange={(v) => patch('Numbering', { numbered: v })} />
      </div>
      <div className="insp-actions">
        <button
          className="btn"
          onClick={() => ui.set((u) => ({ activeMathId: nodes[0].id, dockOpen: true, focusEditorTick: u.focusEditorTick + 1 }))}
        >
          {t('editEquation')}
        </button>
        <button className="btn" onClick={copyForWord}>
          {t('copyForWord')}
        </button>
      </div>
    </Section>
  );
}

function TextSection({ nodes }: { nodes: TextNode[] }) {
  const t = useT();
  const font = common(nodes, 'fontFamily');
  return (
    <Section title={t('typeText')}>
      <Row label={t('font')}>
        <Select
          value={FONTS.some((f) => f.value === font) ? font : null}
          options={FONTS.map((f) => ({ value: f.value, label: t(f.label) }))}
          onChange={(v) => patch('Font', { fontFamily: v })}
        />
      </Row>
      <Row label={t('fontSize')}>
        <NumberField value={common(nodes, 'fontSize')} min={6} max={300} suffix="px" onChange={(v) => patch('Text size', { fontSize: v }, 'text-size')} />
      </Row>
      <Row label={t('color')}>
        <ColorField value={common(nodes, 'color')} onChange={(v) => patch('Text color', { color: v }, 'text-color')} />
      </Row>
      <Row label={t('style')}>
        <div className="seg">
          <button className={common(nodes, 'bold') ? 'on' : ''} title={t('bold')} onClick={() => patch('Bold', { bold: !common(nodes, 'bold') })}>
            <b>B</b>
          </button>
          <button className={common(nodes, 'italic') ? 'on' : ''} title={t('italic')} onClick={() => patch('Italic', { italic: !common(nodes, 'italic') })}>
            <i className="serif">I</i>
          </button>
        </div>
        <Segmented
          value={common(nodes, 'align') ?? (nodes.every((n) => !n.align) ? 'left' : null)}
          options={[
            { value: 'left', icon: 'alignLeft', title: t('alignLeft') },
            { value: 'center', icon: 'alignHCenter', title: t('alignCenter') },
            { value: 'right', icon: 'alignRight', title: t('alignRight') },
          ]}
          onChange={(v) => patch('Text align', { align: v === 'left' ? undefined : v })}
        />
      </Row>
      <p className="insp-note">{t('inlineMathHint')}</p>
    </Section>
  );
}

const DASH_OPTIONS = (t: (k: StringKey) => string): SegOption<Dash>[] => [
  { value: 'solid', title: t('dashSolid'), node: <svg width="22" height="8"><path d="M1 4h20" stroke="currentColor" strokeWidth="1.6" /></svg> },
  { value: 'dashed', title: t('dashDashed'), node: <svg width="22" height="8"><path d="M1 4h20" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 3" /></svg> },
  { value: 'dotted', title: t('dashDotted'), node: <svg width="22" height="8"><path d="M2 4h19" stroke="currentColor" strokeWidth="1.8" strokeDasharray="0.1 3.6" strokeLinecap="round" /></svg> },
];

function StrokeRows({ nodes, fill }: { nodes: (ShapeNode | LineNode | SymbolNode)[]; fill?: boolean }) {
  const t = useT();
  return (
    <>
      {fill && (
        <Row label={t('fill')}>
          <ColorField value={common(nodes as ShapeNode[], 'fill')} allowNone noneLabel={t('none')} onChange={(v) => patch('Fill', { fill: v }, 'fill')} />
        </Row>
      )}
      <Row label={t('stroke')}>
        <ColorField value={common(nodes, 'stroke')} onChange={(v) => patch('Stroke color', { stroke: v }, 'stroke')} />
      </Row>
      <Row label={t('strokeWidth')}>
        <NumberField value={common(nodes, 'strokeWidth')} step={0.5} min={0} max={40} suffix="px" onChange={(v) => patch('Stroke width', { strokeWidth: v }, 'stroke-width')} />
      </Row>
      {nodes.every((n) => n.type !== 'symbol') && (
        <Row label={t('dash')}>
          <Segmented value={common(nodes as ShapeNode[], 'dash')} options={DASH_OPTIONS(t)} onChange={(v) => patch('Dash', { dash: v })} />
        </Row>
      )}
    </>
  );
}

function useLabelFocus() {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const tick = useUi((s) => s.focusLabelTick);
  useEffect(() => {
    if (tick) ref.current?.focus();
  }, [tick]);
  return ref;
}

function ShapeSection({ nodes }: { nodes: ShapeNode[] }) {
  const t = useT();
  const tr = useTr();
  const ref = useLabelFocus();
  return (
    <>
      <Section title={t('typeShape')}>
        <Row label={t('shapeKind')}>
          <Select
            value={common(nodes, 'shape')}
            options={SHAPES.map((s) => ({ value: s.kind, label: tr(s.name) }))}
            onChange={(v: ShapeKind) => patch('Shape', { shape: v })}
          />
        </Row>
        <StrokeRows nodes={nodes} fill />
      </Section>
      <Section title={t('label')}>
        <TextField value={common(nodes, 'label') ?? ''} multiline placeholder={t('labelPlaceholder')} inputRef={ref} onChange={(v) => patch('Label', { label: v }, 'label')} />
        <Row label={t('fontSize')}>
          <NumberField value={common(nodes, 'labelSize')} min={6} max={200} suffix="px" onChange={(v) => patch('Label size', { labelSize: v }, 'label-size')} />
        </Row>
        <Row label={t('color')}>
          <ColorField value={common(nodes, 'labelColor')} onChange={(v) => patch('Label color', { labelColor: v }, 'label-color')} />
        </Row>
      </Section>
    </>
  );
}

function LineSection({ nodes }: { nodes: LineNode[] }) {
  const t = useT();
  const ref = useLabelFocus();
  const caps: LineCap[] = ['none', 'arrow', 'open', 'dot', 'bar'];
  const capOpts = (flip: boolean): SegOption<LineCap>[] =>
    caps.map((c) => ({ value: c, title: t(`cap_${c}` as StringKey), node: <CapIcon cap={c} flip={flip} /> }));
  return (
    <>
      <Section title={t('typeLine')}>
        <StrokeRows nodes={nodes} />
        <Row label={t('startCap')}>
          <Segmented value={common(nodes, 'startCap')} options={capOpts(true)} onChange={(v) => patch('Line start', { startCap: v })} />
        </Row>
        <Row label={t('endCap')}>
          <Segmented value={common(nodes, 'endCap')} options={capOpts(false)} onChange={(v) => patch('Line end', { endCap: v })} />
        </Row>
        <Row label={t('routing')}>
          <Segmented
            value={common(nodes, 'routing')}
            options={[
              { value: 'straight', label: t('routeStraight'), title: t('routeStraight') },
              { value: 'elbow', label: t('routeElbow'), title: t('routeElbow') },
              { value: 'curve', label: t('routeCurve'), title: t('routeCurve') },
            ]}
            onChange={(v) =>
              patchSelection('Routing', (n) => {
                if (n.type !== 'line') return null;
                // A straight two-point line gets a bend point so "curve" visibly curves.
                if (v === 'curve' && n.points.length === 2) {
                  const [a, b] = n.points;
                  const mid = { x: (a.x + b.x) / 2 - (b.y - a.y) * 0.2, y: (a.y + b.y) / 2 + (b.x - a.x) * 0.2 };
                  return { routing: v, points: [a, mid, b] };
                }
                if (v === 'elbow' && n.points.length > 2) return { routing: v, points: [n.points[0], n.points[n.points.length - 1]] };
                return { routing: v };
              })
            }
          />
        </Row>
        {nodes.some((n) => n.start || n.end) && (
          <div className="insp-actions">
            <button className="btn" onClick={() => patch('Detach', { start: undefined, end: undefined })}>
              {t('detach')}
            </button>
          </div>
        )}
      </Section>
      <Section title={t('label')}>
        <TextField value={common(nodes, 'label') ?? ''} placeholder={t('labelPlaceholder')} inputRef={ref} onChange={(v) => patch('Label', { label: v || undefined, labelSize: v ? (nodes[0].labelSize ?? 14) : undefined }, 'label')} />
      </Section>
    </>
  );
}

function SymbolSection({ nodes }: { nodes: SymbolNode[] }) {
  const t = useT();
  const tr = useTr();
  const ref = useLabelFocus();
  const def = getSymbol(nodes[0].symbol);
  const hasAccent = nodes.every((n) => getSymbol(n.symbol)?.prims.some((p) => 'fill' in p && p.fill === 'accent'));
  return (
    <>
      <Section title={nodes.length === 1 && def ? tr(def.name) : t('typeSymbol')}>
        <StrokeRows nodes={nodes} />
        {hasAccent && (
          <Row label={t('fill')}>
            <ColorField value={common(nodes, 'fill')} allowNone noneLabel={t('default')} onChange={(v) => patch('Fill', { fill: v }, 'fill')} />
          </Row>
        )}
      </Section>
      <Section title={t('label')}>
        <TextField value={common(nodes, 'label') ?? ''} placeholder={t('symbolLabelPlaceholder')} inputRef={ref} onChange={(v) => patch('Label', { label: v }, 'label')} />
        <Row label={t('fontSize')}>
          <NumberField value={common(nodes, 'labelSize')} min={6} max={200} suffix="px" onChange={(v) => patch('Label size', { labelSize: v }, 'label-size')} />
        </Row>
      </Section>
    </>
  );
}

function StrokeSection({ nodes }: { nodes: SciNode[] }) {
  const t = useT();
  const stroked = nodes.filter((n): n is ShapeNode | LineNode | SymbolNode => n.type === 'shape' || n.type === 'line' || n.type === 'symbol');
  if (!stroked.length) return null;
  return (
    <Section title={t('stroke')}>
      <Row label={t('color')}>
        <ColorField value={common(stroked, 'stroke')} onChange={(v) => patchSelection('Stroke color', (n) => ('stroke' in n ? { stroke: v } : null), 'stroke')} />
      </Row>
      <Row label={t('strokeWidth')}>
        <NumberField value={common(stroked, 'strokeWidth')} step={0.5} min={0} max={40} suffix="px" onChange={(v) => patchSelection('Stroke width', (n) => ('strokeWidth' in n ? { strokeWidth: v } : null), 'stroke-width')} />
      </Row>
    </Section>
  );
}

// ------------------------------------------------------------------ plot

function PlotSection({ node }: { node: PlotNode }) {
  const t = useT();
  const setPlot = (label: string, p: NodePatch, key?: string) => editor.apply(label, (d) => updateNodes(d, { [node.id]: p }), { coalesce: key });
  const setFn = (i: number, p: Partial<PlotFunction>, key?: string) =>
    setPlot('Edit function', { functions: node.functions.map((f, j) => (j === i ? { ...f, ...p } : f)) }, key ? `${key}-${node.id}-${i}` : undefined);
  const ref = useLabelFocus();
  const COLORS = ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00', '#56b4e9', '#1f2937'];
  const range = (k: 'xMin' | 'xMax' | 'yMin' | 'yMax') => (v: number) => {
    const next = { ...node, [k]: v };
    if (next.xMax > next.xMin && next.yMax > next.yMin) setPlot('Plot range', { [k]: v }, `range-${node.id}`);
  };
  return (
    <>
      <Section
        title={t('functions')}
        actions={
          <button
            className="link-btn"
            onClick={() => {
              editor.seal();
              setPlot('Add function', { functions: [...node.functions, createPlotFunction({ expr: 'cos(x)', color: COLORS[node.functions.length % COLORS.length] })] });
            }}
          >
            + {t('addFunction')}
          </button>
        }
      >
        {node.functions.length === 0 && <p className="insp-note">{t('noFunctions')}</p>}
        {node.functions.map((f, i) => {
          const vars = f.kind === 'y' ? ['x'] : ['t'];
          const err = checkExpr(f.expr, vars) ?? (f.kind === 'param' ? checkExpr(f.expr2 ?? '', vars) : null);
          return (
            <div key={f.id} className="fn-card">
              <div className="fn-head">
                <Select<PlotKind>
                  value={f.kind}
                  options={[
                    { value: 'y', label: 'y = f(x)' },
                    { value: 'param', label: t('parametric') },
                    { value: 'polar', label: t('polar') },
                  ]}
                  onChange={(k) => {
                    const fresh = createPlotFunction({ kind: k, color: f.color, width: f.width, dash: f.dash, label: f.label });
                    setFn(i, { ...fresh, id: f.id, label: f.label });
                  }}
                />
                <ColorField value={f.color} onChange={(c) => setFn(i, { color: c }, 'color')} />
                <IconButton
                  icon="close"
                  title={t('remove')}
                  onClick={() => {
                    editor.seal();
                    setPlot('Remove function', { functions: node.functions.filter((_, j) => j !== i) });
                  }}
                />
              </div>
              <div className="fn-expr">
                <span className="fn-var">{f.kind === 'y' ? 'y =' : f.kind === 'param' ? 'x(t) =' : 'r(θ) ='}</span>
                <TextField mono value={f.expr} invalid={!!checkExpr(f.expr, vars)} inputRef={i === 0 ? ref : undefined} onChange={(v) => setFn(i, { expr: v }, 'expr')} />
              </div>
              {f.kind === 'param' && (
                <div className="fn-expr">
                  <span className="fn-var">y(t) =</span>
                  <TextField mono value={f.expr2 ?? ''} invalid={!!checkExpr(f.expr2 ?? '', vars)} onChange={(v) => setFn(i, { expr2: v }, 'expr2')} />
                </div>
              )}
              {f.kind !== 'y' && (
                <div className="fn-range">
                  <NumberField label={f.kind === 'polar' ? 'θ' : 't'} value={f.tMin ?? 0} step={0.1} onChange={(v) => setFn(i, { tMin: v }, 'tmin')} />
                  <span className="muted">…</span>
                  <NumberField value={f.tMax ?? 6.283} step={0.1} onChange={(v) => setFn(i, { tMax: v }, 'tmax')} />
                </div>
              )}
              {err && <p className="fn-error">{err}</p>}
              <div className="fn-style">
                <NumberField value={f.width} step={0.5} min={0.25} max={12} suffix="px" onChange={(v) => setFn(i, { width: v }, 'width')} />
                <Segmented value={f.dash} options={DASH_OPTIONS(t)} onChange={(v) => setFn(i, { dash: v })} />
              </div>
              <TextField value={f.label ?? ''} placeholder={t('legendLabel')} onChange={(v) => setFn(i, { label: v || undefined }, 'label')} />
            </div>
          );
        })}
        <p className="insp-note">{t('exprHint')}</p>
      </Section>
      <Section title={t('axes')}>
        <div className="range-grid">
          <span className="muted">x</span>
          <NumberField value={node.xMin} step={0.5} onChange={range('xMin')} />
          <NumberField value={node.xMax} step={0.5} onChange={range('xMax')} />
          <span className="muted">y</span>
          <NumberField value={node.yMin} step={0.5} onChange={range('yMin')} />
          <NumberField value={node.yMax} step={0.5} onChange={range('yMax')} />
        </div>
        <Row label={t('axesStyle')}>
          <Segmented
            value={node.axes}
            options={[
              { value: 'cross', label: t('axesCross'), title: t('axesCrossHint') },
              { value: 'box', label: t('axesBox'), title: t('axesBoxHint') },
            ]}
            onChange={(v) => setPlot('Axes', { axes: v })}
          />
        </Row>
        <Row label={t('xLabel')}>
          <TextField value={node.xLabel} onChange={(v) => setPlot('Axis label', { xLabel: v }, `xl-${node.id}`)} />
        </Row>
        <Row label={t('yLabel')}>
          <TextField value={node.yLabel} onChange={(v) => setPlot('Axis label', { yLabel: v }, `yl-${node.id}`)} />
        </Row>
        <Row label={t('fontSize')}>
          <NumberField value={node.fontSize} min={6} max={48} suffix="px" onChange={(v) => setPlot('Plot font', { fontSize: v }, `pf-${node.id}`)} />
        </Row>
        <div className="insp-checks">
          <Check checked={node.grid} label={t('grid')} onChange={(v) => setPlot('Grid', { grid: v })} />
          <Check checked={node.legend} label={t('legend')} onChange={(v) => setPlot('Legend', { legend: v })} />
        </div>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ image

function ImageSection({ node }: { node: ImageNode }) {
  const t = useT();
  const set = (label: string, p: NodePatch, key?: string) => editor.apply(label, (d) => updateNodes(d, { [node.id]: p }), { coalesce: key ? `${key}-${node.id}` : undefined });
  const c = cropOf(node);
  const pct = (v: number) => Math.round(v * 1000) / 10;
  const edge = (side: 'l' | 't' | 'r' | 'b') => (v: number) => {
    const f = Math.min(99, Math.max(0, v)) / 100;
    let { x, y, width, height } = c;
    if (side === 'l') {
      const right = x + width;
      x = Math.min(f, right - 0.01);
      width = right - x;
    } else if (side === 't') {
      const bottom = y + height;
      y = Math.min(f, bottom - 0.01);
      height = bottom - y;
    } else if (side === 'r') width = Math.max(0.01, 1 - f - x);
    else height = Math.max(0.01, 1 - f - y);
    setImageCrop(node, { x, y, width, height }, `crop-${side}-${node.id}`);
  };
  const bar = node.scaleBar;
  const setBar = (p: Partial<ScaleBar>, key?: string) => bar && set('Scale bar', { scaleBar: { ...bar, ...p } }, key);
  const adjusted = node.brightness !== 100 || node.contrast !== 100 || node.saturation !== 100 || node.grayscale || node.invert || node.opacity !== 1;
  const { sx } = imageScale(node);
  return (
    <>
      <Section title={t('typeImage')}>
        <p className="insp-note img-meta" title={node.name}>
          {node.name ? <span className="img-name">{node.name}</span> : null}
          <span>
            {t('originalSize')}: {node.naturalWidth} × {node.naturalHeight} px · {Math.round(sx * 100)}%
          </span>
        </p>
        <div className="insp-actions">
          <button
            className="btn"
            onClick={() => set('Resize', { width: Math.round(c.width * node.naturalWidth), height: Math.round(c.height * node.naturalHeight) })}
          >
            {t('actualPixels')}
          </button>
          {!node.inset && (
            <button className="btn" onClick={() => createInset(node)}>
              {t('createInset')}
            </button>
          )}
        </div>
        {node.inset && <p className="insp-note">{t('insetHint')}</p>}
      </Section>
      <Section
        title={t('crop')}
        actions={
          node.crop ? (
            <button className="link-btn" onClick={() => setImageCrop(node, { x: 0, y: 0, width: 1, height: 1 })}>
              {t('resetCrop')}
            </button>
          ) : undefined
        }
      >
        <div className="crop-grid">
          <NumberField label={t('cropLeft')} value={pct(c.x)} min={0} max={99} step={1} suffix="%" onChange={edge('l')} />
          <NumberField label={t('cropRight')} value={pct(1 - c.x - c.width)} min={0} max={99} step={1} suffix="%" onChange={edge('r')} />
          <NumberField label={t('cropTop')} value={pct(c.y)} min={0} max={99} step={1} suffix="%" onChange={edge('t')} />
          <NumberField label={t('cropBottom')} value={pct(1 - c.y - c.height)} min={0} max={99} step={1} suffix="%" onChange={edge('b')} />
        </div>
      </Section>
      <Section
        title={t('adjustments')}
        actions={
          adjusted ? (
            <button
              className="link-btn"
              onClick={() => set('Reset adjustments', { brightness: 100, contrast: 100, saturation: 100, grayscale: undefined, invert: undefined, opacity: 1 })}
            >
              {t('reset')}
            </button>
          ) : undefined
        }
      >
        <Slider label={t('brightness')} value={node.brightness} min={0} max={200} onChange={(v) => set('Brightness', { brightness: v }, 'bright')} />
        <Slider label={t('contrast')} value={node.contrast} min={0} max={200} onChange={(v) => set('Contrast', { contrast: v }, 'contrast')} />
        <Slider label={t('saturation')} value={node.saturation} min={0} max={200} disabled={!!node.grayscale} onChange={(v) => set('Saturation', { saturation: v }, 'sat')} />
        <Slider label={t('opacity')} value={Math.round(node.opacity * 100)} min={0} max={100} onChange={(v) => set('Opacity', { opacity: v / 100 }, 'opacity')} />
        <div className="insp-checks">
          <Check checked={!!node.grayscale} label={t('grayscale')} onChange={(v) => set('Grayscale', { grayscale: v || undefined })} />
          <Check checked={!!node.invert} label={t('invert')} onChange={(v) => set('Invert', { invert: v || undefined })} />
        </div>
        <Row label={t('frame')}>
          <ColorField value={node.border} allowNone noneLabel={t('none')} onChange={(v) => set('Frame', { border: v }, 'border')} />
          {node.border !== 'none' && (
            <NumberField value={node.borderWidth} min={0} max={20} step={0.5} suffix="px" onChange={(v) => set('Frame width', { borderWidth: v }, 'border-w')} />
          )}
        </Row>
      </Section>
      <Section
        title={t('scaleBar')}
        actions={
          bar ? (
            <button className="link-btn" onClick={() => set('Remove scale bar', { scaleBar: undefined })}>
              {t('remove')}
            </button>
          ) : (
            <button className="link-btn" onClick={() => set('Add scale bar', { scaleBar: createScaleBar({ length: niceBarLength(node) }) })}>
              {t('addScaleBar')}
            </button>
          )
        }
      >
        {bar && (
          <>
            <Row label={t('pixelSize')}>
              <NumberField value={bar.unitsPerPixel} min={1e-9} step={0.01} onChange={(v) => setBar({ unitsPerPixel: v }, 'bar-cal')} />
              <Select
                value={UNITS.includes(bar.unit) ? bar.unit : null}
                options={UNITS.map((u) => ({ value: u, label: `${u}/px` }))}
                onChange={(u) => setBar({ unit: u })}
              />
            </Row>
            <Row label={t('barLength')}>
              <NumberField value={bar.length} min={1e-9} step={1} suffix={bar.unit} onChange={(v) => setBar({ length: v }, 'bar-len')} />
            </Row>
            <Row label={t('position')}>
              <Segmented
                value={bar.position}
                options={[
                  { value: 'tl', label: '↖', title: t('cornerTl') },
                  { value: 'tr', label: '↗', title: t('cornerTr') },
                  { value: 'bl', label: '↙', title: t('cornerBl') },
                  { value: 'br', label: '↘', title: t('cornerBr') },
                ]}
                onChange={(v: Corner) => setBar({ position: v })}
              />
            </Row>
            <Row label={t('color')}>
              <ColorField value={bar.color} onChange={(v) => setBar({ color: v }, 'bar-color')} />
            </Row>
            <Check checked={bar.showLabel} label={t('showLength')} onChange={(v) => setBar({ showLabel: v })} />
            <p className="insp-note">{t('scaleBarHint')}</p>
          </>
        )}
      </Section>
    </>
  );
}

const UNITS = ['nm', 'µm', 'mm', 'cm', 'm', 'km', 'Å', 'px'];

/** A round bar length of about a fifth of the visible width, in the default calibration (1 unit/px). */
const niceBarLength = (n: ImageNode) => niceLength((cropOf(n).width * n.naturalWidth) / 5);

function Slider({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className={`insp-row slider-row${disabled ? ' disabled' : ''}`}>
      <label>{label}</label>
      <div className="insp-ctl">
        <input
          type="range"
          className="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onPointerDown={() => editor.seal()}
          onPointerUp={() => editor.seal()}
          onDoubleClick={() => onChange(100)}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
        />
        <span className="range-val">{value}%</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ arrange

function ArrangeSection({ nodes }: { nodes: SciNode[] }) {
  const t = useT();
  const doc = useEditor((s) => s.doc);
  const one = nodes.length === 1 ? nodes[0] : null;
  const l = one ? getLayout(one, getNumbers(doc)) : null;
  const sized = one && (one.type === 'shape' || one.type === 'symbol' || one.type === 'plot' || one.type === 'image') ? one : null;
  // Images keep their aspect ratio when one side is typed in.
  const setW = (v: number) => sized && (sized.type === 'image' ? set('Resize', { width: v, height: Math.round((v * sized.height) / sized.width) }, 'w') : set('Resize', { width: v }, 'w'));
  const setH = (v: number) => sized && (sized.type === 'image' ? set('Resize', { height: v, width: Math.round((v * sized.width) / sized.height) }, 'h') : set('Resize', { height: v }, 'h'));
  const rotatable = nodes.filter((n): n is ShapeNode | SymbolNode => n.type === 'shape' || n.type === 'symbol');
  const grouped = nodes.some((n) => n.group);
  const locked = nodes.every((n) => n.locked);
  const set = (label: string, p: NodePatch, key: string) => one && editor.apply(label, (d) => updateNodes(d, { [one.id]: p }), { coalesce: `${key}-${one.id}` });
  return (
    <Section title={t('arrange')}>
      {one && one.type !== 'line' && (
        <div className="xywh">
          <NumberField label="X" value={one.x} onChange={(v) => set('Move', { x: v }, 'x')} />
          <NumberField label="Y" value={one.y} onChange={(v) => set('Move', { y: v }, 'y')} />
          {sized ? (
            <>
              <NumberField label="W" value={Math.round(sized.width)} min={4} onChange={setW} />
              <NumberField label="H" value={Math.round(sized.height)} min={4} onChange={setH} />
            </>
          ) : (
            l && (
              <span className="xywh-size muted">
                {Math.round(l.width)} × {Math.round(l.height)}
              </span>
            )
          )}
        </div>
      )}
      {rotatable.length > 0 && (
        <Row label={t('rotation')}>
          <NumberField value={common(rotatable, 'rotation')} suffix="°" step={15} onChange={(v) => patchSelection('Rotate', (n) => ('rotation' in n ? { rotation: ((v % 360) + 360) % 360 } : null), 'rotation')} />
          <IconButton icon="rotate" title={`${t('rotate90')} (Ctrl+R)`} onClick={() => rotateSelection(90)} />
          {rotatable.some((n) => n.type === 'symbol') && <IconButton icon="flip" title={t('flip')} onClick={flipSelection} />}
        </Row>
      )}
      {nodes.length >= 2 && (
        <div className="tool-row">
          <IconButton icon="alignLeft" title={t('alignLeft')} onClick={() => align('left')} />
          <IconButton icon="alignHCenter" title={t('alignCenter')} onClick={() => align('hcenter')} />
          <IconButton icon="alignRight" title={t('alignRight')} onClick={() => align('right')} />
          <IconButton icon="alignTop" title={t('alignTop')} onClick={() => align('top')} />
          <IconButton icon="alignVCenter" title={t('alignMiddle')} onClick={() => align('vcenter')} />
          <IconButton icon="alignBottom" title={t('alignBottom')} onClick={() => align('bottom')} />
          <IconButton icon="distH" title={t('distributeH')} onClick={() => distribute('h')} disabled={nodes.length < 3} />
          <IconButton icon="distV" title={t('distributeV')} onClick={() => distribute('v')} disabled={nodes.length < 3} />
        </div>
      )}
      <div className="tool-row">
        <IconButton icon="front" title={`${t('bringFront')} (Ctrl+])`} onClick={() => reorder('front')} />
        <IconButton icon="back" title={`${t('sendBack')} (Ctrl+[)`} onClick={() => reorder('back')} />
        <span className="tool-gap" />
        {nodes.length >= 2 && <IconButton icon="group" title={`${t('group')} (Ctrl+G)`} onClick={groupSelection} />}
        {grouped && <IconButton icon="ungroup" title={`${t('ungroup')} (Ctrl+Shift+G)`} onClick={ungroupSelection} />}
        <IconButton icon={locked ? 'lock' : 'unlock'} on={locked} title={locked ? t('unlock') : t('lock')} onClick={toggleLock} />
      </div>
    </Section>
  );
}

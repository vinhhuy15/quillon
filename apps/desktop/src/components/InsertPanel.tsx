import { memo, useMemo, useState } from 'react';
import { SHAPES, SYMBOL_CATEGORIES, SYMBOLS, shapeElement, symbolMarkup, type SymbolDef } from '@sciforge/figure-core';
import type { ShapeKind } from '@sciforge/doc-model';
import { addSymbol, insertTemplate } from '../actions';
import { useT, useTr } from '../i18n';
import { library, useLibrary } from '../state/library';
import { persist, ui, useUi, type PanelTab } from '../state/store';
import { TEMPLATES } from '../templates-data';
import { setTool } from '../tools';
import { Icon } from './Icons';
import { MathIcon } from './MathIcon';

const ShapePreview = memo(function ShapePreview({ kind }: { kind: ShapeKind }) {
  const w = 34, h = kind === 'ellipse' || kind === 'diamond' || kind === 'hexagon' || kind === 'triangle' ? 26 : 22;
  const html = shapeElement(kind, w, h, 'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"');
  return <svg width={w + 2} height={h + 2} viewBox={`-1 -1 ${w + 2} ${h + 2}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

const SymbolPreview = memo(function SymbolPreview({ def }: { def: SymbolDef }) {
  const s = Math.min(46 / def.w, 34 / def.h, 1);
  const w = def.w * s, h = def.h * s;
  const html = symbolMarkup({ def, width: w, height: h, stroke: 'currentColor', strokeWidth: 1.2, fill: 'none' });
  return <svg width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

const drag = (type: string, value: string) => (e: React.DragEvent) => {
  e.dataTransfer.setData(type, value);
  e.dataTransfer.effectAllowed = 'copy';
};

export function InsertPanel() {
  const t = useT();
  const tr = useTr();
  const tab = useUi((s) => s.panelTab);
  const tool = useUi((s) => s.tool);
  const items = useLibrary();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const match = (...s: string[]) => !query || s.some((x) => x.toLowerCase().includes(query));

  const setTab = (id: PanelTab) => {
    ui.set({ panelTab: id });
    persist('sciforge:panel-tab', id);
  };

  const groups = useMemo(
    () =>
      TEMPLATES.map((g) => ({ ...g, items: g.items.filter((it) => match(it.title, tr(it.title), it.latex)) })).filter((g) => g.items.length),
    [query, tr],
  );

  const TABS: { id: PanelTab; label: string }[] = [
    { id: 'templates', label: t('templates') },
    { id: 'shapes', label: t('tabShapes') },
    { id: 'library', label: t('myLibrary') },
  ];

  return (
    <aside className="insert-panel" aria-label={t('insert')}>
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
            {x.label}
            {x.id === 'library' && items.length > 0 && <span className="count">{items.length}</span>}
          </button>
        ))}
      </div>
      {tab !== 'library' && (
        <div className="search">
          <Icon name="search" size={14} />
          <input type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        </div>
      )}
      <div className="panel-scroll">
        {tab === 'templates' &&
          groups.map((g) => (
            <section key={g.id} className="ins-group">
              <h3>{tr(g.label)}</h3>
              <div className="tpl-list">
                {g.items.map((it) => (
                  <button
                    key={it.latex}
                    className="tpl-card"
                    title={tr(it.title)}
                    draggable
                    onDragStart={drag('application/x-sciforge-latex', it.latex)}
                    onClick={() => insertTemplate(it.latex)}
                  >
                    <MathIcon latex={it.latex} size={13} display maxWidth={210} maxHeight={64} />
                    <span>{tr(it.title)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

        {tab === 'shapes' && (
          <>
            {SHAPES.some((s) => match(s.name, tr(s.name), s.hint ?? '')) && (
              <section className="ins-group">
                <h3>{t('shapesFlowchart')}</h3>
                <div className="tile-grid">
                  {SHAPES.filter((s) => match(s.name, tr(s.name), s.hint ?? '')).map((s) => (
                    <button
                      key={s.kind}
                      className={`tile${tool === `shape:${s.kind}` ? ' on' : ''}`}
                      title={`${tr(s.name)}${s.hint ? ` — ${tr(s.hint)}` : ''}\n${t('shapeTileHint')}`}
                      draggable
                      onDragStart={drag('application/x-sciforge-shape', s.kind)}
                      onClick={() => setTool(`shape:${s.kind}`)}
                    >
                      <ShapePreview kind={s.kind} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {SYMBOL_CATEGORIES.map((c) => {
              const list = SYMBOLS.filter((s) => s.category === c.id && match(s.name, tr(s.name), c.name, tr(c.name)));
              if (!list.length) return null;
              return (
                <section key={c.id} className="ins-group">
                  <h3>{tr(c.name)}</h3>
                  <div className="tile-grid">
                    {list.map((s) => (
                      <button
                        key={s.id}
                        className="tile"
                        title={tr(s.name)}
                        draggable
                        onDragStart={drag('application/x-sciforge-symbol', s.id)}
                        onClick={() => addSymbol(s.id)}
                      >
                        <SymbolPreview def={s} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            <p className="panel-note">{t('symbolsHint')}</p>
          </>
        )}

        {tab === 'library' && (
          <>
            {items.length === 0 && <p className="panel-note">{t('libraryEmpty')}</p>}
            <div className="tpl-list">
              {items.map((it) => (
                <div key={it.id} className="tpl-card lib">
                  <button className="tpl-insert" title={it.latex} draggable onDragStart={drag('application/x-sciforge-latex', it.latex)} onClick={() => insertTemplate(it.latex)}>
                    <MathIcon latex={it.latex} size={13} display maxWidth={210} maxHeight={64} />
                  </button>
                  <button className="tpl-remove" title={t('remove')} aria-label={t('remove')} onClick={() => library.remove(it.id)}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

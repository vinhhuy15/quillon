import { useEffect, useState, useSyncExternalStore } from 'react';
import { defaultColumns, PANEL_LABEL_STYLES, panelLabel, type PanelLabelStyle } from '@quillon/figure-core';
import { composeFigure, exportFile, exportSize, selectionPanels, type ExportFormat } from '../actions';
import { JOURNAL_PRESETS, MIN_FONT_PT } from '../journal-presets';
import { useT, useTr, type StringKey } from '../i18n';
import { persist, toasts, ui, useEditor, useUi } from '../state/store';
import { Icon } from './Icons';
import { LOGO } from './TopBar';

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

const FORMATS: { id: ExportFormat; name: string; desc: StringKey }[] = [
  { id: 'png', name: 'PNG', desc: 'fmtPng' },
  { id: 'svg', name: 'SVG', desc: 'fmtSvg' },
  { id: 'docx', name: 'Word', desc: 'fmtDocx' },
  { id: 'tikz', name: 'TikZ', desc: 'fmtTikz' },
  { id: 'tex', name: 'LaTeX', desc: 'fmtTex' },
  { id: 'html', name: 'HTML', desc: 'fmtHtml' },
];

export function ExportDialog() {
  const t = useT();
  const open = useUi((s) => s.exportOpen);
  const hasSel = useEditor((s) => s.selection.length > 0);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scope, setScope] = useState<'selection' | 'all'>('all');
  const [dpi, setDpi] = useState(300);
  const [bg, setBg] = useState<'transparent' | 'white'>('transparent');
  const [preset, setPreset] = useState<string>(() => {
    try {
      return localStorage.getItem('quillon:export-size') ?? '';
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);
  const tr = useTr();
  const doc = useEditor((s) => s.doc);

  useEffect(() => {
    if (open) setScope(hasSel ? 'selection' : 'all');
  }, [open, hasSel]);

  if (!open) return null;
  const close = () => ui.set({ exportOpen: false });
  const raster = format === 'png';
  const sizable = raster || format === 'svg';
  const widthMm = sizable ? JOURNAL_PRESETS.find((p) => p.id === preset)?.widthMm ?? null : null;
  void doc; // re-measure when the document changes
  const size = sizable ? exportSize(scope, widthMm, dpi) : null;
  const run = async () => {
    setBusy(true);
    const ok = await exportFile({ format, scope, dpi, background: bg === 'white' ? '#ffffff' : null, widthMm });
    setBusy(false);
    if (ok) close();
  };

  return (
    <Modal title={t('exportTitle')} onClose={close}>
      <div className="format-grid" role="radiogroup" aria-label={t('format')}>
        {FORMATS.map((f) => (
          <button key={f.id} role="radio" aria-checked={format === f.id} className={`format-card${format === f.id ? ' on' : ''}`} onClick={() => setFormat(f.id)}>
            <b>{f.name}</b>
            <span>{t(f.desc)}</span>
          </button>
        ))}
      </div>
      <div className="form-rows">
        <div className="form-row">
          <span>{t('scope')}</span>
          <div className="seg">
            <button className={scope === 'selection' ? 'on' : ''} disabled={!hasSel} onClick={() => setScope('selection')}>
              {t('scopeSelection')}
            </button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
              {t('scopeAll')}
            </button>
          </div>
        </div>
        {sizable && (
          <div className="form-row">
            <span>{t('figureSize')}</span>
            <select
              className="select"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                persist('quillon:export-size', e.target.value);
              }}
            >
              <option value="">{t('asOnScreen')}</option>
              {[...new Set(JOURNAL_PRESETS.map((p) => p.journal))].map((j) => (
                <optgroup key={j} label={tr(j)}>
                  {JOURNAL_PRESETS.filter((p) => p.journal === j).map((p) => (
                    <option key={p.id} value={p.id}>
                      {tr(p.journal)} · {tr(p.size)} ({p.widthMm} mm)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
        {raster && (
          <div className="form-row">
            <span>{t('resolution')}</span>
            <select className="select" value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
              {[96, 150, 300, 600, 1200].map((d) => (
                <option key={d} value={d}>
                  {d} DPI
                </option>
              ))}
            </select>
          </div>
        )}
        {(raster || format === 'svg') && (
          <div className="form-row">
            <span>{t('background')}</span>
            <div className="seg">
              <button className={bg === 'transparent' ? 'on' : ''} onClick={() => setBg('transparent')}>
                {t('transparent')}
              </button>
              <button className={bg === 'white' ? 'on' : ''} onClick={() => setBg('white')}>
                {t('white')}
              </button>
            </div>
          </div>
        )}
      </div>
      {size && (
        <div className="export-size">
          <span>
            {t('output')}: <b>{fmtMm(size.widthMm)} × {fmtMm(size.heightMm)} mm</b>
            {raster && <> · {size.widthPx} × {size.heightPx} px</>}
          </span>
          {size.minFontPt !== null && (
            <span className={size.minFontPt < MIN_FONT_PT ? 'warn' : ''}>
              {t('smallestText')}: {size.minFontPt.toFixed(1)} pt{size.minFontPt < MIN_FONT_PT ? ` — ${t('textTooSmall')}` : ''}
            </span>
          )}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          {t('cancel')}
        </button>
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? '…' : t('exportBtn')}
        </button>
      </div>
    </Modal>
  );
}

const fmtMm = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));

export function FigureDialog() {
  const t = useT();
  const open = useUi((s) => s.figureOpen);
  const selection = useEditor((s) => s.selection);
  const count = open ? selectionPanels().length : 0;
  const [columns, setColumns] = useState(2);
  const [gap, setGap] = useState(16);
  const [equalWidth, setEqualWidth] = useState(true);
  const [labels, setLabels] = useState<PanelLabelStyle | ''>('a');
  const [labelSize, setLabelSize] = useState(18);

  useEffect(() => {
    if (open) setColumns(defaultColumns(Math.max(1, selectionPanels().length)));
  }, [open, selection]);

  if (!open) return null;
  const close = () => ui.set({ figureOpen: false });
  const apply = () => {
    composeFigure({ columns, gap, equalWidth, labels: labels || null, labelSize });
    close();
  };
  const rows = Math.ceil(count / Math.max(1, columns));
  return (
    <Modal title={t('figureLayoutTitle')} onClose={close}>
      {count < 2 ? (
        <p className="modal-note">{t('selectPanels')}</p>
      ) : (
        <>
          <p className="modal-note">
            {count} {t('panels')} · {t('figureLayoutHint')}
          </p>
          <div className="figure-preview" style={{ gridTemplateColumns: `repeat(${Math.min(columns, count)}, 1fr)` }} aria-hidden>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="figure-cell">
                {labels && <b>{panelLabel(i, labels)}</b>}
              </div>
            ))}
          </div>
          <div className="form-rows">
            <div className="form-row">
              <span>{t('columns')}</span>
              <div className="seg">
                {Array.from({ length: Math.min(count, 6) }, (_, i) => i + 1).map((c) => (
                  <button key={c} className={columns === c ? 'on' : ''} onClick={() => setColumns(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <span>{t('spacing')}</span>
              <div className="seg">
                {[8, 16, 24, 40].map((g) => (
                  <button key={g} className={gap === g ? 'on' : ''} onClick={() => setGap(g)}>
                    {g}px
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <span>{t('figureSize')}</span>
              <label className="check">
                <input type="checkbox" checked={equalWidth} onChange={(e) => setEqualWidth(e.target.checked)} />
                <span>{t('sameWidth')}</span>
              </label>
            </div>
            <div className="form-row">
              <span>{t('panelLabels')}</span>
              <div className="seg">
                <button className={labels === '' ? 'on' : ''} onClick={() => setLabels('')}>
                  {t('none')}
                </button>
                {PANEL_LABEL_STYLES.map((st) => (
                  <button key={st} className={labels === st ? 'on' : ''} onClick={() => setLabels(st)}>
                    {panelLabel(0, st)}
                  </button>
                ))}
              </div>
            </div>
            {labels && (
              <div className="form-row">
                <span>{t('labelSize')}</span>
                <div className="seg">
                  {[14, 18, 24, 32].map((z) => (
                    <button key={z} className={labelSize === z ? 'on' : ''} onClick={() => setLabelSize(z)}>
                      {z}px
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="modal-note muted">
            {Math.min(columns, count)} × {rows}
          </p>
        </>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          {t('cancel')}
        </button>
        <button className="btn primary" onClick={apply} disabled={count < 2}>
          {t('apply')}
        </button>
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ['V · H', 'Select · Hand (pan)'],
  ['M · T', 'Equation · Text'],
  ['R · O · L · A', 'Rectangle · Ellipse · Line · Arrow'],
  ['P', 'Function plot'],
  ['I', 'Insert image (or drop / paste a picture)'],
  ['Ctrl+Shift+L', 'Figure layout (two or more objects selected)'],
  ['Shift (while drawing)', 'Square / circle, 15° angles, keep proportions'],
  ['Double-click', 'Edit equation, text or label · empty space: new equation'],
  ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'],
  ['Ctrl+C / X / V', 'Copy / Cut / Paste (pasting LaTeX creates an equation)'],
  ['Ctrl+Shift+C', 'Copy for Word'],
  ['Ctrl+D', 'Duplicate'],
  ['Ctrl+G / Ctrl+Shift+G', 'Group / Ungroup'],
  ['Ctrl+R', 'Rotate 90°'],
  ['Ctrl+L', 'Lock / Unlock'],
  ['Ctrl+] / Ctrl+[', 'Bring to front / Send to back'],
  ['Delete', 'Delete'],
  ['← ↑ → ↓ (+Shift)', 'Nudge 1px (10px)'],
  ['Ctrl+wheel · Ctrl+= / −', 'Zoom in / out'],
  ['Ctrl+0 · Ctrl+1', 'Zoom to fit · 100%'],
  ['Space + drag', 'Pan the view'],
  ['Ctrl+J · Ctrl+\\', 'Equation editor · Insert panel'],
  ['Ctrl+N / O / S · Ctrl+E', 'New / Open / Save · Export'],
];

export function AboutDialog() {
  const t = useT();
  const tr = useTr();
  const open = useUi((s) => s.aboutOpen);
  if (!open) return null;
  const close = () => ui.set({ aboutOpen: false });
  return (
    <Modal title={t('about')} onClose={close} wide>
      <div className="about-head">
        <img src={LOGO} alt="" />
        <div>
          <h2>Quillon</h2>
          <p>{t('version')} 0.4.0 · Apache-2.0</p>
        </div>
      </div>
      <p className="about">{t('aboutText')}</p>
      <h3>{t('shortcuts')}</h3>
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k}>
              <td>
                <kbd>{k}</kbd>
              </td>
              <td>{tr(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="modal-actions">
        <a className="btn" href="https://github.com/vinhhuy15/quillon" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <button className="btn primary" onClick={close}>
          {t('close')}
        </button>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const list = useSyncExternalStore(toasts.subscribe, () => toasts.get().list);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((x) => (
        <div key={x.id} className={`toast ${x.kind}`}>
          {x.text}
        </div>
      ))}
    </div>
  );
}

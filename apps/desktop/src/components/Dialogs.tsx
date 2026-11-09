import { useEffect, useState, useSyncExternalStore } from 'react';
import { exportFile, type ExportFormat } from '../actions';
import { useT, useTr, type StringKey } from '../i18n';
import { toasts, ui, useEditor, useUi } from '../state/store';
import { Icon } from './Icons';

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setScope(hasSel ? 'selection' : 'all');
  }, [open, hasSel]);

  if (!open) return null;
  const close = () => ui.set({ exportOpen: false });
  const raster = format === 'png';
  const run = async () => {
    setBusy(true);
    const ok = await exportFile({ format, scope, dpi, background: bg === 'white' ? '#ffffff' : null });
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

const SHORTCUTS: [string, string][] = [
  ['V · H', 'Select · Hand (pan)'],
  ['M · T', 'Equation · Text'],
  ['R · O · L · A', 'Rectangle · Ellipse · Line · Arrow'],
  ['P', 'Function plot'],
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
    <Modal title="SciForge 0.2.0" onClose={close} wide>
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
        <a className="btn" href="https://github.com/vinhhuy15/sciforge" target="_blank" rel="noreferrer">
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

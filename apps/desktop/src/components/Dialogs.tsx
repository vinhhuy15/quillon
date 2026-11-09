import { useEffect, useState } from 'react';
import { exportFile, type ExportFormat } from '../actions';
import { useT, useTr, type StringKey } from '../i18n';
import { toasts, ui, useEditor, useUi } from '../state/store';
import { useSyncExternalStore } from 'react';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const FORMATS: { id: ExportFormat; label: StringKey }[] = [
  { id: 'png', label: 'fmtPng' },
  { id: 'svg', label: 'fmtSvg' },
  { id: 'docx', label: 'fmtDocx' },
  { id: 'tex', label: 'fmtTex' },
  { id: 'html', label: 'fmtHtml' },
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
      <fieldset>
        <legend>{t('format')}</legend>
        {FORMATS.map((f) => (
          <label key={f.id} className="radio">
            <input type="radio" name="fmt" checked={format === f.id} onChange={() => setFormat(f.id)} />
            {t(f.label)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('scope')}</legend>
        <label className="radio">
          <input type="radio" name="scope" checked={scope === 'selection'} disabled={!hasSel} onChange={() => setScope('selection')} />
          {t('scopeSelection')}
        </label>
        <label className="radio">
          <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
          {t('scopeAll')}
        </label>
      </fieldset>
      {(raster || format === 'svg') && (
        <fieldset className="row">
          {raster && (
            <label>
              {t('resolution')}
              <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                {[96, 150, 300, 600, 1200].map((d) => (
                  <option key={d} value={d}>
                    {d} DPI
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t('background')}
            <select value={bg} onChange={(e) => setBg(e.target.value as 'transparent' | 'white')}>
              <option value="transparent">{t('transparent')}</option>
              <option value="white">{t('white')}</option>
            </select>
          </label>
        </fieldset>
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

const SHORTCUTS: [string, string][] = [
  ['Ctrl+N / O / S', 'New / Open / Save'],
  ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'],
  ['Ctrl+C / X / V', 'Copy / Cut / Paste (pasting LaTeX creates an equation)'],
  ['Ctrl+Shift+C', 'Copy for Word'],
  ['Ctrl+D', 'Duplicate'],
  ['Delete', 'Delete'],
  ['Enter / F2', 'Edit selected object'],
  ['M / T', 'Add equation / text'],
  ['← ↑ → ↓ (+Shift)', 'Nudge 1px (10px)'],
  ['Ctrl+wheel, Ctrl+= / −', 'Zoom in / out'],
  ['Ctrl+0', 'Zoom to fit'],
  ['Space + drag', 'Pan the view'],
  ['Ctrl+E', 'Export'],
];

export function AboutDialog() {
  const t = useT();
  const open = useUi((s) => s.aboutOpen);
  const tr = useTr();
  if (!open) return null;
  const close = () => ui.set({ aboutOpen: false });
  return (
    <Modal title="SciForge 0.1.0" onClose={close}>
      <p>{t('aboutText')}</p>
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

import { useEffect, useRef, useState } from 'react';
import {
  addMath,
  addText,
  copyForWord,
  copyImage,
  copyLatex,
  copyMathml,
  copySvg,
  deleteSelection,
  duplicateSelection,
  fileNew,
  fileOpen,
  fileSave,
  reorder,
  zoomAt,
  zoomFit,
  zoomReset,
} from '../actions';
import { setLang, useT } from '../i18n';
import { editor, ui, useEditor, useUi } from '../state/store';

function Btn({ icon, label, onClick, disabled, kbd }: { icon: string; label: string; onClick: () => void; disabled?: boolean; kbd?: string }) {
  return (
    <button className="tb-btn" title={kbd ? `${label} (${kbd})` : label} aria-label={label} onClick={onClick} disabled={disabled}>
      <span className="tb-icon" aria-hidden>
        {icon}
      </span>
    </button>
  );
}

function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className={`tb-btn text${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        {label} ▾
      </button>
      {open && (
        <div className="menu-pop" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

const Item = ({ label, kbd, onClick, disabled }: { label: string; kbd?: string; onClick: () => void; disabled?: boolean }) => (
  <button role="menuitem" className="menu-item" onClick={onClick} disabled={disabled}>
    <span>{label}</span>
    {kbd && <kbd>{kbd}</kbd>}
  </button>
);

export function Toolbar() {
  const t = useT();
  const { canUndo, canRedo, selection, undoLabel, redoLabel } = useEditor();
  const zoom = useUi((s) => s.zoom);
  const lang = useUi((s) => s.lang);
  const hasSel = selection.length > 0;

  return (
    <header className="toolbar">
      <div className="brand" title="SciForge">
        <svg viewBox="0 0 64 64" width="22" height="22" aria-hidden>
          <rect width="64" height="64" rx="14" fill="#4338ca" />
          <path d="M18 16h28v6H27l12 10-12 10h19v6H18v-5l13-11-13-11z" fill="#fff" />
        </svg>
        <b>SciForge</b>
      </div>
      <Menu label={lang === 'vi' ? 'Tệp' : 'File'}>
        <Item label={t('new')} kbd="Ctrl+N" onClick={fileNew} />
        <Item label={t('open')} kbd="Ctrl+O" onClick={fileOpen} />
        <Item label={t('save')} kbd="Ctrl+S" onClick={() => fileSave(false)} />
        <Item label={t('saveAs')} kbd="Ctrl+Shift+S" onClick={() => fileSave(true)} />
        <hr />
        <Item label={t('export')} kbd="Ctrl+E" onClick={() => ui.set({ exportOpen: true })} />
      </Menu>
      <Menu label={lang === 'vi' ? 'Sửa' : 'Edit'}>
        <Item label={t('undo')} kbd="Ctrl+Z" onClick={() => editor.undo()} disabled={!canUndo} />
        <Item label={t('redo')} kbd="Ctrl+Y" onClick={() => editor.redo()} disabled={!canRedo} />
        <hr />
        <Item label={t('duplicate')} kbd="Ctrl+D" onClick={duplicateSelection} disabled={!hasSel} />
        <Item label={t('delete')} kbd="Del" onClick={deleteSelection} disabled={!hasSel} />
        <Item label={t('selectAll')} kbd="Ctrl+A" onClick={() => editor.selectAll()} />
        <hr />
        <Item label={t('bringFront')} kbd="Ctrl+]" onClick={() => reorder('front')} disabled={!hasSel} />
        <Item label={t('sendBack')} kbd="Ctrl+[" onClick={() => reorder('back')} disabled={!hasSel} />
      </Menu>
      <Menu label={lang === 'vi' ? 'Sao chép' : 'Copy as'}>
        <Item label={t('copyForWord')} kbd="Ctrl+Shift+C" onClick={copyForWord} />
        <Item label={t('copyLatex')} onClick={copyLatex} />
        <Item label={t('copyMathml')} onClick={copyMathml} />
        <Item label={t('copyImage')} onClick={copyImage} disabled={!hasSel} />
        <Item label={t('copySvg')} onClick={copySvg} disabled={!hasSel} />
      </Menu>
      <span className="tb-sep" />
      <Btn icon="🗋" label={t('new')} kbd="Ctrl+N" onClick={fileNew} />
      <Btn icon="📂" label={t('open')} kbd="Ctrl+O" onClick={fileOpen} />
      <Btn icon="💾" label={t('save')} kbd="Ctrl+S" onClick={() => fileSave(false)} />
      <span className="tb-sep" />
      <Btn icon="↶" label={`${t('undo')}${undoLabel ? `: ${undoLabel}` : ''}`} kbd="Ctrl+Z" onClick={() => editor.undo()} disabled={!canUndo} />
      <Btn icon="↷" label={`${t('redo')}${redoLabel ? `: ${redoLabel}` : ''}`} kbd="Ctrl+Y" onClick={() => editor.redo()} disabled={!canRedo} />
      <span className="tb-sep" />
      <button className="tb-btn text" onClick={() => addMath('')} title={t('newEquation')}>
        <i className="serif">∑</i> {t('newEquation')}
      </button>
      <button className="tb-btn text" onClick={() => addText()} title={t('newText')}>
        <b>T</b> {t('newText')}
      </button>
      <Btn icon="⧉" label={t('duplicate')} kbd="Ctrl+D" onClick={duplicateSelection} disabled={!hasSel} />
      <Btn icon="🗑" label={t('delete')} kbd="Del" onClick={deleteSelection} disabled={!hasSel} />
      <span className="tb-sep" />
      <Btn icon="−" label={t('zoomOut')} kbd="Ctrl+−" onClick={() => zoomAt(1 / 1.2)} />
      <button className="tb-btn text zoom" onClick={zoomReset} title={t('zoomReset')}>
        {Math.round(zoom * 100)}%
      </button>
      <Btn icon="+" label={t('zoomIn')} kbd="Ctrl+=" onClick={() => zoomAt(1.2)} />
      <Btn icon="⤢" label={t('zoomFit')} kbd="Ctrl+0" onClick={zoomFit} />
      <span className="spacer" />
      <button className="tb-btn text primary" onClick={() => ui.set({ exportOpen: true })}>
        ⇪ {t('export')}
      </button>
      <select className="lang" value={lang} onChange={(e) => setLang(e.target.value as 'vi' | 'en')} aria-label={t('language')}>
        <option value="vi">Tiếng Việt</option>
        <option value="en">English</option>
      </select>
      <Btn icon="?" label={t('about')} onClick={() => ui.set({ aboutOpen: true })} />
    </header>
  );
}

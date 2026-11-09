import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  align,
  copyForWord,
  copyImage,
  copyLatex,
  copyMathml,
  copySvg,
  copyTikz,
  deleteSelection,
  insertImage,
  distribute,
  duplicateSelection,
  fileNew,
  fileOpen,
  fileSave,
  flipSelection,
  groupSelection,
  reorder,
  rotateSelection,
  toggleLock,
  ungroupSelection,
  zoomAt,
  zoomFit,
  zoomReset,
} from '../actions';
import { COLOR_VISIONS } from '@quillon/figure-core';
import { setLang, useT, type StringKey } from '../i18n';
import { editor, persist, ui, useEditor, useUi } from '../state/store';
import { setTool, toolDefs } from '../tools';
import { Icon } from './Icons';

export interface MenuEntry {
  label: string;
  kbd?: string;
  onClick: () => void;
  disabled?: boolean;
  checked?: boolean;
}
export type MenuItem = MenuEntry | 'sep';

export function MenuList({ items, onDone }: { items: MenuItem[]; onDone: () => void }) {
  return (
    <>
      {items.map((it, i) =>
        it === 'sep' ? (
          <hr key={i} />
        ) : (
          <button
            key={i}
            role={it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={it.checked}
            className="menu-item"
            disabled={it.disabled}
            onClick={() => {
              onDone();
              it.onClick();
            }}
          >
            <span className="menu-check">{it.checked ? '✓' : ''}</span>
            <span className="menu-label">{it.label}</span>
            {it.kbd && <kbd>{it.kbd}</kbd>}
          </button>
        ),
      )}
    </>
  );
}

function useMenus(): { id: string; label: string; items: MenuItem[] }[] {
  const t = useT();
  const { canUndo, canRedo, selection, undoLabel, redoLabel, doc } = useEditor();
  const snap = useUi((s) => s.snap);
  const panelOpen = useUi((s) => s.panelOpen);
  const dockOpen = useUi((s) => s.dockOpen);
  const lang = useUi((s) => s.lang);
  const colorVision = useUi((s) => s.colorVision);
  const sel = doc.nodes.filter((n) => selection.includes(n.id));
  const has = sel.length > 0;
  const hasMath = sel.some((n) => n.type === 'math');
  const rotatable = sel.some((n) => n.type === 'shape' || n.type === 'symbol');
  return [
    {
      id: 'file',
      label: t('menuFile'),
      items: [
        { label: t('new'), kbd: 'Ctrl+N', onClick: fileNew },
        { label: t('open'), kbd: 'Ctrl+O', onClick: fileOpen },
        'sep',
        { label: t('save'), kbd: 'Ctrl+S', onClick: () => fileSave(false) },
        { label: t('saveAs'), kbd: 'Ctrl+Shift+S', onClick: () => fileSave(true) },
        'sep',
        { label: t('export'), kbd: 'Ctrl+E', onClick: () => ui.set({ exportOpen: true }) },
      ],
    },
    {
      id: 'edit',
      label: t('menuEdit'),
      items: [
        { label: undoLabel ? `${t('undo')} ${undoLabel.toLowerCase()}` : t('undo'), kbd: 'Ctrl+Z', onClick: () => editor.undo(), disabled: !canUndo },
        { label: redoLabel ? `${t('redo')} ${redoLabel.toLowerCase()}` : t('redo'), kbd: 'Ctrl+Y', onClick: () => editor.redo(), disabled: !canRedo },
        'sep',
        { label: t('duplicate'), kbd: 'Ctrl+D', onClick: duplicateSelection, disabled: !has },
        { label: t('delete'), kbd: 'Del', onClick: deleteSelection, disabled: !has },
        { label: t('selectAll'), kbd: 'Ctrl+A', onClick: () => editor.selectAll() },
        'sep',
        { label: t('copyForWord'), kbd: 'Ctrl+Shift+C', onClick: copyForWord, disabled: !has && !ui.get().activeMathId },
        { label: t('copyLatex'), onClick: copyLatex, disabled: !hasMath && !ui.get().activeMathId },
        { label: t('copyMathml'), onClick: copyMathml, disabled: !hasMath && !ui.get().activeMathId },
        { label: t('copyImage'), onClick: () => copyImage(), disabled: !has },
        { label: t('copySvg'), onClick: copySvg, disabled: !has },
        { label: t('copyTikz'), onClick: copyTikz },
      ],
    },
    {
      id: 'insert',
      label: t('menuInsert'),
      items: [
        ...toolDefs
          .filter((d) => d.id !== 'select' && d.id !== 'hand')
          .map((d) => ({ label: t(d.label), kbd: d.key, onClick: () => setTool(d.id) })),
        { label: t('insertImage'), kbd: 'I', onClick: insertImage },
        'sep' as const,
        { label: t('templates'), onClick: () => ui.set({ panelOpen: true, panelTab: 'templates' }) },
        { label: t('shapesSymbols'), onClick: () => ui.set({ panelOpen: true, panelTab: 'shapes' }) },
      ],
    },
    {
      id: 'arrange',
      label: t('menuArrange'),
      items: [
        { label: t('bringFront'), kbd: 'Ctrl+]', onClick: () => reorder('front'), disabled: !has },
        { label: t('bringForward'), onClick: () => reorder('forward'), disabled: !has },
        { label: t('sendBackward'), onClick: () => reorder('backward'), disabled: !has },
        { label: t('sendBack'), kbd: 'Ctrl+[', onClick: () => reorder('back'), disabled: !has },
        'sep',
        { label: t('alignLeft'), onClick: () => align('left'), disabled: sel.length < 2 },
        { label: t('alignCenter'), onClick: () => align('hcenter'), disabled: sel.length < 2 },
        { label: t('alignRight'), onClick: () => align('right'), disabled: sel.length < 2 },
        { label: t('alignTop'), onClick: () => align('top'), disabled: sel.length < 2 },
        { label: t('alignMiddle'), onClick: () => align('vcenter'), disabled: sel.length < 2 },
        { label: t('alignBottom'), onClick: () => align('bottom'), disabled: sel.length < 2 },
        { label: t('distributeH'), onClick: () => distribute('h'), disabled: sel.length < 3 },
        { label: t('distributeV'), onClick: () => distribute('v'), disabled: sel.length < 3 },
        { label: t('figureLayout'), kbd: 'Ctrl+Shift+L', onClick: () => ui.set({ figureOpen: true }), disabled: sel.length < 2 },
        'sep',
        { label: t('group'), kbd: 'Ctrl+G', onClick: groupSelection, disabled: sel.length < 2 },
        { label: t('ungroup'), kbd: 'Ctrl+Shift+G', onClick: ungroupSelection, disabled: !sel.some((n) => n.group) },
        'sep',
        { label: t('rotate90'), kbd: 'Ctrl+R', onClick: () => rotateSelection(90), disabled: !rotatable },
        { label: t('flip'), onClick: flipSelection, disabled: !sel.some((n) => n.type === 'symbol') },
        { label: sel.length && sel.every((n) => n.locked) ? t('unlock') : t('lock'), kbd: 'Ctrl+L', onClick: toggleLock, disabled: !has },
      ],
    },
    {
      id: 'view',
      label: t('menuView'),
      items: [
        { label: t('zoomIn'), kbd: 'Ctrl+=', onClick: () => zoomAt(1.2) },
        { label: t('zoomOut'), kbd: 'Ctrl+−', onClick: () => zoomAt(1 / 1.2) },
        { label: t('zoomReset'), kbd: 'Ctrl+1', onClick: zoomReset },
        { label: t('zoomFit'), kbd: 'Ctrl+0', onClick: zoomFit },
        'sep',
        {
          label: t('snapToGrid'),
          checked: snap,
          onClick: () => {
            ui.set({ snap: !snap });
            persist('quillon:snap', snap ? 'off' : 'on');
          },
        },
        { label: t('insertPanel'), kbd: 'Ctrl+\\', checked: panelOpen, onClick: togglePanel },
        { label: t('equationEditor'), kbd: 'Ctrl+J', checked: dockOpen, onClick: toggleDock },
        'sep',
        ...COLOR_VISIONS.map((v) => ({ label: t(`cvd_${v}` as StringKey), checked: colorVision === v, onClick: () => ui.set({ colorVision: v }) })),
        'sep',
        { label: 'English', checked: lang === 'en', onClick: () => setLang('en') },
        { label: 'Tiếng Việt', checked: lang === 'vi', onClick: () => setLang('vi') },
      ],
    },
    {
      id: 'help',
      label: t('menuHelp'),
      items: [{ label: t('shortcutsAbout'), kbd: 'F1', onClick: () => ui.set({ aboutOpen: true }) }],
    },
  ];
}

export function togglePanel() {
  const open = !ui.get().panelOpen;
  ui.set({ panelOpen: open });
  persist('quillon:panel', open ? 'open' : 'closed');
}

export function toggleDock() {
  const open = !ui.get().dockOpen;
  ui.set({ dockOpen: open });
  persist('quillon:dock', open ? 'open' : 'closed');
}

function MenuBar() {
  const menus = useMenus();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <nav className="menubar" ref={ref}>
      {menus.map((m) => (
        <div key={m.id} className="menu">
          <button
            className={`menu-btn${open === m.id ? ' on' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open === m.id}
            onClick={() => setOpen(open === m.id ? null : m.id)}
            onMouseEnter={() => open && setOpen(m.id)}
          >
            {m.label}
          </button>
          {open === m.id && (
            <div className="menu-pop" role="menu">
              <MenuList items={m.items} onDone={() => setOpen(null)} />
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

function BarButton({ icon, label, kbd, onClick, disabled, children }: { icon: Parameters<typeof Icon>[0]['name']; label: string; kbd?: string; onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <button className={`bar-btn${children ? ' wide' : ''}`} title={kbd ? `${label} (${kbd})` : label} aria-label={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
      {children}
    </button>
  );
}

export const LOGO = `${import.meta.env.BASE_URL}logo.svg`;

export function TopBar() {
  const t = useT();
  const { canUndo, canRedo, undoLabel, redoLabel, fileName, dirty, doc } = useEditor();
  const name = fileName ?? (doc.meta.title || t('untitled'));
  return (
    <header className="topbar">
      <div className="brand">
        <img src={LOGO} alt="" />
        <span className="wordmark">Quillon</span>
      </div>
      <MenuBar />
      <div className="doc-name" title={name}>
        <span className="doc-title">{name}</span>
        <span className={`save-state${dirty ? ' dirty' : ''}`}>{dirty ? t('stateEdited') : t('stateSaved')}</span>
      </div>
      <div className="topbar-actions">
        <BarButton icon="undo" label={undoLabel ? `${t('undo')}: ${undoLabel}` : t('undo')} kbd="Ctrl+Z" onClick={() => editor.undo()} disabled={!canUndo} />
        <BarButton icon="redo" label={redoLabel ? `${t('redo')}: ${redoLabel}` : t('redo')} kbd="Ctrl+Y" onClick={() => editor.redo()} disabled={!canRedo} />
        <span className="bar-sep" />
        <BarButton icon="word" label={t('copyForWordHint')} kbd="Ctrl+Shift+C" onClick={copyForWord}>
          <span>{t('copyForWord')}</span>
        </BarButton>
        <button className="btn primary" onClick={() => ui.set({ exportOpen: true })} title={`${t('export')} (Ctrl+E)`}>
          <Icon name="export" />
          {t('exportShort')}
        </button>
      </div>
    </header>
  );
}


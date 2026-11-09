import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  addMath,
  copyForWord,
  copyImage,
  copyTikz,
  createInset,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  pasteText,
  pointer,
  reorder,
  rotateSelection,
  toggleLock,
  ungroupSelection,
} from '../actions';
import { useT } from '../i18n';
import { editor, ui, useEditor, useUi } from '../state/store';
import { MenuList, type MenuItem } from './TopBar';

export function ContextMenu() {
  const t = useT();
  const pos = useUi((s) => s.contextMenu);
  const { doc, selection } = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!pos) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && ui.set({ contextMenu: null });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && ui.set({ contextMenu: null });
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [pos]);

  // Keep the menu on screen.
  useLayoutEffect(() => {
    if (!pos || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setShift({ x: Math.min(0, window.innerWidth - pos.x - r.width - 8), y: Math.min(0, window.innerHeight - pos.y - r.height - 8) });
  }, [pos]);

  if (!pos) return null;
  const sel = doc.nodes.filter((n) => selection.includes(n.id));
  const has = sel.length > 0;
  const at = pointer.current ?? undefined;
  const items: MenuItem[] = has
    ? [
        { label: t('copyForWord'), kbd: 'Ctrl+Shift+C', onClick: copyForWord },
        { label: t('copyImage'), onClick: () => copyImage() },
        { label: t('copyTikz'), onClick: copyTikz },
        'sep',
        { label: t('duplicate'), kbd: 'Ctrl+D', onClick: duplicateSelection },
        { label: t('delete'), kbd: 'Del', onClick: deleteSelection },
        'sep',
        { label: t('bringFront'), kbd: 'Ctrl+]', onClick: () => reorder('front') },
        { label: t('sendBack'), kbd: 'Ctrl+[', onClick: () => reorder('back') },
        ...(sel.length === 1 && sel[0].type === 'image' && !sel[0].inset ? [{ label: t('createInset'), onClick: () => createInset(sel[0] as Extract<typeof sel[0], { type: 'image' }>) }] : []),
        ...(sel.length >= 2 ? [{ label: t('figureLayout'), kbd: 'Ctrl+Shift+L', onClick: () => ui.set({ figureOpen: true }) }] : []),
        ...(sel.length >= 2 ? [{ label: t('group'), kbd: 'Ctrl+G', onClick: groupSelection }] : []),
        ...(sel.some((n) => n.group) ? [{ label: t('ungroup'), kbd: 'Ctrl+Shift+G', onClick: ungroupSelection }] : []),
        ...(sel.some((n) => n.type === 'shape' || n.type === 'symbol') ? [{ label: t('rotate90'), kbd: 'Ctrl+R', onClick: () => rotateSelection(90) }] : []),
        { label: sel.every((n) => n.locked) ? t('unlock') : t('lock'), kbd: 'Ctrl+L', onClick: toggleLock },
      ]
    : [
        { label: t('toolMath'), onClick: () => addMath('', at) },
        {
          label: t('paste'),
          kbd: 'Ctrl+V',
          onClick: async () => {
            try {
              pasteText(await navigator.clipboard.readText(), at);
            } catch {
              /* permission denied: the keyboard shortcut still works */
            }
          },
        },
        { label: t('selectAll'), kbd: 'Ctrl+A', onClick: () => editor.selectAll() },
      ];
  return (
    <div ref={ref} className="menu-pop context" role="menu" style={{ left: pos.x + shift.x, top: pos.y + shift.y }}>
      <MenuList items={items} onDone={() => ui.set({ contextMenu: null })} />
    </div>
  );
}

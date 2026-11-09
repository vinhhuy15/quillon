import { useEffect } from 'react';
import {
  copyForWord,
  deleteSelection,
  dropIfEmpty,
  duplicateSelection,
  fileNew,
  fileOpen,
  fileSave,
  groupSelection,
  nudge,
  onCopyEvent,
  onPasteEvent,
  reorder,
  restoreAutosave,
  rotateSelection,
  startAutosave,
  toggleLock,
  ungroupSelection,
  zoomAt,
  zoomFit,
  zoomReset,
} from './actions';
import { Canvas, isTyping } from './components/Canvas';
import { ContextMenu } from './components/ContextMenu';
import { AboutDialog, ExportDialog, Toasts } from './components/Dialogs';
import { EquationEditor } from './components/EquationEditor';
import { InsertPanel } from './components/InsertPanel';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { ToolRail } from './components/ToolRail';
import { toggleDock, togglePanel, TopBar } from './components/TopBar';
import { t } from './i18n';
import './layout';
import { setWindowTitle } from './platform';
import { editor, toast, ui, useEditor, useUi } from './state/store';
import { setTool, toolDefs } from './tools';

let booted = false;

export function App() {
  const fileName = useEditor((s) => s.fileName);
  const dirty = useEditor((s) => s.dirty);
  const title = useEditor((s) => s.doc.meta.title);
  const lang = useUi((s) => s.lang);
  const panelOpen = useUi((s) => s.panelOpen);

  useEffect(() => {
    if (booted) return;
    booted = true;
    if (restoreAutosave()) {
      toast(t('restored'), 'info', 4500);
      requestAnimationFrame(zoomFit);
    }
    startAutosave();
    // When the equation editor moves away from an equation left empty, delete it.
    let prevActive = ui.get().activeMathId;
    ui.subscribe(() => {
      const cur = ui.get().activeMathId;
      if (cur === prevActive) return;
      const old = prevActive;
      prevActive = cur;
      dropIfEmpty(old);
    });
  }, []);

  useEffect(() => {
    setWindowTitle(`${dirty ? '• ' : ''}${fileName ?? (title || t('untitled', lang))} — Quillon`);
    document.documentElement.lang = lang;
  }, [fileName, dirty, lang, title]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (editor.getState().dirty) e.preventDefault();
    };
    const onCopy = (e: ClipboardEvent) => !isTyping(e.target) && onCopyEvent(e, false);
    const onCut = (e: ClipboardEvent) => !isTyping(e.target) && onCopyEvent(e, true);
    const onPaste = (e: ClipboardEvent) => !isTyping(e.target) && onPasteEvent(e);
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className={`body${panelOpen ? '' : ' no-panel'}`}>
        <ToolRail />
        {panelOpen && <InsertPanel />}
        <main className="stage">
          <Canvas />
          <EquationEditor />
        </main>
        <Inspector />
      </div>
      <StatusBar />
      <ExportDialog />
      <AboutDialog />
      <ContextMenu />
      <Toasts />
    </div>
  );
}

function onKeyDown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  // File shortcuts work everywhere (even while typing in the editor).
  if (mod && key === 's') {
    e.preventDefault();
    fileSave(e.shiftKey);
    return;
  }
  if (mod && key === 'o') {
    e.preventDefault();
    fileOpen();
    return;
  }
  if (mod && key === 'e') {
    e.preventDefault();
    ui.set({ exportOpen: true });
    return;
  }
  if (mod && key === 'j') {
    e.preventDefault();
    toggleDock();
    return;
  }
  if (mod && e.key === '\\') {
    e.preventDefault();
    togglePanel();
    return;
  }
  if (e.key === 'F1') {
    e.preventDefault();
    ui.set({ aboutOpen: true });
    return;
  }
  if (isTyping(e.target) || ui.get().exportOpen || ui.get().aboutOpen) return;

  const handled = () => e.preventDefault();
  if (mod) {
    if (key === 'z' && !e.shiftKey) return handled(), editor.undo();
    if (key === 'y' || (key === 'z' && e.shiftKey)) return handled(), editor.redo();
    if (key === 'a') return handled(), editor.selectAll();
    if (key === 'd') return handled(), duplicateSelection();
    if (key === 'n') return handled(), fileNew();
    if (key === 'g') return handled(), e.shiftKey ? ungroupSelection() : groupSelection();
    if (key === 'r') return handled(), rotateSelection(90);
    if (key === 'l') return handled(), toggleLock();
    if (key === 'c' && e.shiftKey) return handled(), copyForWord();
    if (key === '=' || key === '+') return handled(), zoomAt(1.2);
    if (key === '-') return handled(), zoomAt(1 / 1.2);
    if (key === '0') return handled(), zoomFit();
    if (key === '1') return handled(), zoomReset();
    if (key === ']') return handled(), reorder('front');
    if (key === '[') return handled(), reorder('back');
    return;
  }
  if (e.altKey) return;
  const step = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      return handled(), deleteSelection();
    case 'ArrowLeft':
      return handled(), nudge(-step, 0);
    case 'ArrowRight':
      return handled(), nudge(step, 0);
    case 'ArrowUp':
      return handled(), nudge(0, -step);
    case 'ArrowDown':
      return handled(), nudge(0, step);
    case 'Escape':
      if (ui.get().tool !== 'select') return setTool('select');
      editor.select([]);
      ui.set({ activeMathId: null, contextMenu: null });
      return;
    case 'Enter':
    case 'F2': {
      const sel = editor.selection;
      const n = sel.length === 1 ? editor.doc.nodes.find((x) => x.id === sel[0]) : undefined;
      if (!n) return;
      handled();
      if (n.type === 'text' || n.type === 'shape') ui.set({ editingTextId: n.id });
      else if (n.type === 'math') ui.set((u) => ({ activeMathId: n.id, dockOpen: true, focusEditorTick: u.focusEditorTick + 1 }));
      else ui.set((u) => ({ focusLabelTick: u.focusLabelTick + 1 }));
      return;
    }
  }
  const tool = toolDefs.find((d) => d.key.toLowerCase() === key);
  if (tool && !e.shiftKey) {
    handled();
    setTool(tool.id);
  }
}

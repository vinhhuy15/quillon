import { useEffect } from 'react';
import {
  addMath,
  addText,
  copyForWord,
  deleteSelection,
  dropIfEmpty,
  duplicateSelection,
  fileNew,
  fileOpen,
  fileSave,
  nudge,
  onCopyEvent,
  onPasteEvent,
  reorder,
  restoreAutosave,
  startAutosave,
  zoomAt,
  zoomFit,
} from './actions';
import { Canvas, isTyping } from './components/Canvas';
import { AboutDialog, ExportDialog, Toasts } from './components/Dialogs';
import { EquationEditor } from './components/EquationEditor';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { t } from './i18n';
import { setWindowTitle } from './platform';
import { editor, toast, ui, useEditor, useUi } from './state/store';

let booted = false;

export function App() {
  const fileName = useEditor((s) => s.fileName);
  const dirty = useEditor((s) => s.dirty);
  const lang = useUi((s) => s.lang);

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
    setWindowTitle(`${dirty ? '• ' : ''}${fileName ?? t('untitled', lang)} — SciForge`);
  }, [fileName, dirty, lang]);

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
      <Toolbar />
      <div className="workspace">
        <main className="main">
          <Canvas />
          <EquationEditor />
        </main>
        <Sidebar />
      </div>
      <StatusBar />
      <ExportDialog />
      <AboutDialog />
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
  if (isTyping(e.target) || ui.get().exportOpen || ui.get().aboutOpen) return;

  const handled = () => e.preventDefault();
  if (mod) {
    if (key === 'z' && !e.shiftKey) return handled(), editor.undo();
    if (key === 'y' || (key === 'z' && e.shiftKey)) return handled(), editor.redo();
    if (key === 'a') return handled(), editor.selectAll();
    if (key === 'd') return handled(), duplicateSelection();
    if (key === 'n') return handled(), fileNew();
    if (key === 'c' && e.shiftKey) return handled(), copyForWord();
    if (key === '=' || key === '+') return handled(), zoomAt(1.2);
    if (key === '-') return handled(), zoomAt(1 / 1.2);
    if (key === '0') return handled(), zoomFit();
    if (key === ']') return handled(), reorder('front');
    if (key === '[') return handled(), reorder('back');
    return;
  }
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
      editor.select([]);
      ui.set({ activeMathId: null });
      return;
    case 'Enter':
    case 'F2': {
      const sel = editor.selection;
      const n = sel.length === 1 ? editor.doc.nodes.find((x) => x.id === sel[0]) : undefined;
      if (!n) return;
      handled();
      if (n.type === 'text') ui.set({ editingTextId: n.id });
      else ui.set((u) => ({ activeMathId: n.id, focusEditorTick: u.focusEditorTick + 1 }));
      return;
    }
    case 'm':
    case 'M':
      return handled(), void addMath('');
    case 't':
    case 'T':
      return handled(), addText();
  }
}

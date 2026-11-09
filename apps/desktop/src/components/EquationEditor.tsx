import { useCallback, useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import { addNodes, createMathNode, updateNodes, type MathNode } from '@quillon/doc-model';
import { validateLatex } from '@quillon/math-core';
import { copyForWord, editorInsertHook, viewCenter } from '../actions';
import { useT } from '../i18n';
import { library } from '../state/library';
import { editor, toast, ui, useEditor, useUi } from '../state/store';
import { Icon } from './Icons';
import { Palette } from './Palette';
import { toggleDock } from './TopBar';

MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}mathlive/fonts`;
MathfieldElement.soundsDirectory = null;

let editSession = 0;

export function EquationEditor() {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const activeId = useUi((s) => s.activeMathId);
  const showSource = useUi((s) => s.showSource);
  const focusTick = useUi((s) => s.focusEditorTick);
  const open = useUi((s) => s.dockOpen);
  const node = useEditor((s) => {
    const n = activeId ? s.doc.nodes.find((x) => x.id === activeId) : undefined;
    return n?.type === 'math' ? n : null;
  });
  const nodeRef = useRef<MathNode | null>(node);
  nodeRef.current = node;
  const [error, setError] = useState<string | null>(null);

  /** Called on every keystroke in the math field. */
  const onInput = useCallback(() => {
    const mf = mfRef.current!;
    const latex = mf.getValue('latex');
    const cur = nodeRef.current;
    if (!cur) {
      if (!latex.trim()) return;
      const pos = viewCenter();
      const s = editor.doc.settings;
      const n = createMathNode({ latex, x: Math.round(pos.x - 60), y: Math.round(pos.y - 20), fontSize: s.defaultFontSize, color: s.defaultColor });
      editor.seal();
      editSession++;
      editor.apply('Add equation', (d) => addNodes(d, [n]), { select: [n.id], coalesce: `edit-${editSession}` });
      ui.set({ activeMathId: n.id });
      return;
    }
    editor.apply('Edit equation', (d) => updateNodes(d, { [cur.id]: { latex } }), { coalesce: `edit-${editSession}` });
  }, []);

  // Create the MathLive field once.
  useEffect(() => {
    const mf = new MathfieldElement();
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.smartFence = true;
    mf.defaultMode = 'math';
    mf.placeholder = '\\text{…}';
    mf.className = 'mathfield';
    mf.addEventListener('input', onInput);
    mf.addEventListener('focus', () => {
      editSession++;
      editor.seal();
    });
    mf.addEventListener('blur', () => editor.seal());
    mf.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') mf.blur();
      e.stopPropagation(); // keep global shortcuts out of the field
    });
    hostRef.current!.appendChild(mf);
    mfRef.current = mf;
    editorInsertHook.current = (latex) => {
      if (!ui.get().dockOpen) ui.set({ dockOpen: true });
      mf.focus();
      return mf.insert(latex, { selectionMode: 'placeholder', focus: true, format: 'latex' });
    };
    return () => {
      editorInsertHook.current = null;
      mf.removeEventListener('input', onInput);
      mf.remove();
    };
  }, [onInput]);

  // Keep the field in sync with the document (selection change, undo/redo, source edits).
  const latex = node?.latex ?? '';
  useEffect(() => {
    const mf = mfRef.current;
    if (mf && mf.getValue('latex') !== latex) mf.setValue(latex, { silenceNotifications: true });
    setError(latex.trim() ? validateLatex(latex) : null);
  }, [latex, activeId]);

  useEffect(() => {
    if (focusTick > 0) requestAnimationFrame(() => mfRef.current?.focus());
  }, [focusTick]);

  const insert = (snippet: string) => {
    const mf = mfRef.current!;
    if (!nodeRef.current && mf.getValue('latex') !== '') mf.setValue('', { silenceNotifications: true });
    mf.focus();
    mf.insert(snippet, { selectionMode: 'placeholder', focus: true, format: 'latex' });
  };

  return (
    <section className={`eq-dock${open ? '' : ' collapsed'}`} aria-label={t('equationEditor')}>
      <div className="eq-head">
        <button className="dock-toggle" onClick={toggleDock} aria-expanded={open} title={`${t('equationEditor')} (Ctrl+J)`}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
          <span className="eq-title">{t('equationEditor')}</span>
        </button>
        <span className={`eq-mode${node ? ' editing' : ''}`}>{node ? t('editingSelected') : t('newMode')}</span>
        {error && (
          <span className="eq-error" title={error}>
            {t('latexError')}: {error}
          </span>
        )}
        <span className="spacer" />
        {open && (
          <>
            <button className={`btn small${showSource ? ' on' : ''}`} onClick={() => ui.set({ showSource: !showSource })} title={t('source')}>
              <Icon name="latex" size={14} />
              <span className="lbl">LaTeX</span>
            </button>
            <button
              className="btn small"
              disabled={!node?.latex}
              title={t('saveToLibrary')}
              onClick={() => {
                if (!node) return;
                library.add(node.latex);
                toast(t('savedToLibrary'), 'success');
              }}
            >
              <Icon name="library" size={14} />
              <span className="lbl">{t('saveToLibrary')}</span>
            </button>
            <button className="btn small" disabled={!node?.latex} onClick={copyForWord} title={t('copyForWord')}>
              <Icon name="word" size={14} />
              <span className="lbl">{t('copyForWord')}</span>
            </button>
          </>
        )}
      </div>
      <div className="eq-body" hidden={!open}>
        <div className="eq-field" ref={hostRef} />
        {showSource && (
          <textarea
            className="eq-source"
            spellCheck={false}
            value={latex}
            disabled={!node}
            placeholder="\frac{a}{b}"
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={() => {
              editSession++;
              editor.seal();
            }}
            onChange={(e) => node && editor.apply('Edit LaTeX', (d) => updateNodes(d, { [node.id]: { latex: e.target.value } }), { coalesce: `edit-${editSession}` })}
          />
        )}
        <Palette onInsert={insert} />
      </div>
    </section>
  );
}

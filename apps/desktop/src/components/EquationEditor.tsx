import { useCallback, useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import { addNodes, createMathNode, updateNodes, type MathNode } from '@sciforge/doc-model';
import { validateLatex } from '@sciforge/math-core';
import { copyForWord, editorInsertHook, viewCenter } from '../actions';
import { useT } from '../i18n';
import { library } from '../state/library';
import { editor, toast, ui, useEditor, useUi } from '../state/store';
import { Palette } from './Palette';

MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}mathlive/fonts`;
MathfieldElement.soundsDirectory = null;

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96];

let editSession = 0;

export function EquationEditor() {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const activeId = useUi((s) => s.activeMathId);
  const showSource = useUi((s) => s.showSource);
  const focusTick = useUi((s) => s.focusEditorTick);
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

  const patch = (p: Partial<MathNode>) => {
    if (!node) return;
    // Color pickers fire continuously while dragging; keep those in one undo step.
    if (!p.color) editor.seal();
    // Size/color also become the defaults for the next new equation.
    editor.apply(
      'Equation style',
      (d) => {
        const next = updateNodes(d, { [node.id]: p });
        if (next === d || (!p.fontSize && !p.color)) return next;
        return {
          ...next,
          settings: { ...next.settings, defaultFontSize: p.fontSize ?? next.settings.defaultFontSize, defaultColor: p.color ?? next.settings.defaultColor },
        };
      },
      { coalesce: p.color ? `color-${node.id}` : undefined },
    );
  };

  return (
    <section className="eq-editor" aria-label="Equation editor">
      <div className="eq-head">
        <span className={`eq-mode${node ? ' editing' : ''}`}>{node ? t('editing') : t('newMode')}</span>
        <label title={t('fontSize')}>
          {t('fontSize')}
          <select value={node?.fontSize ?? editor.doc.settings.defaultFontSize} disabled={!node} onChange={(e) => patch({ fontSize: Number(e.target.value) })}>
            {[...new Set([...FONT_SIZES, node?.fontSize ?? 28])].sort((a, b) => a - b).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label title={t('color')}>
          {t('color')}
          <input type="color" value={node?.color ?? '#1f2937'} disabled={!node} onChange={(e) => patch({ color: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={node?.display ?? true} disabled={!node} onChange={(e) => patch({ display: e.target.checked })} />
          {t('displayStyle')}
        </label>
        <label className="check">
          <input type="checkbox" checked={node?.numbered ?? false} disabled={!node} onChange={(e) => patch({ numbered: e.target.checked })} />
          {t('numbered')}
        </label>
        <span className="spacer" />
        <button className={`btn small${showSource ? ' on' : ''}`} onClick={() => ui.set({ showSource: !showSource })}>
          {t('source')}
        </button>
        <button
          className="btn small"
          disabled={!node?.latex}
          onClick={() => {
            if (!node) return;
            library.add(node.latex);
            toast(t('savedToLibrary'), 'success');
          }}
        >
          ☆ {t('saveToLibrary')}
        </button>
        <button className="btn small primary" disabled={!node?.latex} onClick={copyForWord}>
          W {t('copyForWord')}
        </button>
      </div>
      <div className="eq-field-row">
        <div className="eq-field" ref={hostRef} />
        {error && (
          <div className="eq-error" title={error}>
            ⚠ {t('latexError')}: {error}
          </div>
        )}
      </div>
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
    </section>
  );
}

import { useSyncExternalStore } from 'react';
import { Editor, type EditorState } from '@sciforge/doc-model';

/** Tiny observable store for UI-only state. */
export function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      const next = { ...state, ...p };
      if (Object.keys(p).every((k) => (state as Record<string, unknown>)[k] === (p as Record<string, unknown>)[k])) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const editor = new Editor();

export function useEditor<T = EditorState>(select?: (s: EditorState) => T): T {
  const s = useSyncExternalStore(editor.subscribe, editor.getState);
  return select ? select(s) : (s as unknown as T);
}

export type Lang = 'vi' | 'en';

export interface UiState {
  zoom: number;
  panX: number;
  panY: number;
  /** Math node bound to the equation editor. */
  activeMathId: string | null;
  /** Text node being edited inline. */
  editingTextId: string | null;
  lang: Lang;
  showSource: boolean;
  exportOpen: boolean;
  aboutOpen: boolean;
  /** Bumped to ask the equation editor to take focus. */
  focusEditorTick: number;
}

function loadLang(): Lang {
  try {
    const v = localStorage.getItem('sciforge:lang');
    if (v === 'vi' || v === 'en') return v;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

export const ui = createStore<UiState>({
  zoom: 1,
  panX: 80,
  panY: 60,
  activeMathId: null,
  editingTextId: null,
  lang: loadLang(),
  showSource: false,
  exportOpen: false,
  aboutOpen: false,
  focusEditorTick: 0,
});

export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(ui.subscribe, () => select(ui.get()));
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}
export const toasts = createStore<{ list: Toast[] }>({ list: [] });
let toastId = 0;
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3200) {
  const id = ++toastId;
  toasts.set((s) => ({ list: [...s.list, { id, text, kind }] }));
  setTimeout(() => toasts.set((s) => ({ list: s.list.filter((t) => t.id !== id) })), ms);
}

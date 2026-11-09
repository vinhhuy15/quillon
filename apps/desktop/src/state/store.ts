import { useSyncExternalStore } from 'react';
import { Editor, type EditorState, type ShapeKind } from '@quillon/doc-model';

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

/** The app was called SciForge up to 0.2: carry settings, library and autosave over once. */
function migrateStorage() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('sciforge:')) continue;
      const nk = `quillon:${k.slice('sciforge:'.length)}`;
      if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k) ?? '');
    }
  } catch {
    /* storage unavailable */
  }
}
migrateStorage();

export const editor = new Editor();

export function useEditor<T = EditorState>(select?: (s: EditorState) => T): T {
  const s = useSyncExternalStore(editor.subscribe, editor.getState);
  return select ? select(s) : (s as unknown as T);
}

export type Lang = 'en' | 'vi';

export type Tool = 'select' | 'hand' | 'math' | 'text' | 'line' | 'arrow' | 'plot' | `shape:${ShapeKind}`;

export type PanelTab = 'templates' | 'shapes' | 'library';

export interface UiState {
  zoom: number;
  panX: number;
  panY: number;
  tool: Tool;
  /** Math node bound to the equation editor. */
  activeMathId: string | null;
  /** Node whose text (text node) or label (shape) is being edited inline. */
  editingTextId: string | null;
  lang: Lang;
  showSource: boolean;
  exportOpen: boolean;
  aboutOpen: boolean;
  /** Bumped to ask the equation editor to take focus. */
  focusEditorTick: number;
  /** Bumped to focus the label field in the inspector. */
  focusLabelTick: number;
  panelOpen: boolean;
  panelTab: PanelTab;
  dockOpen: boolean;
  snap: boolean;
  contextMenu: { x: number; y: number } | null;
}

function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {
    /* storage unavailable */
  }
  return fallback;
}

export function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const ui = createStore<UiState>({
  zoom: 1,
  panX: 80,
  panY: 60,
  tool: 'select',
  activeMathId: null,
  editingTextId: null,
  lang: load<Lang>('quillon:lang', ['en', 'vi'], 'en'),
  showSource: false,
  exportOpen: false,
  aboutOpen: false,
  focusEditorTick: 0,
  focusLabelTick: 0,
  panelOpen: load('quillon:panel', ['open', 'closed'], 'open') === 'open',
  panelTab: load<PanelTab>('quillon:panel-tab', ['templates', 'shapes', 'library'], 'templates'),
  dockOpen: load('quillon:dock', ['open', 'closed'], 'open') === 'open',
  snap: load('quillon:snap', ['on', 'off'], 'off') === 'on',
  contextMenu: null,
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

import { useSyncExternalStore } from 'react';
import { createStore } from './store';

export interface LibraryItem {
  id: string;
  latex: string;
  added: number;
}

const KEY = 'quillon:library';

function load(): LibraryItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x?.latex === 'string') : [];
  } catch {
    return [];
  }
}

const store = createStore<{ items: LibraryItem[] }>({ items: load() });

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store.get().items));
  } catch {
    /* ignore */
  }
}

export const library = {
  add(latex: string): boolean {
    if (!latex.trim() || store.get().items.some((i) => i.latex === latex)) return false;
    store.set((s) => ({ items: [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, latex, added: Date.now() }, ...s.items] }));
    persist();
    return true;
  },
  remove(id: string) {
    store.set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    persist();
  },
};

export function useLibrary(): LibraryItem[] {
  return useSyncExternalStore(store.subscribe, () => store.get().items);
}

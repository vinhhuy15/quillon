/**
 * Editor store: owns the current document, selection and undo history.
 * Framework-agnostic; the React app subscribes via useSyncExternalStore.
 */
import { createDocument } from './document';
import { History } from './history';
import type { NodeId, SciDocument } from './types';

export interface EditorState {
  doc: SciDocument;
  selection: NodeId[];
  /** Display name / path of the file on disk, if any. */
  fileName: string | null;
  filePath: string | null;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
}

export interface ApplyOptions {
  /** Merge consecutive applies with the same key into one undo step (drags, typing). */
  coalesce?: string;
  /** Selection after the change; defaults to the current selection (pruned). */
  select?: NodeId[];
}

type Listener = () => void;

export class Editor {
  private history = new History<SciDocument>();
  private listeners = new Set<Listener>();
  private savedDoc: SciDocument | null;
  private state: EditorState;

  constructor(doc: SciDocument = createDocument()) {
    this.savedDoc = doc;
    this.state = this.compute({ doc, selection: [], fileName: null, filePath: null });
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): EditorState => this.state;

  get doc(): SciDocument {
    return this.state.doc;
  }
  get selection(): NodeId[] {
    return this.state.selection;
  }

  private compute(base: Pick<EditorState, 'doc' | 'selection' | 'fileName' | 'filePath'>): EditorState {
    const ids = new Set(base.doc.nodes.map((n) => n.id));
    return {
      ...base,
      selection: base.selection.filter((id) => ids.has(id)),
      dirty: base.doc !== this.savedDoc,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      undoLabel: this.history.undoLabel,
      redoLabel: this.history.redoLabel,
    };
  }

  private set(partial: Partial<Pick<EditorState, 'doc' | 'selection' | 'fileName' | 'filePath'>>): void {
    this.state = this.compute({ ...this.state, ...partial });
    for (const fn of this.listeners) fn();
  }

  /** Apply a pure document transform as one (possibly coalesced) undoable step. */
  apply(label: string, fn: (doc: SciDocument) => SciDocument, opts: ApplyOptions = {}): boolean {
    const prev = this.state.doc;
    const next = fn(prev);
    if (next === prev) {
      if (opts.select) this.select(opts.select);
      return false;
    }
    this.history.record(prev, label, opts.coalesce);
    this.set({ doc: next, selection: opts.select ?? this.state.selection });
    return true;
  }

  /** End the current coalescing group (e.g. on pointer-up or editor blur). */
  seal(): void {
    this.history.seal();
  }

  undo(): void {
    const prev = this.history.undo(this.state.doc);
    if (prev) this.set({ doc: prev });
  }

  redo(): void {
    const next = this.history.redo(this.state.doc);
    if (next) this.set({ doc: next });
  }

  select(ids: NodeId[]): void {
    const cur = this.state.selection;
    if (cur.length === ids.length && cur.every((id, i) => id === ids[i])) return;
    this.set({ selection: ids });
  }

  selectAll(): void {
    this.select(this.state.doc.nodes.map((n) => n.id));
  }

  /** Replace the whole document (new/open). Clears history. */
  load(doc: SciDocument, file: { name: string | null; path: string | null } = { name: null, path: null }): void {
    this.history.clear();
    this.savedDoc = doc;
    this.set({ doc, selection: [], fileName: file.name, filePath: file.path });
  }

  /** Flag the document as having unsaved changes (e.g. restored from autosave). */
  markDirty(): void {
    this.savedDoc = null;
    this.set({});
  }

  /** Mark the current document as saved under the given file. */
  markSaved(file: { name: string | null; path: string | null }): void {
    this.savedDoc = this.state.doc;
    this.set({ fileName: file.name, filePath: file.path });
  }
}

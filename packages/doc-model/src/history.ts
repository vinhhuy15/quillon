/**
 * Snapshot-based undo/redo. Documents are immutable with structural sharing,
 * so keeping snapshots is cheap and always correct.
 */
export interface HistoryEntry<T> {
  state: T;
  label: string;
  /** Consecutive pushes with the same key merge into one undo step. */
  coalesceKey?: string;
}

export class History<T> {
  private past: HistoryEntry<T>[] = [];
  private future: HistoryEntry<T>[] = [];
  private openKey: string | undefined;

  constructor(private readonly limit = 300) {}

  /**
   * Record that the app moved away from `previous` to a new state.
   * If `coalesceKey` matches the still-open previous entry, the step is merged.
   */
  record(previous: T, label: string, coalesceKey?: string): void {
    this.future = [];
    if (coalesceKey !== undefined && coalesceKey === this.openKey && this.past.length > 0) return;
    this.past.push({ state: previous, label, coalesceKey });
    if (this.past.length > this.limit) this.past.shift();
    this.openKey = coalesceKey;
  }

  /** Close the current coalescing group so the next push starts a new step. */
  seal(): void {
    this.openKey = undefined;
  }

  undo(current: T): T | undefined {
    const entry = this.past.pop();
    if (!entry) return undefined;
    this.future.push({ ...entry, state: current });
    this.openKey = undefined;
    return entry.state;
  }

  redo(current: T): T | undefined {
    const entry = this.future.pop();
    if (!entry) return undefined;
    this.past.push({ ...entry, state: current });
    this.openKey = undefined;
    return entry.state;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.openKey = undefined;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get undoLabel(): string | undefined {
    return this.past.at(-1)?.label;
  }
  get redoLabel(): string | undefined {
    return this.future.at(-1)?.label;
  }
}

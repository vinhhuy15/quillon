/**
 * Platform layer: file dialogs and disk IO for the browser and the Tauri desktop shell.
 * Everything else in the app is platform-independent.
 */

export interface FileFilter {
  name: string;
  extensions: string[];
  mime: string;
}

export interface OpenedFile {
  name: string;
  /** Absolute path (desktop) or an opaque key for a browser file handle; null if not re-writable. */
  path: string | null;
  bytes: Uint8Array;
}

export interface SaveOptions {
  suggestedName: string;
  filter: FileFilter;
  /** Existing location to overwrite without asking (Save vs Save As). */
  path?: string | null;
}

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const basename = (p: string) => p.split(/[\\/]/).pop() ?? p;

// ---------------------------------------------------------------- browser

interface FsHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: BlobPart): Promise<void>; close(): Promise<void> }>;
}
type PickerWindow = Window & {
  showOpenFilePicker?: (o: unknown) => Promise<FsHandle[]>;
  showSaveFilePicker?: (o: unknown) => Promise<FsHandle>;
};

const handles = new Map<string, FsHandle>();
let handleSeq = 0;
const rememberHandle = (h: FsHandle) => {
  const key = `browser-handle:${++handleSeq}`;
  handles.set(key, h);
  return key;
};

const pickerTypes = (filters: FileFilter[]) =>
  filters.map((f) => ({ description: f.name, accept: { [f.mime]: f.extensions.map((e) => `.${e}`) } }));

async function browserOpen(filters: FileFilter[]): Promise<OpenedFile | null> {
  const w = window as PickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const [h] = await w.showOpenFilePicker({ types: pickerTypes(filters), excludeAcceptAllOption: false });
      const file = await h.getFile();
      return { name: file.name, path: rememberHandle(h), bytes: new Uint8Array(await file.arrayBuffer()) };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      // Fall through to <input type=file> on SecurityError etc.
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function download(bytes: Uint8Array, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function browserSave(bytes: Uint8Array, o: SaveOptions): Promise<{ name: string; path: string | null } | null> {
  const existing = o.path ? handles.get(o.path) : undefined;
  const w = window as PickerWindow;
  let handle = existing;
  if (!handle && w.showSaveFilePicker) {
    try {
      handle = await w.showSaveFilePicker({ suggestedName: o.suggestedName, types: pickerTypes([o.filter]) });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
    }
  }
  if (handle) {
    const ws = await handle.createWritable();
    await ws.write(bytes as BlobPart);
    await ws.close();
    return { name: handle.name, path: o.path && existing ? o.path : rememberHandle(handle) };
  }
  download(bytes, o.suggestedName, o.filter.mime);
  return { name: o.suggestedName, path: null };
}

// ---------------------------------------------------------------- desktop (Tauri)

async function desktopOpen(filters: FileFilter[]): Promise<OpenedFile | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const path = await open({ multiple: false, directory: false, filters: filters.map((f) => ({ name: f.name, extensions: f.extensions })) });
  if (!path || Array.isArray(path)) return null;
  return { name: basename(path), path, bytes: await readFile(path) };
}

async function desktopSave(bytes: Uint8Array, o: SaveOptions): Promise<{ name: string; path: string | null } | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  let path = o.path ?? null;
  if (!path) {
    path = await save({ defaultPath: o.suggestedName, filters: [{ name: o.filter.name, extensions: o.filter.extensions }] });
    if (!path) return null;
  }
  await writeFile(path, bytes);
  return { name: basename(path), path };
}

// ---------------------------------------------------------------- public API

export function openFile(filters: FileFilter[]): Promise<OpenedFile | null> {
  return isDesktop ? desktopOpen(filters) : browserOpen(filters);
}

export function saveFile(bytes: Uint8Array, o: SaveOptions) {
  return isDesktop ? desktopSave(bytes, o) : browserSave(bytes, o);
}

export async function setWindowTitle(title: string) {
  document.title = title;
  if (isDesktop) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setTitle(title);
    } catch {
      /* permission missing or not in a window */
    }
  }
}

export const FILTERS = {
  sci: { name: 'SciForge document', extensions: ['sci'], mime: 'application/x-sciforge' },
  png: { name: 'PNG image', extensions: ['png'], mime: 'image/png' },
  svg: { name: 'SVG image', extensions: ['svg'], mime: 'image/svg+xml' },
  docx: {
    name: 'Word document',
    extensions: ['docx'],
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  tex: { name: 'LaTeX', extensions: ['tex'], mime: 'application/x-tex' },
  html: { name: 'HTML', extensions: ['html'], mime: 'text/html' },
} satisfies Record<string, FileFilter>;

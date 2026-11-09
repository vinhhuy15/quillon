import { vi } from './locales/vi';
import { ui, useUi, type Lang } from './state/store';

/** UI strings. English is the source language; other locales live in ./locales. */
const EN = {
  untitled: 'Untitled',
  new: 'New',
  open: 'Open…',
  save: 'Save',
  saveAs: 'Save as…',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  delete: 'Delete',
  duplicate: 'Duplicate',
  selectAll: 'Select all',
  bringFront: 'Bring to front',
  sendBack: 'Send to back',
  newEquation: 'New equation',
  newText: 'New text',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomReset: 'Reset to 100%',
  zoomFit: 'Fit to screen',
  export: 'Export…',
  copyForWord: 'Copy for Word',
  copyLatex: 'Copy LaTeX',
  copyMathml: 'Copy MathML',
  copyImage: 'Copy PNG image',
  copySvg: 'Copy SVG code',
  copied: 'Copied',
  copiedWord: 'Copied — paste into Word as an editable equation',
  clipboardFailed: 'Clipboard is not available',
  nothingSelected: 'Select an equation first',
  language: 'Language',
  about: 'About',
  editorPlaceholder: 'Type math or LaTeX (e.g. \\frac, \\alpha)… or click a symbol to insert',
  editing: 'Editing',
  newMode: 'New equation (start typing)',
  source: 'LaTeX source',
  fontSize: 'Size',
  color: 'Color',
  displayStyle: 'Display style',
  numbered: 'Numbered',
  saveToLibrary: 'Save to library',
  latexError: 'LaTeX error',
  done: 'Done',
  templates: 'Templates',
  myLibrary: 'My library',
  libraryEmpty: 'Empty. Select an equation and click “Save to library”.',
  savedToLibrary: 'Saved to library',
  remove: 'Remove',
  search: 'Search…',
  exportTitle: 'Export',
  scope: 'Scope',
  scopeSelection: 'Selection',
  scopeAll: 'Whole document',
  format: 'Format',
  resolution: 'Resolution',
  background: 'Background',
  transparent: 'Transparent',
  white: 'White',
  cancel: 'Cancel',
  exportBtn: 'Export',
  exported: 'Exported',
  fmtPng: 'PNG image (with editable source)',
  fmtSvg: 'SVG vector (with editable source)',
  fmtDocx: 'Word .docx (native equations)',
  fmtTex: 'LaTeX .tex',
  fmtHtml: 'HTML page with MathML',
  emptyDoc: 'The document is empty',
  unsavedConfirm: 'You have unsaved changes. Discard them?',
  openFailed: 'Could not open file',
  saved: 'Saved',
  restored: 'Restored your previous session',
  importedEquation: 'Imported an editable equation',
  imageNoSource: 'This image has no SciForge source',
  objects: 'objects',
  selected: 'selected',
  unsaved: 'unsaved',
  hintCanvas: 'Double-click empty space to add an equation · Ctrl+wheel to zoom · Space+drag to pan',
  aboutText: 'SciForge v0.1 — an open-source toolkit for math and scientific figures. Apache-2.0 licensed.',
  shortcuts: 'Keyboard shortcuts',
  close: 'Close',
} satisfies Record<string, string>;

export type StringKey = keyof typeof EN;

export interface Locale {
  strings: Partial<Record<StringKey, string>>;
  /** Free-form English text (palette, template and symbol names) → translation. */
  phrases: Record<string, string>;
}

const LOCALES: Partial<Record<Lang, Locale>> = { vi };

export function t(key: StringKey, lang: Lang = ui.get().lang): string {
  return LOCALES[lang]?.strings[key] ?? EN[key];
}

/** Translate a free-form English phrase (falls back to the English text). */
export function tr(text: string, lang: Lang = ui.get().lang): string {
  return LOCALES[lang]?.phrases[text] ?? text;
}

export function useT(): (key: StringKey) => string {
  const lang = useUi((s) => s.lang);
  return (key) => t(key, lang);
}

export function useTr(): (text: string) => string {
  const lang = useUi((s) => s.lang);
  return (text) => tr(text, lang);
}

export function setLang(lang: Lang) {
  ui.set({ lang });
  try {
    localStorage.setItem('sciforge:lang', lang);
  } catch {
    /* ignore */
  }
}

import { vi } from './locales/vi';
import { ui, useUi, type Lang } from './state/store';

/** UI strings. English is the source language; other locales live in ./locales. */
const EN = {
  untitled: 'Untitled',
  // menus
  menuFile: 'File',
  menuEdit: 'Edit',
  menuInsert: 'Insert',
  menuArrange: 'Arrange',
  menuView: 'View',
  menuHelp: 'Help',
  new: 'New',
  open: 'Open…',
  save: 'Save',
  saveAs: 'Save as…',
  export: 'Export…',
  exportShort: 'Export',
  undo: 'Undo',
  redo: 'Redo',
  paste: 'Paste',
  delete: 'Delete',
  duplicate: 'Duplicate',
  selectAll: 'Select all',
  bringFront: 'Bring to front',
  bringForward: 'Bring forward',
  sendBackward: 'Send backward',
  sendBack: 'Send to back',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignTop: 'Align top',
  alignMiddle: 'Align middle',
  alignBottom: 'Align bottom',
  distributeH: 'Distribute horizontally',
  distributeV: 'Distribute vertically',
  group: 'Group',
  ungroup: 'Ungroup',
  rotate90: 'Rotate 90°',
  flip: 'Flip horizontally',
  lock: 'Lock',
  unlock: 'Unlock',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomReset: 'Actual size (100%)',
  zoomFit: 'Zoom to fit',
  snapToGrid: 'Snap to grid',
  snap: 'Snap',
  insertPanel: 'Insert panel',
  equationEditor: 'Equation editor',
  shortcutsAbout: 'Keyboard shortcuts & about',
  insert: 'Insert',
  tools: 'Tools',
  // tools
  toolSelect: 'Select',
  toolHand: 'Hand',
  toolMath: 'Equation',
  toolText: 'Text',
  toolRect: 'Rectangle',
  toolEllipse: 'Ellipse',
  toolLine: 'Line',
  toolArrow: 'Arrow',
  toolPlot: 'Function plot',
  hintSelect: 'Click to select · drag to move · drag empty space to select an area · double-click empty space for a new equation',
  hintHand: 'Drag to pan the view (or hold Space with any tool)',
  hintMath: 'Click where the equation should go',
  hintText: 'Click to place text · use $…$ for inline math',
  hintShape: 'Drag to draw · Shift for a square or circle · click for the default size',
  hintLine: 'Drag to draw · start or end on a shape to connect it · Shift snaps to 15°',
  hintPlot: 'Drag to set the plot area, or click for the default size',
  // copy
  copyForWord: 'Copy for Word',
  copyForWordHint: 'Copy for Word: equations paste as native Word equations, drawings as a picture',
  copyLatex: 'Copy LaTeX',
  copyMathml: 'Copy MathML',
  copyImage: 'Copy as PNG image',
  copySvg: 'Copy SVG code',
  copyTikz: 'Copy TikZ code',
  copied: 'Copied',
  copiedWord: 'Copied — paste into Word as an editable equation',
  copiedPicture: 'Copied as a picture — paste into Word, PowerPoint or any editor',
  copiedTikz: 'TikZ copied — needs \\usepackage{tikz} and \\usetikzlibrary{arrows.meta}',
  clipboardFailed: 'Clipboard is not available',
  nothingSelected: 'Select an equation first',
  selectSomething: 'Select something first',
  // equation editor
  editingSelected: 'Editing the selected equation',
  newMode: 'Type to create a new equation',
  source: 'Show LaTeX source',
  saveToLibrary: 'Save to library',
  savedToLibrary: 'Saved to library',
  latexError: 'LaTeX error',
  // panels
  templates: 'Templates',
  shapesSymbols: 'Shapes & symbols',
  tabShapes: 'Shapes',
  shapesFlowchart: 'Shapes & flowchart',
  shapeTileHint: 'Click to draw, or drag onto the canvas',
  symbolsHint: 'Click a symbol to insert it, or drag it onto the canvas. Lines snap to the end points of circuit symbols.',
  myLibrary: 'Library',
  libraryEmpty: 'Nothing saved yet. Select an equation and choose “Save to library” in the equation editor.',
  remove: 'Remove',
  search: 'Search',
  // canvas
  emptyTitle: 'Start with an equation, a shape or a plot',
  emptyHint: 'Double-click anywhere to type an equation, pick a tool on the left, or drag a template or symbol in.',
  // inspector
  properties: 'Properties',
  objects: 'objects',
  selected: 'selected',
  document: 'Document',
  title: 'Title',
  eqSize: 'Equation size',
  eqColor: 'Equation color',
  canvas: 'Canvas',
  inspectorEmpty: 'Select an object to edit its properties.',
  typeMath: 'Equation',
  typeText: 'Text',
  typeShape: 'Shape',
  typeLine: 'Line',
  typePlot: 'Plot',
  typeSymbol: 'Symbol',
  fontSize: 'Size',
  color: 'Color',
  font: 'Font',
  fontSans: 'Sans-serif',
  fontSerif: 'Serif',
  fontMono: 'Monospace',
  style: 'Style',
  bold: 'Bold',
  italic: 'Italic',
  displayStyle: 'Display style',
  numbered: 'Numbered',
  editEquation: 'Edit equation',
  inlineMathHint: 'Write $x^2$ inside text for inline math.',
  shapeKind: 'Shape',
  fill: 'Fill',
  none: 'None',
  default: 'Default',
  stroke: 'Stroke',
  strokeWidth: 'Width',
  dash: 'Dash',
  dashSolid: 'Solid',
  dashDashed: 'Dashed',
  dashDotted: 'Dotted',
  label: 'Label',
  labelPlaceholder: 'Text, $math$ allowed',
  symbolLabelPlaceholder: 'e.g. $R_1$ or 10 Ω',
  startCap: 'Start',
  endCap: 'End',
  cap_none: 'None',
  cap_arrow: 'Arrow',
  cap_open: 'Open arrow',
  cap_dot: 'Dot',
  cap_bar: 'Bar',
  routing: 'Path',
  routeStraight: 'Straight',
  routeElbow: 'Elbow',
  routeCurve: 'Curve',
  detach: 'Detach from shapes',
  functions: 'Functions',
  addFunction: 'Add',
  noFunctions: 'No functions yet.',
  parametric: 'Parametric',
  polar: 'Polar',
  legendLabel: 'Legend label (optional)',
  exprHint: 'Examples: 2x^2 - 3x + 1, sin(2x)/x, e^(-x^2), sqrt(1 - x^2), |x|, ln x',
  axes: 'Axes',
  axesStyle: 'Style',
  axesCross: 'Textbook',
  axesCrossHint: 'Axes through the origin with arrows',
  axesBox: 'Framed',
  axesBoxHint: 'Framed axes with outside tick labels, as in papers',
  xLabel: 'x label',
  yLabel: 'y label',
  grid: 'Grid',
  legend: 'Legend',
  arrange: 'Arrange',
  rotation: 'Rotation',
  // export
  exportTitle: 'Export',
  format: 'Format',
  scope: 'What',
  scopeSelection: 'Selection',
  scopeAll: 'Whole page',
  resolution: 'Resolution',
  background: 'Background',
  transparent: 'Transparent',
  white: 'White',
  cancel: 'Cancel',
  exportBtn: 'Export',
  exported: 'Exported',
  fmtPng: 'Picture for slides and documents; re-editable in SciForge',
  fmtSvg: 'Vector graphics; re-editable in SciForge',
  fmtDocx: 'Native Word equations; drawings as pictures',
  fmtTikz: 'Standalone TikZ picture for LaTeX papers',
  fmtTex: 'LaTeX document: equations, text and TikZ figures',
  fmtHtml: 'Web page with MathML and SVG figures',
  emptyDoc: 'Nothing to export',
  // files
  unsavedConfirm: 'You have unsaved changes. Discard them?',
  openFailed: 'Could not open file',
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  restored: 'Restored your previous session',
  importedEquation: 'Imported an editable equation',
  importedObjects: 'Imported editable objects',
  imageNoSource: 'This image has no SciForge source',
  // about
  aboutText:
    'SciForge is an open-source toolkit for equations and scientific figures, for researchers, teachers and students. Apache-2.0 licensed.',
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

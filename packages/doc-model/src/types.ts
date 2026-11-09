/**
 * Core document schema for Quillon (.qln files).
 * The array order of `nodes` is the z-order (first = bottom).
 */

export const SCHEMA_ID = 'quillon/document';
/** Schema ids written by earlier versions of the app (it was called SciForge up to 0.2). */
export const LEGACY_SCHEMA_IDS: readonly string[] = ['sciforge/document'];
/** v1: math + text (0.1). v2: shapes, lines/connectors, plots, symbols, groups (0.2). v3: images (0.4). */
export const SCHEMA_VERSION = 3;

export type NodeId = string;

export interface Point {
  x: number;
  y: number;
}

export interface BaseNode {
  id: NodeId;
  type: string;
  /** Top-left position in canvas units (CSS px at 100% zoom). For lines: the first point. */
  x: number;
  y: number;
  locked?: boolean;
  /** Nodes sharing a group id are selected and moved together. */
  group?: string;
}

export type Dash = 'solid' | 'dashed' | 'dotted';

export interface MathNode extends BaseNode {
  type: 'math';
  /** LaTeX source — the single source of truth for the equation. */
  latex: string;
  /** Font size in px at 100% zoom. */
  fontSize: number;
  color: string;
  /** Display style (\displaystyle) vs inline/text style. */
  display: boolean;
  /** Whether the equation gets an automatic number "(n)". */
  numbered: boolean;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface TextNode extends BaseNode {
  type: 'text';
  /** Plain text; `$…$` spans are rendered as inline math, `\$` is a literal dollar. */
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  align?: TextAlign;
  /** A panel letter ("a", "(b)") placed by Figure layout; replaced when the layout is applied again. */
  panelLabel?: boolean;
}

export type ShapeKind = 'rect' | 'roundrect' | 'ellipse' | 'diamond' | 'triangle' | 'parallelogram' | 'hexagon' | 'stadium';

export interface ShapeNode extends BaseNode {
  type: 'shape';
  shape: ShapeKind;
  width: number;
  height: number;
  /** Degrees, clockwise, around the center. */
  rotation: number;
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  /** Fill color or 'none'. */
  fill: string;
  /** Centered label; supports `$…$` inline math. */
  label: string;
  labelSize: number;
  labelColor: string;
}

export type LineCap = 'none' | 'arrow' | 'open' | 'dot' | 'bar';
export type LineRouting = 'straight' | 'elbow' | 'curve';

/** A line end attached to another node; `port` names a connection point of a symbol. */
export interface Binding {
  node: NodeId;
  port?: string;
}

export interface LineNode extends BaseNode {
  type: 'line';
  /** Vertices relative to (x, y); at least two. The first is always (0, 0). */
  points: Point[];
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  startCap: LineCap;
  endCap: LineCap;
  routing: LineRouting;
  start?: Binding;
  end?: Binding;
  /** Label at the middle of the line; supports `$…$`. */
  label?: string;
  labelSize?: number;
}

export type PlotKind = 'y' | 'param' | 'polar';

export interface PlotFunction {
  id: string;
  kind: PlotKind;
  /** y = f(x); for 'param' x(t); for 'polar' r(θ) (variable `t` or `theta`). */
  expr: string;
  /** y(t) for parametric curves. */
  expr2?: string;
  /** Parameter range for 'param' / 'polar'. */
  tMin?: number;
  tMax?: number;
  color: string;
  width: number;
  dash: Dash;
  /** Legend text (LaTeX allowed via `$…$`). */
  label?: string;
}

export type PlotAxes = 'cross' | 'box';

export interface PlotNode extends BaseNode {
  type: 'plot';
  width: number;
  height: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  functions: PlotFunction[];
  /** 'cross': axes through the origin with arrows (textbook); 'box': framed axes (papers). */
  axes: PlotAxes;
  grid: boolean;
  xLabel: string;
  yLabel: string;
  fontSize: number;
  legend: boolean;
}

export interface SymbolNode extends BaseNode {
  type: 'symbol';
  /** Id in the symbol library, e.g. "circuit.resistor". */
  symbol: string;
  width: number;
  height: number;
  rotation: number;
  /** Mirror horizontally (before rotation). */
  flip?: boolean;
  stroke: string;
  strokeWidth: number;
  /** Accent fill used by some symbols (masses, ground blocks…); 'none' for default. */
  fill: string;
  label: string;
  labelSize: number;
}

/** Visible part of an image, as fractions (0–1) of its natural size. */
export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface ScaleBar {
  /** Real-world size of one natural image pixel, in `unit` (from the microscope or camera calibration). */
  unitsPerPixel: number;
  /** Length of the bar, in `unit`. */
  length: number;
  unit: string;
  position: Corner;
  color: string;
  showLabel: boolean;
}

/** An inset: a cropped copy of another image, with a marker rectangle drawn over the source. */
export interface InsetLink {
  source: NodeId;
  /** Shape node outlining the inset region on the source; kept in place automatically. */
  marker?: NodeId;
}

export interface ImageNode extends BaseNode {
  type: 'image';
  /** Embedded image as a data: URL (PNG, JPEG, WebP, GIF or SVG). */
  src: string;
  /** Original file name, if known. */
  name?: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Displayed size of the visible (cropped) region. */
  width: number;
  height: number;
  crop?: ImageCrop;
  /** Percent; 100 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale?: boolean;
  invert?: boolean;
  /** 0–1. */
  opacity: number;
  /** Frame color or 'none'. */
  border: string;
  borderWidth: number;
  scaleBar?: ScaleBar;
  inset?: InsetLink;
}

export type SciNode = MathNode | TextNode | ShapeNode | LineNode | PlotNode | SymbolNode | ImageNode;
export type NodeType = SciNode['type'];

export interface DocumentMeta {
  title: string;
  created: string;
  modified: string;
  /** App that last wrote the file, e.g. "Quillon 0.4.0". */
  generator: string;
}

export interface DocumentSettings {
  defaultFontSize: number;
  defaultColor: string;
}

export interface SciDocument {
  schema: typeof SCHEMA_ID;
  version: number;
  meta: DocumentMeta;
  settings: DocumentSettings;
  nodes: SciNode[];
}

type Fields<T> = Omit<T, 'id' | 'type'>;

/** Partial update for a node; `id`/`type` are immutable. `undefined` removes an optional field. */
export type NodePatch = Partial<
  Fields<MathNode> & Fields<TextNode> & Fields<ShapeNode> & Fields<LineNode> & Fields<PlotNode> & Fields<SymbolNode> & Fields<ImageNode>
>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

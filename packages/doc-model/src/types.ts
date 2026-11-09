/**
 * Core document schema for SciForge (.sci files).
 * The array order of `nodes` is the z-order (first = bottom).
 */

export const SCHEMA_ID = 'sciforge/document';
/** v1: math + text (SciForge 0.1). v2: shapes, lines/connectors, plots, symbols, groups (0.2). */
export const SCHEMA_VERSION = 2;

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

export type SciNode = MathNode | TextNode | ShapeNode | LineNode | PlotNode | SymbolNode;
export type NodeType = SciNode['type'];

export interface DocumentMeta {
  title: string;
  created: string;
  modified: string;
  /** App that last wrote the file, e.g. "SciForge 0.2.0". */
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
  Fields<MathNode> & Fields<TextNode> & Fields<ShapeNode> & Fields<LineNode> & Fields<PlotNode> & Fields<SymbolNode>
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

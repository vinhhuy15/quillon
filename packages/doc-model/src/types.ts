/**
 * Core document schema for SciForge (.sci files).
 * The array order of `nodes` is the z-order (first = bottom).
 */

export const SCHEMA_ID = 'sciforge/document';
export const SCHEMA_VERSION = 1;

export type NodeId = string;

export interface BaseNode {
  id: NodeId;
  type: string;
  /** Top-left position in canvas units (CSS px at 100% zoom). */
  x: number;
  y: number;
  locked?: boolean;
}

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

export interface TextNode extends BaseNode {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

export type SciNode = MathNode | TextNode;
export type NodeType = SciNode['type'];

export interface DocumentMeta {
  title: string;
  created: string;
  modified: string;
  /** App that last wrote the file, e.g. "SciForge 0.1.0". */
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

/** Partial update for a node; `id`/`type` are immutable. */
export type NodePatch = Partial<Omit<MathNode, 'id' | 'type'>> & Partial<Omit<TextNode, 'id' | 'type'>>;

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

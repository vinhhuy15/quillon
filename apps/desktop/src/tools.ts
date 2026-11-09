import type { ShapeKind } from '@sciforge/doc-model';
import type { StringKey } from './i18n';
import type { IconName } from './components/Icons';
import { ui, type Tool } from './state/store';

export interface ToolDef {
  id: Tool;
  icon: IconName;
  label: StringKey;
  key: string;
  hint: StringKey;
}

export const TOOLS: (ToolDef | 'sep')[] = [
  { id: 'select', icon: 'select', label: 'toolSelect', key: 'V', hint: 'hintSelect' },
  { id: 'hand', icon: 'hand', label: 'toolHand', key: 'H', hint: 'hintHand' },
  'sep',
  { id: 'math', icon: 'math', label: 'toolMath', key: 'M', hint: 'hintMath' },
  { id: 'text', icon: 'text', label: 'toolText', key: 'T', hint: 'hintText' },
  'sep',
  { id: 'shape:rect', icon: 'rect', label: 'toolRect', key: 'R', hint: 'hintShape' },
  { id: 'shape:ellipse', icon: 'ellipse', label: 'toolEllipse', key: 'O', hint: 'hintShape' },
  { id: 'line', icon: 'line', label: 'toolLine', key: 'L', hint: 'hintLine' },
  { id: 'arrow', icon: 'arrow', label: 'toolArrow', key: 'A', hint: 'hintLine' },
  'sep',
  { id: 'plot', icon: 'plot', label: 'toolPlot', key: 'P', hint: 'hintPlot' },
];

export const toolDefs = TOOLS.filter((t): t is ToolDef => t !== 'sep');

export function toolHint(tool: Tool): StringKey {
  if (tool.startsWith('shape:')) return 'hintShape';
  return toolDefs.find((t) => t.id === tool)?.hint ?? 'hintSelect';
}

export const shapeOfTool = (tool: Tool): ShapeKind | null => (tool.startsWith('shape:') ? (tool.slice(6) as ShapeKind) : null);

export function setTool(tool: Tool) {
  ui.set({ tool, contextMenu: null });
}

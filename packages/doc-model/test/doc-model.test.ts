import { describe, expect, it } from 'vitest';
import {
  addNodes,
  createDocument,
  createMathNode,
  createTextNode,
  decodeSci,
  DocumentFormatError,
  Editor,
  encodeSci,
  equationNumbers,
  moveNodes,
  parseDocument,
  removeNodes,
  reorderNodes,
  updateNodes,
} from '../src';

const ids = (d: { nodes: { id: string }[] }) => d.nodes.map((n) => n.id);

describe('commands', () => {
  it('adds, updates, moves and removes nodes immutably', () => {
    const d0 = createDocument();
    const a = createMathNode({ id: 'a', latex: 'x' });
    const b = createTextNode({ id: 'b', text: 'hi', x: 10 });
    const d1 = addNodes(d0, [a, b]);
    expect(d0.nodes).toHaveLength(0);
    expect(ids(d1)).toEqual(['a', 'b']);

    const d2 = updateNodes(d1, { a: { latex: 'y' } });
    expect((d2.nodes[0] as { latex: string }).latex).toBe('y');
    expect(updateNodes(d2, { a: { latex: 'y' } })).toBe(d2); // no-op keeps identity

    const d3 = moveNodes(d2, ['b'], 5, -3);
    expect(d3.nodes[1]).toMatchObject({ x: 15, y: -3 });

    expect(ids(removeNodes(d3, ['a']))).toEqual(['b']);
    expect(() => addNodes(d3, [createMathNode({ id: 'a' })])).toThrow();
  });

  it('does not move locked nodes', () => {
    const d = addNodes(createDocument(), [createMathNode({ id: 'a', locked: true })]);
    expect(moveNodes(d, ['a'], 10, 10)).toBe(d);
  });

  it('reorders z-order', () => {
    const d = addNodes(
      createDocument(),
      ['a', 'b', 'c', 'd'].map((id) => createMathNode({ id })),
    );
    expect(ids(reorderNodes(d, ['b'], 'front'))).toEqual(['a', 'c', 'd', 'b']);
    expect(ids(reorderNodes(d, ['c'], 'back'))).toEqual(['c', 'a', 'b', 'd']);
    expect(ids(reorderNodes(d, ['a', 'b'], 'forward'))).toEqual(['c', 'a', 'b', 'd']);
    expect(ids(reorderNodes(d, ['c', 'd'], 'backward'))).toEqual(['a', 'c', 'd', 'b']);
    expect(reorderNodes(d, ['d'], 'front')).toBe(d);
  });

  it('numbers equations in reading order', () => {
    const d = addNodes(createDocument(), [
      createMathNode({ id: 'low', y: 200, numbered: true }),
      createMathNode({ id: 'top', y: 10, numbered: true }),
      createMathNode({ id: 'none', y: 0 }),
    ]);
    expect([...equationNumbers(d)]).toEqual([
      ['top', 1],
      ['low', 2],
    ]);
  });
});

describe('Editor history', () => {
  it('undoes and redoes, coalescing drags', () => {
    const ed = new Editor();
    ed.apply('add', (d) => addNodes(d, [createMathNode({ id: 'a' })]), { select: ['a'] });
    for (let i = 0; i < 5; i++) ed.apply('move', (d) => moveNodes(d, ['a'], 1, 0), { coalesce: 'drag1' });
    ed.seal();
    expect(ed.doc.nodes[0].x).toBe(5);
    expect(ed.getState().dirty).toBe(true);

    ed.undo();
    expect(ed.doc.nodes[0].x).toBe(0);
    ed.undo();
    expect(ed.doc.nodes).toHaveLength(0);
    expect(ed.selection).toEqual([]);
    expect(ed.getState().canUndo).toBe(false);

    ed.redo();
    ed.redo();
    expect(ed.doc.nodes[0].x).toBe(5);
    expect(ed.getState().canRedo).toBe(false);
  });

  it('tracks dirty state against the saved document', () => {
    const ed = new Editor();
    ed.apply('add', (d) => addNodes(d, [createMathNode({ id: 'a' })]));
    ed.markSaved({ name: 'x.sci', path: null });
    expect(ed.getState().dirty).toBe(false);
    ed.apply('edit', (d) => updateNodes(d, { a: { latex: 'z' } }));
    expect(ed.getState().dirty).toBe(true);
    ed.undo();
    expect(ed.getState().dirty).toBe(false);
  });
});

describe('.sci files', () => {
  it('round-trips through the zip container', () => {
    const doc = addNodes(createDocument('Test'), [
      createMathNode({ id: 'a', latex: '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}', numbered: true }),
      createTextNode({ id: 'b', text: 'Định lý Viète' }),
    ]);
    const bytes = encodeSci(doc, { previewSvg: '<svg/>' });
    expect(bytes[0]).toBe(0x50);
    expect(decodeSci(bytes)).toEqual(doc);
  });

  it('accepts plain JSON and rejects junk', () => {
    const doc = createDocument();
    expect(decodeSci(new TextEncoder().encode(JSON.stringify(doc)))).toEqual(doc);
    expect(() => decodeSci(new TextEncoder().encode('hello'))).toThrow(DocumentFormatError);
    expect(() => parseDocument({ schema: 'sciforge/document', version: 99, nodes: [] })).toThrow(/newer/);
  });

  it('repairs untrusted input', () => {
    const doc = parseDocument({
      schema: 'sciforge/document',
      version: 1,
      nodes: [
        { id: 'a', type: 'math', latex: 'x', x: 'bad' },
        { id: 'a', type: 'math', latex: 'y' },
        { type: 'future-shape' },
        null,
      ],
    });
    expect(doc.nodes).toHaveLength(2);
    expect(doc.nodes[0].x).toBe(0);
    expect(doc.nodes[1].id).not.toBe('a');
  });
});

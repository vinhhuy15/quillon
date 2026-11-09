import { describe, expect, it } from 'vitest';
import { latexToOmml, validateLatex } from '@sciforge/math-core';
import { displayLatex, PALETTES } from '../src/palette-data';
import { TEMPLATES } from '../src/templates-data';

describe('palette content', () => {
  const items = PALETTES.flatMap((g) => g.items.map((it) => [g.id, it] as const));
  it.each(items)('%s: %o renders', (_g, item) => {
    expect(validateLatex(displayLatex(item))).toBeNull();
    // What actually gets inserted (placeholders filled) must also be valid.
    expect(validateLatex(item.i.replace(/#0|#\?/g, 'x'))).toBeNull();
  });
});

describe('templates', () => {
  const items = TEMPLATES.flatMap((g) => g.items.map((it) => [it.title[1], it.latex] as const));
  it.each(items)('%s renders and converts to OMML', (_t, latex) => {
    expect(validateLatex(latex)).toBeNull();
    expect(() => latexToOmml(latex)).not.toThrow();
  });
});

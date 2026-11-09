# Architecture

## Layers

```
┌──────────────────────────────── apps/desktop ────────────────────────────────┐
│ React UI: TopBar · ToolRail · InsertPanel · Canvas · Inspector · EquationDock │
│ actions.ts  — every user command (menus, shortcuts, panels)                  │
│ layout.ts   — cached layouts + the connector normalizer                      │
│ platform.ts — file dialogs/IO: browser (File System Access) | Tauri          │
└──────────┬──────────────────────────┬───────────────────────────┬────────────┘
           │                          │                           │
  packages/doc-model         packages/figure-core          packages/math-core
  (no DOM; fflate only)      (no DOM)                      (MathJax lite adaptor)
  • schema v2 + migration    • layoutNode for every type   • LaTeX → SVG / MathML
  • pure commands, groups    • shapes, symbols (ports)     • MathML → OMML
  • History (undo/redo)      • lines: routing, arrows,     • .docx writer (text,
  • Editor + normalizer        connector resolution          equations, pictures)
  • .sci zip container       • plots + expression parser   • Word clipboard HTML
                             • rich text ($…$ inline math) • PNG iTXt / SVG metadata
                             • sceneToSvg, sceneToTikz
```

## Key decisions

- **One source of truth per equation: LaTeX.** Every other format (SVG, MathML, OMML, PNG) is derived.
  The LaTeX is embedded in exported PNG/SVG so images can be re-imported and edited.
- **Same renderer for screen and export.** `figure-core/scene.ts` produces the SVG markup the canvas
  displays and the markup exporters write, so what you see is what you get. The TikZ writer walks the same
  geometry (plot ticks, symbol primitives, line routes), so the PDF matches the canvas.
- **Connectors are stored resolved.** A line keeps its end points *and* its `start`/`end` bindings. After every
  edit the editor's normalizer (`resolveConnectors`) recomputes attached end points from the current geometry,
  so files, exports and older readers always see correct coordinates without a layout pass.
- **Symbols are data.** Each symbol is a few path/circle/text primitives at its natural size plus named ports.
  One definition renders to SVG and TikZ, scales without distorting strokes, and lets wires snap.
- **Plot formulas never reach `eval`.** They are tokenized and compiled to closures over a fixed set of math functions.
- **Immutable documents + snapshot history.** Commands are pure functions; undo stores previous
  document references (structural sharing keeps it cheap). Continuous gestures (drag, typing,
  color picking) pass a `coalesce` key so they become a single undo step.
- **Own MathML → OMML converter** instead of Microsoft's `MML2OMML.XSL` (not redistributable).
  Word's HTML clipboard dialect differs from `.docx` OMML (old namespace, text directly in `<m:r>`);
  both forms are verified against Word 16.
- **Platform layer is tiny.** Only `platform.ts` knows about Tauri; the rest runs in any browser.

## Adding a new node type

1. Add the interface to `doc-model/src/types.ts`, a factory and a case in `normalizeNode` (validation).
2. Add layout/markup in `figure-core/src/scene.ts` (`layoutNode`) and, if lines may attach to it,
   its outline in `attachGeometry`.
3. Add a case in `figure-core/src/tikz.ts`.
4. Add a section to `apps/desktop/src/components/Inspector.tsx` and, if it is drawn with a tool, a tool in `tools.ts`.
5. Bump `SCHEMA_VERSION` when older apps must not open the file silently, and add a step to `MIGRATIONS`.

## Adding a symbol

Add an entry to `SYMBOLS` in `figure-core/src/symbols.ts`: natural size, primitives (`P` path with absolute
`M/L/C/A/Z`, `C` circle, `T` text), optional `ports` and `accent` fill. The tests in
`packages/figure-core/test/figure-core.test.ts` check that every symbol renders and keeps its ports inside its box.

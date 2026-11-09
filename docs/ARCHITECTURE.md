# Architecture

## Layers

```
┌────────────────────────── apps/desktop ───────────────────────────┐
│ React UI: Toolbar · Canvas · EquationEditor (MathLive) · Sidebar  │
│ actions.ts  — every user command (menus, shortcuts, panels)       │
│ platform.ts — file dialogs/IO: browser (File System Access) | Tauri│
└───────────────┬──────────────────────────────┬────────────────────┘
                │                              │
   packages/doc-model                 packages/math-core
   (no DOM, no deps but fflate)       (MathJax lite adaptor — runs in Node too)
   • schema + validation/migration    • LaTeX → SVG / MathML
   • pure commands (add/move/…)       • MathML → OMML (own converter)
   • History (snapshot undo/redo)     • scene layout → SVG (canvas = export)
   • Editor store                     • .docx writer, Word clipboard HTML
   • .sci zip container               • PNG iTXt / SVG metadata (round-trip)
```

## Key decisions

- **One source of truth per equation: LaTeX.** Every other format (SVG, MathML, OMML, PNG) is derived.
  The LaTeX is embedded in exported PNG/SVG so images can be re-imported and edited.
- **Same renderer for screen and export.** `math-core/scene.ts` produces the SVG markup the canvas
  displays and the markup exporters write, so what you see is what you get.
- **Immutable documents + snapshot history.** Commands are pure functions; undo stores previous
  document references (structural sharing keeps it cheap). Continuous gestures (drag, typing,
  color picking) pass a `coalesce` key so they become a single undo step.
- **Own MathML → OMML converter** instead of Microsoft's `MML2OMML.XSL` (not redistributable).
  Word's HTML clipboard dialect differs from `.docx` OMML (old namespace, text directly in `<m:r>`);
  both forms are verified against Word 16.
- **Platform layer is tiny.** Only `platform.ts` knows about Tauri; the rest runs in any browser.

## Adding a new node type (Phase 2+)

1. Add the interface to `doc-model/src/types.ts` and a case in `normalizeNode` (validation).
2. Add layout/markup in `math-core/src/scene.ts` (`layoutNode`).
3. Add editing UI in `apps/desktop` and exporters as needed.
4. Bump `SCHEMA_VERSION` only if old files need migrating; add a step to `MIGRATIONS`.

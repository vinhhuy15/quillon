# SciForge

**An open-source toolkit for math and scientific figures**, for researchers, teachers and students.

> v0.1: the equation editor (Phase 0 + 1). Drawing, figure composition and data visualization are on the [roadmap](docs/ROADMAP.md).

## Features in v0.1

| | |
|---|---|
| **WYSIWYG equation editor** | Type math directly or type LaTeX (`\frac`, `\alpha`…); 11 symbol palettes (Greek, operators, relations, arrows, structures, sums & integrals, brackets, matrices, functions, chemistry, misc) |
| **Templates** | ~50 ready-made formulas: algebra, trigonometry, calculus, linear algebra, probability, physics, chemistry, with search |
| **Personal library** | Save the formulas you use often |
| **Canvas** | Many equations and text blocks on one page; select, drag, marquee select, zoom, pan, z-order, duplicate |
| **Undo / redo** | Unlimited within a session (drags and typing are merged into single steps) |
| **Equation numbering** | Automatic, in reading order |
| **`.sci` files** | Open format (ZIP + JSON), with autosave and crash recovery |
| **Word** | *Copy for Word* pastes a **native, editable Word equation**; `.docx` export |
| **Export** | PNG (96–1200 DPI, transparent background), SVG vector, LaTeX `.tex`, HTML + MathML, copy LaTeX / MathML |
| **Re-editable images** | Exported PNG/SVG files embed their source: drop or paste them back into SciForge to keep editing |
| **Localization** | English UI, with a Vietnamese translation |

## Getting started

Requires Node.js ≥ 20.

```bash
npm install
npm run dev        # opens http://localhost:1420
```

```bash
npm test           # unit tests (doc-model, math-core, palette content)
npm run typecheck
npm run build      # static web build in apps/desktop/dist
```

### Desktop app (Windows / macOS / Linux)

Additionally requires [Rust](https://rustup.rs) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
(on Windows: *Microsoft C++ Build Tools* + WebView2, which ships with Windows 11).

```bash
npm run tauri dev      # desktop window with hot reload
npm run tauri build    # installers: .msi/.exe (Windows), .dmg (macOS), .deb/.AppImage (Linux)
```

## Repository layout

```
packages/doc-model   Document model: schema, pure commands, undo/redo, .sci files
packages/math-core   LaTeX → SVG/MathML (MathJax), MathML → OMML (Word), .docx, PNG/SVG metadata
apps/desktop         React + MathLive app; src-tauri/ is the Tauri 2 desktop shell
docs/                Architecture, file format, roadmap
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/FILE_FORMAT.md](docs/FILE_FORMAT.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions of every kind are welcome: code, symbol sets, templates, translations.

## License

[Apache-2.0](LICENSE). Third-party libraries: MathJax (Apache-2.0), MathLive (MIT), fflate (MIT), React (MIT), Tauri (Apache-2.0/MIT).

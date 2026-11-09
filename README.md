# SciForge

**An open-source toolkit for equations and scientific figures**, for researchers, teachers and students.

> v0.2: equation editor plus drawing, diagrams and function plots (Phases 0–2).
> Figure composition, data charts and more are on the [roadmap](docs/ROADMAP.md).

## Features

### Equations
| | |
|---|---|
| **WYSIWYG editor** | Type math directly or type LaTeX (`\frac`, `\alpha`…); 11 symbol palettes (Greek, operators, relations, arrows, structures, sums & integrals, brackets, matrices, functions, chemistry, misc) |
| **Templates** | ~50 ready-made formulas: algebra, trigonometry, calculus, linear algebra, probability, physics, chemistry, with search |
| **Library** | Save the formulas you use often |
| **Numbering** | Automatic equation numbers in reading order |
| **Word** | *Copy for Word* pastes a **native, editable Word equation** |

### Drawing and diagrams (new in 0.2)
| | |
|---|---|
| **Shapes** | Rectangle, rounded rectangle, ellipse, diamond, terminator, parallelogram, triangle, hexagon; fill, stroke, dash, rotation, labels with inline math |
| **Lines & connectors** | Straight, elbow and curved lines with arrow heads; ends attach to shapes and follow them when they move; labels |
| **Flowcharts** | Shapes + elbow connectors, with typical meanings in the shape picker |
| **Symbol library** | 45 symbols: circuits (resistors, capacitors, sources, meters, diodes, op-amp…), mechanics (springs, masses, pulleys, supports, inclines…), optics (lenses, mirrors, prism), lab glassware. Wires snap to the terminals of circuit symbols |
| **Function plots** | y = f(x), parametric and polar curves; textbook (axes through the origin) or framed (paper) style; grid, legend, axis labels with math. Formulas are typed the way you write them: `2x^2 - 3x + 1`, `sin x`, `e^(-x^2)`, `|x|` |
| **Text with math** | `Speed $v = \frac{d}{t}$ in m/s`: inline math anywhere text appears |
| **Editing** | Resize and rotate handles, Shift for squares and 15° angles, snap to grid, align & distribute, group, lock, z-order, context menu, drag-and-drop from the panel |

### Files and export
| | |
|---|---|
| **`.sci` files** | Open format (ZIP + JSON), autosave and crash recovery |
| **PNG / SVG** | 96–1200 DPI, transparent background; exported images embed their source, so dropping them back into SciForge makes them editable again |
| **TikZ** | Standalone TikZ picture (compiles with pdflatex) for LaTeX papers; Copy TikZ for pasting into an existing document |
| **LaTeX** | `.tex` document with equations, text and TikZ figures |
| **Word** | `.docx` with native equations; drawings become embedded pictures |
| **HTML** | MathML equations and inline SVG figures |
| **Localization** | English UI, with a Vietnamese translation |

## Getting started

Requires Node.js ≥ 20.

```bash
npm install
npm run dev        # opens http://localhost:1420
```

```bash
npm test           # unit tests
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
packages/doc-model     Document model: schema, pure commands, undo/redo, .sci files
packages/math-core     LaTeX → SVG/MathML (MathJax), MathML → OMML (Word), .docx, PNG/SVG metadata
packages/figure-core   Scene layout for every node type, shapes, connectors, symbols, plots, TikZ export
apps/desktop           React + MathLive app; src-tauri/ is the Tauri 2 desktop shell
docs/                  Architecture, file format, roadmap
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/FILE_FORMAT.md](docs/FILE_FORMAT.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions of every kind are welcome: code, symbols, templates, translations.

## License

[Apache-2.0](LICENSE). Third-party libraries: MathJax (Apache-2.0), MathLive (MIT), fflate (MIT), React (MIT), Tauri (Apache-2.0/MIT).

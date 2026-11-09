# Roadmap

| Phase | Scope | Status |
|---|---|---|
| **0. Foundation** | Monorepo, Tauri shell, doc-model, canvas (select/drag/zoom), undo/redo, `.sci`, CI | ✅ v0.1 |
| **1. Math editor** | WYSIWYG + LaTeX input, palettes, templates, library, numbering; export LaTeX/MathML/SVG/PNG/DOCX, copy to Word as native equations | ✅ v0.1 |
| **2. Drawing & plots** | Shapes, paths, text with inline math, function plots, circuit/mechanics symbol libraries, flowcharts, TikZ export | next |
| **3. Geometry & 3D** | Constraint-based geometry kernel, basic 3D | |
| **4. Figures & images** | Figure composer, journal presets, scale bars, insets, image adjustments, color-blind check | |
| **5. Data** | Chart builder, curve fitting, plot digitizer | |
| **6. Ecosystem** | Plugin API, math OCR, symbolic calculator (SymPy), Office add-in, BibTeX, AI assistant | |

## Known gaps in v0.1

- Opening a `.sci` file by double-clicking it in Explorer (file association is declared, argv handling is not wired yet).
- `\begin{aligned}` exports to Word as an equation array without `&` alignment points.
- Plain-text MathML paste into Word relies on Word's own MathML detection; the HTML (OMML) clipboard path is the primary one.
- No dark theme yet.

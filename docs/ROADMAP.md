# Roadmap

| Phase | Scope | Status |
|---|---|---|
| **0. Foundation** | Monorepo, Tauri shell, doc-model, canvas (select/drag/zoom), undo/redo, document files, CI | ✅ v0.1 |
| **1. Math editor** | WYSIWYG + LaTeX input, palettes, templates, library, numbering; export LaTeX/MathML/SVG/PNG/DOCX, copy to Word as native equations | ✅ v0.1 |
| **2. Drawing & plots** | Shapes, lines/connectors, text with inline math, function plots (y = f(x), parametric, polar), circuit/mechanics/optics/lab symbol libraries, flowcharts, TikZ export | ✅ v0.2 |
| **Identity** | Renamed SciForge → Quillon: logo, app icon, design tokens, start card, `.qln` files (old files still open) | ✅ v0.3 |
| **4. Figures & images** | Embedded images with crop and adjustments, scale bars, linked insets, figure layout with panel labels, journal column sizes for PNG/SVG, color-vision simulation | ✅ v0.4 |
| **3. Geometry & 3D** | Constraint-based geometry kernel (points, lines, circles, constructions), basic 3D | ⏸ on hold |
| **5. Data** | Chart builder, curve fitting, plot digitizer | |
| **6. Ecosystem** | Plugin API, math OCR, symbolic calculator (SymPy), Office add-in, BibTeX, AI assistant | |

Phase 3 was moved behind Phase 4: geometry and 3D are a large piece of work, and we first want to hear
from users whether they need it. Comments and votes on the roadmap issue are welcome.

## Known gaps in v0.4

- Opening a `.qln` file by double-clicking it in Explorer (file association is declared, argv handling is not wired yet).
- `\begin{aligned}` exports to Word as an equation array without `&` alignment points.
- Shapes and connectors export to Word as pictures, not as editable Word shapes.
- Plots sample functions numerically; implicit curves (`x^2 + y^2 = 1`), data points and log axes are planned for Phase 5.
- No smart alignment guides yet (snap to grid and Align/Distribute are available).
- No dark theme yet.
- Images are cropped with numeric fields in the Properties panel; there is no on-canvas crop handle yet.
- TIFF and HEIC images cannot be inserted (browsers cannot decode them); convert them to PNG first.
- TikZ export refers to images by file name; the images themselves are not written next to the `.tex` file,
  and color adjustments are not carried over.
- Images are stored inside the document, so documents with many large photos get big.

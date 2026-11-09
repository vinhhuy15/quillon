# `.qln` file format (v3)

A `.qln` file is a ZIP archive. Files from SciForge (Quillon's name up to 0.2) use the `.sci` extension,
the `sciforge/document` schema id and the `application/x-sciforge` mimetype; Quillon reads them unchanged.

| Entry | Content |
|---|---|
| `mimetype` | `application/x-quillon` (stored, uncompressed, first) |
| `document.json` | The document (below) |
| `preview.svg` | Optional preview of the whole page |

Readers also accept a bare `document.json`.

```jsonc
{
  "schema": "quillon/document",
  "version": 3,
  "meta": { "title": "…", "created": "ISO-8601", "modified": "ISO-8601", "generator": "Quillon 0.4.0" },
  "settings": { "defaultFontSize": 28, "defaultColor": "#1f2937" },
  "nodes": [                      // array order = z-order (first is bottom)
    { "id": "m_…", "type": "math", "x": 100, "y": 80,
      "latex": "E=mc^2", "fontSize": 28, "color": "#1f2937", "display": true, "numbered": false },
    { "id": "t_…", "type": "text", "x": 100, "y": 160,
      "text": "Note", "fontSize": 20, "color": "#1f2937", "fontFamily": "…", "bold": false, "italic": false }
  ]
}
```

Coordinates are CSS pixels at 100 % zoom. Unknown node types are skipped on load (forward compatibility);
files with a higher `version` are rejected with a clear message. Version 1 and 2 files (Quillon 0.1–0.3) open unchanged.

## Node types added in v2

Every node may carry `"locked": true` and `"group": "g_…"` (nodes in the same group are selected together).

```jsonc
{ "type": "shape", "shape": "rect|roundrect|ellipse|diamond|triangle|parallelogram|hexagon|stadium",
  "x": 0, "y": 0, "width": 120, "height": 80, "rotation": 0,          // degrees clockwise, around the center
  "stroke": "#1f2937", "strokeWidth": 1.5, "dash": "solid|dashed|dotted", "fill": "none",
  "label": "Start $x_0$", "labelSize": 16, "labelColor": "#1f2937" }

{ "type": "line", "x": 10, "y": 20,                                   // = first point
  "points": [{ "x": 0, "y": 0 }, { "x": 120, "y": 40 }],              // relative to (x, y)
  "routing": "straight|elbow|curve", "startCap": "none", "endCap": "arrow|open|dot|bar|none",
  "stroke": "#1f2937", "strokeWidth": 1.5, "dash": "solid",
  "start": { "node": "s_…" }, "end": { "node": "y_…", "port": "a" },   // optional attachments
  "label": "yes" }

{ "type": "plot", "x": 0, "y": 0, "width": 360, "height": 260,
  "xMin": -6.5, "xMax": 6.5, "yMin": -2, "yMax": 2, "axes": "cross|box", "grid": true, "legend": false,
  "xLabel": "$x$", "yLabel": "$y$", "fontSize": 13,
  "functions": [
    { "id": "f_…", "kind": "y", "expr": "sin(x)", "color": "#2563eb", "width": 2, "dash": "solid", "label": "$\\sin x$" },
    { "id": "f_…", "kind": "param", "expr": "cos(t)", "expr2": "sin(t)", "tMin": 0, "tMax": 6.283 },
    { "id": "f_…", "kind": "polar", "expr": "1 + cos(t)", "tMin": 0, "tMax": 6.283 }
  ] }

{ "type": "symbol", "symbol": "circuit.resistor", "x": 0, "y": 0, "width": 80, "height": 24,
  "rotation": 90, "flip": false, "stroke": "#1f2937", "strokeWidth": 1.5, "fill": "none",
  "label": "$R_1$", "labelSize": 14 }
```

Text nodes may contain `$…$` for inline math (`\$` for a literal dollar sign) and an optional `"align": "center|right"`.
Line end points are always stored resolved, so a reader that ignores `start`/`end` still draws connectors correctly.

## Node type added in v3 (Quillon 0.4)

```jsonc
{ "type": "image", "x": 0, "y": 0, "width": 400, "height": 300,      // displayed size of the visible region
  "src": "data:image/png;base64,…",                                   // embedded; only data:image/… URLs are accepted
  "name": "cells.png", "naturalWidth": 800, "naturalHeight": 600,
  "crop": { "x": 0.25, "y": 0, "width": 0.5, "height": 1 },           // optional, fractions of the natural size
  "brightness": 100, "contrast": 100, "saturation": 100,             // percent, 100 = unchanged
  "grayscale": true, "invert": true,                                  // optional
  "opacity": 1, "border": "none", "borderWidth": 1,
  "scaleBar": { "unitsPerPixel": 0.25, "length": 50, "unit": "µm",   // unitsPerPixel: size of one natural pixel
                "position": "br", "color": "#ffffff", "showLabel": true },
  "inset": { "source": "i_…", "marker": "s_…" } }                     // optional: zoomed copy of another image
```

For an inset, `marker` is an ordinary shape node; the app keeps it over the region of `source` that the inset's
`crop` shows. Text nodes may carry `"panelLabel": true` when Figure layout created them.
v2 documents open unchanged.

## Embedded source in exported images

- **PNG**: an `iTXt` chunk with keyword `quillon` holding
  `{"app":"quillon","v":1,"latex":"…","display":true,"fontSize":28,"color":"#…"}`;
  multi-object exports use keyword `quillon-nodes` with a fragment document (same JSON as above).
- **SVG**: `<metadata><quillon:source xmlns:quillon="https://quillon.app/ns/source/1">{…}</quillon:source></metadata>`
  (or `quillon:nodes` for multiple objects).

# `.sci` file format (v2)

A `.sci` file is a ZIP archive:

| Entry | Content |
|---|---|
| `mimetype` | `application/x-sciforge` (stored, uncompressed, first) |
| `document.json` | The document (below) |
| `preview.svg` | Optional preview of the whole page |

Readers also accept a bare `document.json`.

```jsonc
{
  "schema": "sciforge/document",
  "version": 2,
  "meta": { "title": "…", "created": "ISO-8601", "modified": "ISO-8601", "generator": "SciForge 0.2.0" },
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
files with a higher `version` are rejected with a clear message. Version 1 files (SciForge 0.1) open unchanged.

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

## Embedded source in exported images

- **PNG**: an `iTXt` chunk with keyword `sciforge` holding
  `{"app":"sciforge","v":1,"latex":"…","display":true,"fontSize":28,"color":"#…"}`;
  multi-object exports use keyword `sciforge-nodes` with a fragment document (same JSON as above).
- **SVG**: `<metadata><sciforge:source xmlns:sciforge="https://sciforge.dev/ns/source/1">{…}</sciforge:source></metadata>`
  (or `sciforge:nodes` for multiple objects).

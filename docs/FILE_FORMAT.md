# `.sci` file format (v1)

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
  "version": 1,
  "meta": { "title": "…", "created": "ISO-8601", "modified": "ISO-8601", "generator": "SciForge 0.1.0" },
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
files with a higher `version` are rejected with a clear message.

## Embedded source in exported images

- **PNG**: an `iTXt` chunk with keyword `sciforge` holding
  `{"app":"sciforge","v":1,"latex":"…","display":true,"fontSize":28,"color":"#…"}`;
  multi-object exports use keyword `sciforge-nodes` with a fragment document (same JSON as above).
- **SVG**: `<metadata><sciforge:source xmlns:sciforge="https://sciforge.dev/ns/source/1">{…}</sciforge:source></metadata>`
  (or `sciforge:nodes` for multiple objects).

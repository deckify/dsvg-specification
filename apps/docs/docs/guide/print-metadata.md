---
sidebar_position: 5
title: Print metadata
---

# Print metadata

Root `<svg>` may declare optional print production metadata: trim size, bleed, safe area, corner radius, and dpi.

Native SVG `width` / `height` / `viewBox` are the **bleed-box artboard** in user units. Finished cut size is `data-dsvg-trim-width` / `data-dsvg-trim-height`.

## Attributes

| Attribute                              | Notes                              |
| -------------------------------------- | ---------------------------------- |
| `data-dsvg-print-units`                | `px` (default), `mm`, or `in`      |
| `data-dsvg-trim-width` / `trim-height` | Paired finished size               |
| `data-dsvg-bleed` (+ TRBL sides)       | Canvas edge → trim                 |
| `data-dsvg-safe-area` (+ TRBL sides)   | Trim → content-safe (meta only)    |
| `data-dsvg-corner-radius`              | Trim corner radius                 |
| `data-dsvg-dpi`                        | Optional raster intent; no default |

## Print vs preview

```ts
import { compileDsvg } from '@deckify/dsvg';

// Full bleed canvas (default)
await compileDsvg(source, { outputMode: 'print', keepMeta: true });

// Crop bleed + clip rounded corners
await compileDsvg(source, { outputMode: 'preview' });
```

- **`print`** — keep full artboard; no crop/clip
- **`preview`** — map trim via artboard ÷ (trim + bleed), set viewBox to trim, clip when `corner-radius` > 0
- **`keepMeta`** — when stripping, preserve print metadata attrs (useful for print pipelines)

See also [`examples/print-card.dsvg`](https://github.com/deckify/dsvg-specification/blob/main/examples/print-card.dsvg) and the normative [specification](/spec/overview).

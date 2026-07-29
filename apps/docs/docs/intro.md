---
slug: /
sidebar_position: 1
title: Introduction
---

# Dynamic SVG (DSVG)

**DSVG** is an SVG-compatible document format for dynamic graphics. It adds:

1. **Yoga flexbox layout** on SVG `<g>` groups
2. **Mustache variable interpolation** in attributes and text
3. **Deterministic OpenType text measurement** for flex `<text>` children

A DSVG file remains valid SVG/XML. A compiler resolves templates, measures text from supplied fonts, applies layout, and emits ordinary static SVG.

## Current version

- Specification: **0.1** (draft)
- TypeScript package: [`@deckify/dsvg`](https://www.npmjs.com/package/@deckify/dsvg) `0.1.0` (ESM-only)
- License: [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Minimal example

```xml
<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="300" height="100">
  <g
    data-dsvg-layout="flex"
    data-dsvg-gap="16"
    data-dsvg-width="300"
    data-dsvg-height="100"
  >
    <rect width="40" height="40" fill="{{accent}}" />
    <rect width="40" height="40" fill="#33cc66" />
  </g>
</svg>
```

```ts
import { compileDsvg } from '@deckify/dsvg';

const { svg } = await compileDsvg(source, {
  variables: { accent: '#3366ff' },
});
```

Compiled output:

<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100" role="img" aria-label="Two colored squares in a row with a gap">
  <rect width="40" height="40" fill="#3366ff" x="0" y="0" />
  <rect width="40" height="40" fill="#33cc66" x="56" y="0" />
</svg>

## Next steps

- [File extensions](./guide/file-extensions.md)
- [Layout attributes](./guide/layout.md)
- [Templating](./guide/templating.md)
- [TypeScript](./implementations/typescript.md)

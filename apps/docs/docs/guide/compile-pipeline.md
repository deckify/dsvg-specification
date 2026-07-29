---
sidebar_position: 4
title: Compile pipeline
---

# Compile pipeline

```text
parse XML
  → validate DSVG structure
  → resolve Mustache variables
  → validate resolved typed values
  → measure flex `<text>` with supplied OpenType fonts
  → apply Yoga layout (deepest-first)
  → remove data-dsvg-* attributes (default)
  → serialize SVG
```

`compileDsvg` runs the full pipeline and does not mutate the caller-provided source string or AST.

```ts
import { compileDsvg } from '@deckify/dsvg';

const { svg, document } = await compileDsvg(source, {
  variables: { name: 'Alice', width: 120 },
  fonts: [{ name: 'Inter', data: interRegular }],
  textMeasurement: 'font',
  strictMissing: true,
  stripDsvgAttributes: true,
});
```

Pass `textMeasurement: 'skip'` to disable intrinsic text measurement when fonts are unavailable.

For a full TypeScript walkthrough (Node `readFileSync`, browser `fetch`, weight matching, and errors), see [TypeScript](../implementations/typescript.md).

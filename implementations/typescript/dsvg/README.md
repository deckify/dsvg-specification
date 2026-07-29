# `@deckify/dsvg`

TypeScript reference implementation of **Dynamic SVG (DSVG) 0.1**.

DSVG extends SVG with:

- Yoga flexbox layout on `<g>` via `data-dsvg-*` attributes
- Mustache variable interpolation in attributes and text
- Deterministic OpenType text measurement for flex `<text>` children

Source files use `.dsvg` or `.d.svg`. Compilation emits ordinary `.svg`.

## Install

```bash
pnpm add @deckify/dsvg
```

## Quick start

```ts
import { compileDsvg } from '@deckify/dsvg';
import { readFileSync } from 'node:fs';

const interRegular = readFileSync('./fonts/Inter-Regular.ttf');

const { svg } = await compileDsvg(source, {
  variables: { title: 'Hello DSVG' },
  fonts: [
    {
      name: 'Inter',
      data: interRegular,
      weight: 400,
      style: 'normal',
    },
  ],
});
```

Flex `<text>` needs matching `fonts` entries for `font-family` / `font-weight` / `font-style`. Pass `textMeasurement: 'skip'` to keep legacy `0 × 0` sizing when fonts are unavailable.

## Text in flex layout

1. Place `<text>` inside a flex `<g>`.
2. Supply OpenType/TTF/WOFF bytes in `fonts`.
3. Match `FontOptions.name` to the SVG `font-family`.
4. Compiler normalizes whitespace, measures glyphs, then sets baseline `x` / `y`.

```ts
await compileDsvg(source, {
  fonts: [
    { name: 'Inter', data: interRegular, weight: 400 },
    { name: 'Inter', data: interBold, weight: 700 },
  ],
});
```

## API

| Function                                        | Purpose                          |
| ----------------------------------------------- | -------------------------------- |
| `parseDsvg(source)`                             | Parse XML into an AST            |
| `serializeDsvg(document)`                       | Serialize AST to XML             |
| `validateDsvg(document)`                        | Structural + semantic validation |
| `renderTemplate(document, variables, options?)` | Resolve Mustache variables       |
| `applyYogaLayout(document, options?)`           | Apply flex layout                |
| `compileDsvg(source, options?)`                 | Full pipeline                    |
| `createFontMeasurer(fonts)`                     | Build an OpenType text measurer  |
| `isDsvgFilename(name)`                          | Recognize `.dsvg` / `.d.svg`     |

Supported specification version: **0.1** (`DSVG_SPEC_VERSION`).

This package is **ESM-only** (`import` / dynamic `import()`). CommonJS `require()` is not supported because `yoga-layout` is an ESM module with top-level await.

## Security

`{{{name}}}` / `{{& name}}` inject raw markup. Sanitize untrusted variable values before compilation. Attribute interpolation of untrusted input is unsafe.

## Spec and examples

- Normative spec: [`../../../spec/dsvg-0.1.md`](../../../spec/dsvg-0.1.md)
- AST schema: [`../../../schema/dsvg-0.1.schema.json`](../../../schema/dsvg-0.1.schema.json)
- Fixtures: [`../../../examples/`](../../../examples/)

## License

Apache License 2.0. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

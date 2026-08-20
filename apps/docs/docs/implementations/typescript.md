---
sidebar_position: 1
title: TypeScript
---

# `@deckify/dsvg`

```bash
pnpm add @deckify/dsvg
```

The TypeScript package is the reference compiler for DSVG 0.1. It parses, validates, templates, measures flex `<text>` with supplied OpenType fonts, applies Yoga layout, and emits static SVG.

`@deckify/dsvg` is **ESM-only**. Use `import` / dynamic `import()` — CommonJS `require()` is not supported.

## Quick start

```ts
import { compileDsvg } from '@deckify/dsvg';
import { readFileSync } from 'node:fs';

const interRegular = readFileSync('./fonts/Inter-Regular.ttf');

const source = `
<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="400" height="120">
  <g
    data-dsvg-layout="flex"
    data-dsvg-justify-content="center"
    data-dsvg-align-items="center"
    data-dsvg-gap="16"
    data-dsvg-width="400"
    data-dsvg-height="120"
  >
    <circle r="24" fill="#3366ff" />
    <text font-family="Inter" font-size="24" fill="#111">{{title}}</text>
  </g>
</svg>
`;

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

In the browser, load font bytes with `fetch(url).then((response) => response.arrayBuffer())` instead of `readFileSync`.

## Text in flex layout

Flex `<text>` children are sized from **supplied font files**, not Canvas or installed system fonts.

1. Put `<text>` inside a `data-dsvg-layout="flex"` group.
2. Set SVG typography attributes: `font-family`, `font-size`, optional `font-weight` / `font-style`.
3. Pass matching faces in `fonts`. The `name` must match `font-family`.
4. After templating, DSVG normalizes flex text whitespace (collapse + trim), then measures advance width and ascender/descender height.
5. Layout writes `x` / `y` using the font baseline. Output stays SVG `<text>` (glyphs are not converted to paths).

```ts
await compileDsvg(source, {
  fonts: [
    { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
    { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
  ],
});
```

### Overrides and skip mode

| Need                            | Approach                                                             |
| ------------------------------- | -------------------------------------------------------------------- |
| Fixed box                       | Set `data-dsvg-width` / `data-dsvg-height` on the `<text>`           |
| No fonts available              | Pass `textMeasurement: 'skip'` (legacy `0 × 0` unless explicit dims) |
| Missing face for intrinsic text | Throws `TEXT_MEASUREMENT_REQUIRED`                                   |

```ts
await compileDsvg(source, {
  textMeasurement: 'skip',
});
```

0.1 scope: single-line text only. Multi-line wrap, kerning, ligatures, and RTL are out of scope.

## Exports

| Symbol                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `parseDsvg`             | Parse XML string → AST                           |
| `serializeDsvg`         | AST → XML string                                 |
| `validateDsvg`          | Return `{ ok: true }` or `{ ok: false, errors }` |
| `renderTemplate`        | Resolve Mustache variables                       |
| `applyYogaLayout`       | Apply flex layout (`fonts` / `textMeasurement`)  |
| `compileDsvg`           | Full compile pipeline                            |
| `compileDsvgDocument`   | Compile from an existing AST                     |
| `readPrintMeta`         | Resolve root print metadata                      |
| `resolveTrimRect`       | Map trim/bleed into user-space coordinates       |
| `applyPreviewOutput`    | Crop bleed and clip corners                      |
| `createFontMeasurer`    | Build an OpenType text measurer                  |
| `isDsvgFilename`        | Recognize `.dsvg` / `.d.svg`                     |
| `toCompiledSvgFilename` | Map source filename → `.svg`                     |
| `DSVG_SPEC_VERSION`     | `"0.1"`                                          |
| `DsvgCompileError`      | Thrown on compile/template failures              |

## Compile options

```ts
type CompileOptions = {
  variables?: Record<string, unknown>;
  strictMissing?: boolean;
  stripDsvgAttributes?: boolean;
  keepMeta?: boolean; // preserve print metadata when stripping
  outputMode?: 'print' | 'preview'; // default: 'print'
  fonts?: FontOptions[];
  textMeasurement?: 'font' | 'skip'; // default: 'font'
};

type FontOptions = {
  name: string;
  data: ArrayBuffer | Uint8Array;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 'normal' | 'bold';
  style?: 'normal' | 'italic';
};
```

`outputMode: 'preview'` crops to trim and clips rounded corners. See [Print metadata](/guide/print-metadata).

`applyYogaLayout(document, { fonts, textMeasurement })` accepts the same font options when you run layout alone.

## Errors

```ts
type DsvgError = {
  code: DsvgErrorCode;
  message: string;
  path?: string;
};
```

`DsvgCompileError.errors` contains the full batch when multiple issues are found.

| Code                        | When                                                            |
| --------------------------- | --------------------------------------------------------------- |
| `PARSE_ERROR`               | XML/SVG source failed to parse                                  |
| `INVALID_ROOT`              | Document root is missing or not `<svg>`                         |
| `UNSUPPORTED_VERSION`       | `data-dsvg-version` is missing or not `0.1`                     |
| `INVALID_ATTRIBUTE`         | Unknown or misplaced `data-dsvg-*` attribute                    |
| `INVALID_VALUE`             | Attribute value fails validation (keyword, number, or token)    |
| `UNSUPPORTED_MUSTACHE`      | Unsupported Mustache feature (`{{#`, `{{^`, `{{/`, `{{>`)       |
| `MISSING_VARIABLE`          | Required template variable is absent (strict mode)              |
| `INVALID_VARIABLE_TYPE`     | Template variable resolved to a non-primitive value             |
| `LAYOUT_ERROR`              | Yoga layout failed unexpectedly                                 |
| `TEXT_MEASUREMENT_REQUIRED` | Intrinsic flex text needs fonts, but none match / none provided |
| `TEXT_MEASUREMENT_FAILED`   | Font parse or glyph measurement failed                          |
| `INVALID_PRINT_PREVIEW`     | Preview crop failed (missing trim, artboard size, or bleed box) |

## Try it

Use the [Playground](/playground) to compile flex text with the bundled Inter faces in the browser.

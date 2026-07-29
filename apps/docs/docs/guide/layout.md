---
sidebar_position: 2
title: Layout
---

# Yoga flexbox layout

Enable flex layout on a `<g>` with `data-dsvg-layout="flex"`. Nested flex groups compile deepest-first.

## Container attributes

| Attribute                              | Values                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `data-dsvg-flex-direction`             | `row`, `column`, `row-reverse`, `column-reverse`                                    |
| `data-dsvg-flex-wrap`                  | `nowrap`, `wrap`, `wrap-reverse`                                                    |
| `data-dsvg-justify-content`            | `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` |
| `data-dsvg-align-items`                | `flex-start`, `center`, `flex-end`, `stretch`, `baseline`                           |
| `data-dsvg-align-content`              | `flex-start`, `center`, `flex-end`, `stretch`, `space-between`, `space-around`      |
| `data-dsvg-gap`                        | finite number                                                                       |
| `data-dsvg-row-gap`                    | finite number                                                                       |
| `data-dsvg-column-gap`                 | finite number                                                                       |
| `data-dsvg-padding` (+ edges)          | finite number                                                                       |
| `data-dsvg-width` / `data-dsvg-height` | finite number                                                                       |

## Child attributes

| Attribute                              | Values                                                            |
| -------------------------------------- | ----------------------------------------------------------------- |
| `data-dsvg-flex-grow`                  | finite number ≥ 0                                                 |
| `data-dsvg-flex-shrink`                | finite number ≥ 0                                                 |
| `data-dsvg-flex-basis`                 | finite number or `auto`                                           |
| `data-dsvg-align-self`                 | `auto`, `flex-start`, `center`, `flex-end`, `stretch`, `baseline` |
| `data-dsvg-width` / `data-dsvg-height` | finite number                                                     |

Unsupported keywords and non-finite numbers fail validation instead of being silently coerced.

Layout results compose a generated `translate` / `scale` ahead of any existing `transform`, or update native geometry for simple shapes without a prior transform. Flex `<text>` children are positioned with `x` / `y` using the font baseline and are not scaled.

## Text measurement

Flex `<text>` children participate in layout. Size them with **supplied OpenType fonts** (TTF/OTF/WOFF), not Canvas or installed system fonts.

```xml
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
```

```ts
import { compileDsvg } from '@deckify/dsvg';

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

| Option                    | Behavior                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| `fonts`                   | Font faces matched against SVG `font-family` / `font-weight` / `font-style` |
| `textMeasurement: 'font'` | Default. Measure with supplied fonts                                        |
| `textMeasurement: 'skip'` | Keep legacy `0 × 0` unless `data-dsvg-width` / `data-dsvg-height` are set   |

Missing matching fonts for intrinsic text sizing fail with `TEXT_MEASUREMENT_REQUIRED`. DSVG 0.1 measures single-line text only and normalizes flex `<text>` whitespace (collapse + trim) before measuring.

See [TypeScript](../implementations/typescript.md) for Node/browser loading examples.

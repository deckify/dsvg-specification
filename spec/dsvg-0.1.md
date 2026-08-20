# Dynamic SVG (DSVG) Specification 0.1

**Status:** Draft  
**Version:** `0.1`  
**MIME type:** `image/svg+xml`

## 1. Abstract

Dynamic SVG (DSVG) is an SVG-compatible document format that adds:

1. **Yoga flexbox layout** on SVG `<g>` groups via `data-dsvg-*` attributes
2. **Mustache variable interpolation** in text nodes and attribute values
3. **Optional print metadata** on the root `<svg>` (trim, bleed, safe area, corner radius) with print and preview compile output

A DSVG document remains valid SVG/XML. Generic SVG software may open it and ignore unrecognized attributes. A DSVG compiler resolves templates, applies layout, and emits ordinary static SVG.

## 2. Conformance

An implementation conforming to DSVG 0.1 MUST:

- Accept documents declaring `data-dsvg-version="0.1"` on the root `<svg>`
- Recognize source filenames ending in `.dsvg` or `.d.svg`
- Implement the compile pipeline defined in §7
- Reject unsupported attribute values rather than silently coercing them
- Not mutate caller-provided AST input during compilation

## 3. File extensions and media

| Role            | Extension | Notes                                                                                   |
| --------------- | --------- | --------------------------------------------------------------------------------------- |
| Dynamic source  | `.dsvg`   | Preferred when unresolved templates or unapplied layout would confuse generic SVG tools |
| Dynamic source  | `.d.svg`  | Preferred when baked geometry/content provides a useful static preview                  |
| Compiled output | `.svg`    | Ordinary static SVG after compilation                                                   |

Both `.dsvg` and `.d.svg` use the same document model. When serving either for rendering, use `image/svg+xml`. Servers may need an explicit MIME mapping for `.dsvg`.

Implementations SHOULD expose helpers that recognize `.dsvg` and `.d.svg` and MUST NOT treat every `.svg` as DSVG.

## 4. Document model

### 4.1 Root requirements

The root element MUST be `<svg>` and SHOULD declare:

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  data-dsvg-version="0.1"
  width="800"
  height="600"
  viewBox="0 0 800 600"
>
```

`data-dsvg-version` MUST be present for a document to be treated as DSVG 0.1. Unknown major.minor versions MUST cause validation failure.

### 4.2 Attribute namespace

All DSVG control attributes use the `data-dsvg-` prefix. Implementations MUST strip these attributes from compiled output by default. When `keepMeta` is enabled, implementations MUST preserve §4.4 print metadata attributes while still stripping other `data-dsvg-*` attributes (including `data-dsvg-version` and layout attributes).

### 4.3 Fallback previews

Authors SHOULD leave baked SVG geometry and text content that remain useful before compilation. Compilers overwrite geometry and text as required by layout and templating.

### 4.4 Print metadata

Optional print production metadata MAY appear on the root `<svg>` only. These attributes describe finished size, bleed, safe area, corner radius, and raster intent. They do not participate in Yoga layout.

Native SVG `width` / `height` / `viewBox` describe the artboard in SVG user units and SHOULD represent the full **bleed box**. Finished trim size is declared separately in print units.

| Attribute                    | Values            | Notes                                                              |
| ---------------------------- | ----------------- | ------------------------------------------------------------------ |
| `data-dsvg-print-units`      | `px`, `mm`, `in`  | Optional; **default `px`** when any print metadata is present      |
| `data-dsvg-trim-width`       | finite number > 0 | Finished width in print units; MUST be paired with `trim-height`   |
| `data-dsvg-trim-height`      | finite number > 0 | Finished height in print units; MUST be paired with `trim-width`   |
| `data-dsvg-bleed`            | finite number ≥ 0 | Uniform bleed; side attributes override                            |
| `data-dsvg-bleed-top`        | finite number ≥ 0 | Per-side bleed (canvas edge → trim)                                |
| `data-dsvg-bleed-right`      | finite number ≥ 0 | Per-side bleed                                                     |
| `data-dsvg-bleed-bottom`     | finite number ≥ 0 | Per-side bleed                                                     |
| `data-dsvg-bleed-left`       | finite number ≥ 0 | Per-side bleed                                                     |
| `data-dsvg-safe-area`        | finite number ≥ 0 | Uniform safe inset from trim; side attributes override             |
| `data-dsvg-safe-area-top`    | finite number ≥ 0 | Per-side safe inset                                                |
| `data-dsvg-safe-area-right`  | finite number ≥ 0 | Per-side safe inset                                                |
| `data-dsvg-safe-area-bottom` | finite number ≥ 0 | Per-side safe inset                                                |
| `data-dsvg-safe-area-left`   | finite number ≥ 0 | Per-side safe inset                                                |
| `data-dsvg-corner-radius`    | finite number ≥ 0 | Finished (trim) corner radius; `0` = square cut                    |
| `data-dsvg-dpi`              | finite number > 0 | Optional rasterization intent; **no default** (omit = unspecified) |

**Semantics:**

1. Bleed is the inset from the bleed-box edge to the trim line.
2. Safe area is a further inset from the trim line to the content-safe region. It is metadata only and MUST NOT be applied as an additional crop in preview output.
3. Corner radius is the trim-corner radius. Print output MUST NOT clip to it; preview output MUST clip when the radius is greater than `0` (§7.3).
4. Trim width/height are the finished size after cutting.
5. `dpi` is production intent for downstream tools. Preview mapping MUST NOT use `dpi`.

When `print-units` is omitted and any other print metadata attribute is present, implementations MUST treat units as `px`. With `px`, print lengths align with SVG user units when the artboard matches the bleed box.

Side insets resolve like padding: a side attribute overrides the uniform value for that side; missing sides inherit the uniform value (default `0`).

Print metadata attributes MUST NOT appear on non-root elements.

## 5. Layout vocabulary

Layout applies only to `<g>` elements with `data-dsvg-layout="flex"`. Nested flex groups compile deepest-first.

### 5.1 Container attributes (`<g>`)

| Attribute                   | Values                                                                              | Default                |
| --------------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| `data-dsvg-layout`          | `flex`                                                                              | — (absent = no layout) |
| `data-dsvg-flex-direction`  | `row`, `column`, `row-reverse`, `column-reverse`                                    | `row`                  |
| `data-dsvg-flex-wrap`       | `nowrap`, `wrap`, `wrap-reverse`                                                    | `nowrap`               |
| `data-dsvg-justify-content` | `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` | `flex-start`           |
| `data-dsvg-align-items`     | `flex-start`, `center`, `flex-end`, `stretch`, `baseline`                           | `stretch`              |
| `data-dsvg-align-content`   | `flex-start`, `center`, `flex-end`, `stretch`, `space-between`, `space-around`      | `flex-start`           |
| `data-dsvg-gap`             | finite number                                                                       | `0`                    |
| `data-dsvg-row-gap`         | finite number                                                                       | inherits `gap`         |
| `data-dsvg-column-gap`      | finite number                                                                       | inherits `gap`         |
| `data-dsvg-padding`         | finite number                                                                       | `0`                    |
| `data-dsvg-padding-top`     | finite number                                                                       | inherits `padding`     |
| `data-dsvg-padding-right`   | finite number                                                                       | inherits `padding`     |
| `data-dsvg-padding-bottom`  | finite number                                                                       | inherits `padding`     |
| `data-dsvg-padding-left`    | finite number                                                                       | inherits `padding`     |
| `data-dsvg-width`           | finite number                                                                       | inferred (§5.3)        |
| `data-dsvg-height`          | finite number                                                                       | inferred (§5.3)        |

Numbers are unitless SVG user units. Non-finite values and unknown keywords MUST fail validation.

### 5.2 Child attributes (direct children of a flex `<g>`)

| Attribute               | Values                                                            | Default         |
| ----------------------- | ----------------------------------------------------------------- | --------------- |
| `data-dsvg-flex-grow`   | finite number ≥ 0                                                 | `0`             |
| `data-dsvg-flex-shrink` | finite number ≥ 0                                                 | `1`             |
| `data-dsvg-flex-basis`  | finite number, or `auto`                                          | `auto`          |
| `data-dsvg-align-self`  | `auto`, `flex-start`, `center`, `flex-end`, `stretch`, `baseline` | `auto`          |
| `data-dsvg-width`       | finite number                                                     | inferred (§5.3) |
| `data-dsvg-height`      | finite number                                                     | inferred (§5.3) |

### 5.3 Box model

1. Explicit `data-dsvg-width` / `data-dsvg-height` override inferred native dimensions.
2. Otherwise, infer from native SVG attributes when possible:
   - `rect`, `image`, `svg`: `width` / `height`
   - `ellipse`: `2 * rx`, `2 * ry`
   - `circle`: `2 * r`
   - `text`: OpenType metrics from supplied fonts (§5.4)
   - `g` with explicit `data-dsvg-width` / `data-dsvg-height`: those values
   - Fallback size: `0 × 0` when no dimension can be inferred
3. Container size uses `data-dsvg-width` / `data-dsvg-height`, else native `width` / `height` attributes on the group when present, else the parent flex item size when nested, else document `width` / `height`.
4. After Yoga computes layout, implementations apply results by composing a generated transform ahead of any existing `transform` attribute:

   ```
   transform="translate(left, top) scale(sx, sy) <existing-transform>"
   ```

   where `sx` / `sy` are `computedWidth / measuredWidth` (or `1` when measured width/height is `0`). Implementations MAY also update native `x`/`y`/`cx`/`cy`/`width`/`height` for simple shapes without a prior `transform` when that produces an equivalent result; when both paths are available, prefer transform composition for arbitrary children. For `<text>`, implementations SHOULD set `x` / `y` using the font baseline and MUST NOT scale glyph metrics via transform when preserving text content.

5. Nested flex groups MUST compile deepest-first.

### 5.4 Text measurement

Flex `<text>` children participate in layout after Mustache templating resolves.

1. Explicit `data-dsvg-width` / `data-dsvg-height` override measured axes.
2. Otherwise, implementations MUST measure text from **supplied OpenType font resources** (TTF, OTF, or WOFF) using glyph advance widths and font ascender/descender metrics. Measurement MUST be deterministic for the same font bytes and text attributes across runtimes.
3. Implementations MUST match `font-family`, `font-size`, `font-weight`, and `font-style` when selecting a loaded face. Missing matching fonts for intrinsic sizing MUST fail compilation unless the caller explicitly skips text measurement.
4. DSVG 0.1 text measurement covers single-line text content (including nested `<tspan>` text concatenated in document order). Before measuring, implementations MUST normalize flex `<text>` whitespace by converting newlines/tabs to spaces, collapsing consecutive spaces, and trimming leading/trailing whitespace. Multi-line wrapping, kerning, ligatures, and RTL shaping are out of scope.
5. Implementations MAY offer a skip mode that preserves the legacy `0 × 0` fallback when intrinsic text size is unavailable and no explicit dimensions are set.

## 6. Templating

DSVG 0.1 supports a **variable-only** Mustache subset in:

- Attribute values
- Text node content

### 6.1 Syntax

| Form         | Behavior                    |
| ------------ | --------------------------- |
| `{{name}}`   | Interpolate and XML-escape  |
| `{{{name}}}` | Interpolate raw (no escape) |
| `{{& name}}` | Interpolate raw (no escape) |

Names MAY use dotted paths (`label.title`). Lookup walks nested objects.

### 6.2 Unsupported Mustache features

Sections, inverted sections, partials, and lambdas MUST NOT be implemented in 0.1. Encountering `{{#`, `{{^`, `{{/`, or `{{>` MUST fail validation/compilation.

### 6.3 Missing variables

By default, missing variables MUST cause a compilation error. Implementations MAY offer a non-strict mode that substitutes an empty string, but strict mode is the default.

### 6.4 Value coercion

Resolved values are converted with `String(value)`. `null` and `undefined` are missing. Objects/arrays stringify via `JSON.stringify` only when explicitly requested by implementation options; default 0.1 behavior treats non-primitive values as errors.

## 7. Compile pipeline

```
parse XML
  → validate DSVG structure
  → resolve Mustache variables
  → validate resolved typed layout values
  → measure flex text with supplied fonts
  → apply Yoga layout (deepest-first)
  → apply print or preview output (§7.3)
  → remove data-dsvg-* attributes (default; keepMeta MAY preserve print metadata)
  → serialize SVG
```

Each step MUST be pure with respect to caller input (deep-clone before mutation).

### 7.1 Public operations (reference API shape)

| Operation         | Purpose                          |
| ----------------- | -------------------------------- |
| `parseDsvg`       | Parse XML string into AST        |
| `serializeDsvg`   | Serialize AST to XML string      |
| `validateDsvg`    | Structural + semantic validation |
| `renderTemplate`  | Resolve Mustache variables       |
| `applyYogaLayout` | Apply flex layout                |
| `compileDsvg`     | Full pipeline                    |

Compile/layout options SHOULD accept supplied font resources for §5.4 text measurement and MAY accept an explicit skip mode.

Compile options MUST accept:

| Option                | Values             | Default | Purpose                                                 |
| --------------------- | ------------------ | ------- | ------------------------------------------------------- |
| `outputMode`          | `print`, `preview` | `print` | Full bleed canvas vs trimmed preview (§7.3)             |
| `keepMeta`            | boolean            | `false` | When stripping, preserve §4.4 print metadata attributes |
| `stripDsvgAttributes` | boolean            | `true`  | Remove `data-dsvg-*` attributes from output             |

### 7.2 Errors

Errors MUST include a machine-readable `code`, human `message`, and optional `path` into the AST. Implementations SHOULD batch multiple validation errors when practical. Implementations that support §5.4 SHOULD emit distinct codes when fonts are required but missing and when font measurement fails. Preview mapping failures MUST use a distinct code (e.g. `INVALID_PRINT_PREVIEW`).

### 7.3 Print and preview output

After layout, compilers apply an output mode:

| Mode      | Behavior                                                                      |
| --------- | ----------------------------------------------------------------------------- |
| `print`   | Keep the full bleed-box artboard. Do not crop or clip to trim/corners.        |
| `preview` | Crop to the trim rectangle and clip rounded corners when `corner-radius` > 0. |

**User-space mapping** for preview (and for reading trim geometry) MUST use:

```
bleedBoxW = trimWidth + bleedLeft + bleedRight
bleedBoxH = trimHeight + bleedTop + bleedBottom
sx = svgWidth / bleedBoxW
sy = svgHeight / bleedBoxH
trimRect = { x: bleedLeft*sx, y: bleedTop*sy, w: trimWidth*sx, h: trimHeight*sy }
cornerR_user = cornerRadius * min(sx, sy)
```

where `svgWidth` / `svgHeight` are the root element's finite native `width` / `height` in user units, and trim/bleed/corner values are resolved print-unit lengths (§4.4). Documents SHOULD keep `sx` and `sy` equal (uniform scale).

Preview MUST fail compilation when trim width/height are missing or unpaired, when root `width`/`height` are missing or non-finite, or when bleed-box dimensions are not positive.

**Preview transform** MUST:

1. Resolve the trim rectangle in the current user space
2. Wrap existing root children in a group translated by `(-trimRect.x, -trimRect.y)`
3. Set root `viewBox="0 0 trimRect.w trimRect.h"` and `width` / `height` to those user sizes
4. When `cornerRadius > 0`, attach a rounded-rect clip path of size `trimRect.w` × `trimRect.h` with `rx`/`ry` = `cornerR_user` to the wrapper group

Safe-area MUST NOT affect preview cropping.

## 8. Examples

### 8.1 Flex row with gap

```xml
<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="300" height="100" viewBox="0 0 300 100">
  <g
    data-dsvg-layout="flex"
    data-dsvg-flex-direction="row"
    data-dsvg-justify-content="space-between"
    data-dsvg-align-items="center"
    data-dsvg-gap="16"
    data-dsvg-width="300"
    data-dsvg-height="100"
  >
    <rect width="40" height="40" fill="#3366ff" />
    <rect width="40" height="40" fill="#33cc66" />
    <rect width="40" height="40" fill="#ff6633" />
  </g>
</svg>
```

### 8.2 Template variables

```xml
<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="80" viewBox="0 0 200 80">
  <text x="10" y="40" font-size="16" fill="#111">Hello {{name}}</text>
  <rect x="10" y="50" width="{{width}}" height="12" fill="#3366ff" />
</svg>
```

With variables `{ "name": "Alice", "width": 120 }` this compiles to static text and `width="120"`.

### 8.3 Print metadata

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  data-dsvg-version="0.1"
  width="750"
  height="1050"
  viewBox="0 0 750 1050"
  data-dsvg-trim-width="690"
  data-dsvg-trim-height="990"
  data-dsvg-bleed="30"
  data-dsvg-safe-area="24"
  data-dsvg-corner-radius="24"
  data-dsvg-dpi="300"
>
  <rect width="750" height="1050" fill="#f5f5f5" />
  <rect x="30" y="30" width="690" height="990" fill="#ffffff" />
</svg>
```

Units default to `px`. `outputMode: "print"` keeps the full 750×1050 canvas. `outputMode: "preview"` crops to the 690×990 trim and clips corners with radius 24.

## 9. Versioning

- **Specification version** (`0.1`): document compatibility via `data-dsvg-version`
- **Implementation package versions**: independent semver per language (e.g. `@deckify/dsvg@0.1.0`)

Implementations MUST declare which specification versions they support.

## 10. Security considerations

Raw Mustache interpolation (`{{{...}}}` / `{{& ...}}`) can inject markup. Callers MUST sanitize untrusted variable values. Compilers SHOULD document that attribute interpolation of untrusted input is unsafe.

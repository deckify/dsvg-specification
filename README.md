# Dynamic SVG (DSVG)

DSVG is an SVG-compatible format for **dynamic** graphics:

- Yoga flexbox layout on `<g>` groups (`data-dsvg-*`)
- Mustache variable interpolation in attributes and text

Specification version: **0.1**

## Repository layout

```
spec/                         # Normative language-neutral specification
schema/                       # AST JSON Schema
examples/                     # .dsvg / .d.svg fixtures and compiled .svg
implementations/
  typescript/dsvg/            # @deckify/dsvg reference package
apps/
  docs/                       # Docs site → deckify.github.io/dsvg-standard
```

## File extensions

| Extension | Role                                                                      |
| --------- | ------------------------------------------------------------------------- |
| `.dsvg`   | Dynamic source (prefer when unresolved templates would confuse SVG tools) |
| `.d.svg`  | Dynamic source that remains useful as ordinary SVG preview                |
| `.svg`    | Compiled static output                                                    |

## Quick start (TypeScript)

```bash
pnpm install
pnpm --filter @deckify/dsvg test
pnpm --filter @deckify/dsvg build
```

```ts
import { compileDsvg } from '@deckify/dsvg';

const { svg } = await compileDsvg(source, {
  variables: { name: 'Alice', width: 120 },
  fonts: [{ name: 'Inter', data: interRegular }],
});
```

Pass `textMeasurement: 'skip'` when intrinsic flex text sizing should be disabled.

`@deckify/dsvg` is ESM-only (`import` / dynamic `import()`).

## Documentation site

```bash
pnpm --filter dsvg-docs start
pnpm --filter dsvg-docs build
```

Published at [https://deckify.github.io/dsvg-standard/](https://deckify.github.io/dsvg-standard/).

## Versioning and releases

- Spec compatibility is declared with `data-dsvg-version="0.1"`
- Package semver (`@deckify/dsvg@0.1.0`) is independent of the spec version
- Releases use [Changesets](https://github.com/changesets/changesets)

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).

## Contributing

See [`AGENTS.md`](./AGENTS.md) for coding conventions. Keep language-neutral assets out of implementation folders so other language packages can share the same fixtures and conformance suite.

Release process: [`apps/docs/docs/contributing/releases.md`](./apps/docs/docs/contributing/releases.md).

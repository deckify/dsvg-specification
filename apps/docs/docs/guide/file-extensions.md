---
sidebar_position: 1
title: File extensions
---

# File extensions

DSVG supports two equivalent source suffixes and one compiled output:

| Extension | Role                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `.dsvg`   | Dynamic source — prefer when unresolved templates or unapplied layout would confuse generic SVG tools |
| `.d.svg`  | Dynamic source — prefer when baked geometry/content still previews usefully as ordinary SVG           |
| `.svg`    | Compiled static output                                                                                |

Both source formats contain the same XML document model. Serve either with `image/svg+xml` when rendering; `.dsvg` may need an explicit MIME mapping on some servers.

```ts
import { isDsvgFilename, toCompiledSvgFilename } from '@deckify/dsvg';

isDsvgFilename('badge.dsvg'); // true
isDsvgFilename('badge.d.svg'); // true
isDsvgFilename('badge.svg'); // false
toCompiledSvgFilename('badge.dsvg'); // 'badge.svg'
```

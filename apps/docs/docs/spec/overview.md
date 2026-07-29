---
sidebar_position: 1
title: Specification overview
---

# Specification 0.1

**Status:** Draft

The normative specification lives in the repository at [`spec/dsvg-0.1.md`](https://github.com/deckify/dsvg-standard/blob/main/spec/dsvg-0.1.md).

Highlights:

- Root `<svg>` must declare `data-dsvg-version="0.1"`
- Control attributes use the `data-dsvg-` prefix
- Source files use `.dsvg` or `.d.svg`; compiled files use `.svg`
- Flex `<text>` measurement uses supplied OpenType fonts
- Spec version and package semver are independent
- Parsed AST shape is described by [`schema/dsvg-0.1.schema.json`](/schema/dsvg-0.1.schema.json)

JSON Schema validates the **parsed AST**, not the XML source text.

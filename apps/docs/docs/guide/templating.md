---
sidebar_position: 3
title: Templating
---

# Mustache templating

DSVG 0.1 supports a **variable-only** Mustache subset in attribute values and text nodes.

| Form         | Behavior                   |
| ------------ | -------------------------- |
| `{{name}}`   | Interpolate and XML-escape |
| `{{{name}}}` | Interpolate raw            |
| `{{& name}}` | Interpolate raw            |

Dotted paths work (`{{label.title}}`). Missing variables error by default.

```xml
<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="80">
  <text x="10" y="40">Hello {{name}}</text>
  <rect x="10" y="50" width="{{width}}" height="12" fill="#3366ff" />
</svg>
```

Sections, inverted sections, partials, and lambdas are **not** supported in 0.1.

:::warning
Raw interpolation can inject markup. Sanitize untrusted variable values.
:::

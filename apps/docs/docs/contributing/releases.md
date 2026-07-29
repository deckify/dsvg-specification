---
sidebar_position: 1
title: Releases
---

# Releases

## npm packages (Changesets)

Publishable TypeScript packages live under `implementations/typescript/*` and are versioned with Changesets.

```bash
pnpm changeset          # record a change
pnpm version-packages   # apply versions + changelogs
pnpm release            # build dsvg and publish
```

On `main`, [`.github/workflows/release.yml`](https://github.com/deckify/dsvg-standard/blob/main/.github/workflows/release.yml) runs format/lint/typecheck/test, maintains a release PR, and publishes when `NPM_TOKEN` is configured in the repository secrets.

PR and push quality gates live in [`.github/workflows/ci.yml`](https://github.com/deckify/dsvg-standard/blob/main/.github/workflows/ci.yml).

## Specification vs package versions

| Kind    | Example                   | Meaning                |
| ------- | ------------------------- | ---------------------- |
| Spec    | `data-dsvg-version="0.1"` | Document compatibility |
| Package | `@deckify/dsvg@0.1.0`     | Implementation release |

Implementations may ship multiple package versions while supporting the same spec version.

## GitHub Pages

Docs deploy from [`.github/workflows/deploy-pages.yml`](https://github.com/deckify/dsvg-standard/blob/main/.github/workflows/deploy-pages.yml). In the GitHub repository settings, set Pages source to **GitHub Actions**. Target URL: `https://deckify.github.io/dsvg-standard/`.

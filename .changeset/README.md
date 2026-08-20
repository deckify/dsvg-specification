# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) to version and publish npm packages under `implementations/typescript/*`.

## Workflow

1. Make your change
2. Run `pnpm changeset` and describe the impact
3. Stage the new `.changeset/*.md` file (pre-commit requires it when publishable packages change)
4. Merge to `main`
5. The release GitHub Action opens a version PR or publishes when that PR lands

Private apps (such as `dsvg-docs`) are ignored.

Emergency pre-commit bypass: `SKIP_CHANGESET_CHECK=1`.

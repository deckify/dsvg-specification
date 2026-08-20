# Project Instructions

## Code Style

- Use TypeScript for all new files in TypeScript packages
- Prefer named exports over default exports
- Use arrow functions when possible
- Adhere to the Prettier config in `.prettierrc.mjs`
- Avoid `any` in TypeScript
- Add JSDoc comments to all functions in TypeScript implementations

## File Naming

- Name component/class/hook files after the component/class/hook (PascalCase)
- Name other files with kebab-case

## Packages

- PNPM is the package manager
- Workspace packages live under `implementations/typescript/*` and `apps/*`
- Language-neutral assets live under `spec/`, `schema/`, and `examples/`
- Future non-JS implementations go under `implementations/<language>/`
- Publishable TypeScript package name is `@deckify/dsvg`

## Documentation

- Keep the Docusaurus site under `apps/docs` in sync with the normative spec
- Spec version (`0.1`) is distinct from package semver

## Releases (Changesets)

- Publishable packages under `implementations/typescript/*` (notably `@deckify/dsvg`) version via Changesets
- Any user-facing or publishable change to those packages MUST include a changeset file (run `pnpm changeset`, or add `.changeset/*.md`) — without it, the Release workflow will not open a version PR or publish to npm
- Spec/schema/docs-only changes do not need a changeset unless a publishable package also changed
- `dsvg-docs` is ignored by Changesets; do not version it
- After merge to `main`, release.yml opens a version PR or publishes when `NPM_TOKEN` is set — see `apps/docs/docs/contributing/releases.md`
- Husky pre-commit runs `scripts/check-changeset.mjs`: staged changes under publishable `implementations/typescript/*` packages require a staged `.changeset/*.md` (not README). Version-package commits (delete changesets + CHANGELOG) are allowed. Bypass only with `SKIP_CHANGESET_CHECK=1`

## Git Commits

- When creating commit messages, always follow the `conventional-commit` skill at `.agents/skills/conventional-commit/SKILL.md`
- Use Conventional Commits (`type(scope): description`) with the skill's structured XML workflow
- Keep messages concise: short imperative subject, no fluff; omit body unless needed for why, breaking changes, or issue refs

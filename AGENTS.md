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

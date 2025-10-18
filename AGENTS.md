# Repository Guidelines

## Project Structure & Architecture
DashPlayer uses Electron 29 with Vite splitting the app into main (`src/main.ts`), preload (`src/preload.ts`), and renderer (`src/app.tsx`) targets. `src/backend/` holds services, IPC handlers, and SQLite access under `db/`. React UI lives in `src/fronted/` with `components/`, `pages/`, and `hooks/`, while shared contracts and utilities stay in `src/common/`. Database migrations reside in `drizzle/`, packaged binaries (ffmpeg, whisper, yt-dlp) in `lib/`, and deeper design notes in `dev-docs/` or `docs/`.

## Build, Test, and Development Commands
Run `yarn run download` once to fetch bundled binaries before development. `yarn start` wires Vite and Electron Forge for live reload, `yarn make`/`yarn package` produce distributables, and `yarn publish` releases artifacts. Use `yarn lint` for ESLint checks. Testing flows rely on Vitest: `yarn test` or `yarn test:watch` for iteration, `yarn test:coverage` before PRs, and `yarn test:ui` for the graphical dashboard.

## Coding Style & Naming Conventions
Write TypeScript/TSX with 4-space indentation, single quotes, and trailing commas on multiline lists. Components and classes use `PascalCase`, hooks begin with `use`, and services/utilities stay `camelCase`. Keep UI concerns in renderer folders and business logic in backend services. Follow Tailwind utility ordering from existing files, and use the configured path aliases (`@/fronted/...`, `@/backend/...`, `@/common/...`).

## Testing Guidelines
Vitest with Testing Library and JSDOM powers unit and integration coverage. Place specs beside source in `__tests__/` directories or as `*.test.ts(x)` siblings (`src/fronted/components/__tests__/Button.test.tsx`). Import `src/test/setup.ts` when DOM globals are needed. Assert user-visible behavior and IPC contracts, and keep coverage healthy via `yarn test:coverage`.

## Commit & Pull Request Guidelines
Repository history favors concise, action-focused commit messages (`优化代码`, `修复`); mirror that tone, one concern per commit, no trailing punctuation. PRs should explain context, list verification steps, attach UI captures when flows change, and link issues. Call out migration updates in `drizzle/` or scripts, and mention when contributors must rerun `yarn run download`.

## Service Configuration & Security
External integrations drive key features: Youdao, Tencent, OpenAI, Sherpa ONNX. Configure credentials through the in-app Settings UI or local secure storage—never commit keys or generated data. Ensure `lib/` binaries match the branch (rerun `yarn run download` after upgrades) and review `forge.config.ts` plus `drizzle.config.ts` whenever changing build or database behavior.

## Agent Notes
- Drizzle migrations under `drizzle/migrations/` are auto-generated; never edit them manually. Change the schema in `src/backend/db/tables/` and run `yarn drizzle-kit generate` afterwards.

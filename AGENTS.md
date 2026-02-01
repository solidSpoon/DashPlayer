# Repository Guidelines

## Project Structure & Architecture
DashPlayer uses Electron 39 with Vite splitting the app into main (`src/main.ts`), preload (`src/preload.ts`), and renderer (`src/app.tsx`/`src/renderer.ts`) targets. `src/backend/` holds services, IPC handlers, and SQLite access under `infrastructure/db/`. React UI lives in `src/fronted/` with `components/`, `pages/`, and `hooks/`, while shared contracts and utilities stay in `src/common/`. Database migrations reside in `drizzle/`, packaged binaries (ffmpeg, whisper) in `lib/`, and documentation lives in `Writerside/` (no `docs/` or `dev-docs/` directory today).

## Build, Test, and Development Commands
Run `yarn run download` once to fetch bundled binaries before development. `yarn start` wires Vite and Electron Forge for live reload, `yarn make`/`yarn package` produce distributables, and `yarn publish` releases artifacts. Use `yarn lint` for ESLint checks. Testing flows rely on Vitest: `yarn test` or `yarn test:watch` for iteration, `yarn test:coverage` before PRs, and `yarn test:ui` for the graphical dashboard.

## Coding Style & Naming Conventions
Write TypeScript/TSX with 4-space indentation, single quotes, and trailing commas on multiline lists. Components and classes use `PascalCase`, hooks begin with `use`, and services/utilities stay `camelCase`. Keep UI concerns in renderer folders and business logic in backend services. Follow Tailwind utility ordering from existing files, and use the configured path aliases (`@/fronted/...`, `@/backend/...`, `@/common/...`).

## Testing Guidelines
Vitest with Testing Library and JSDOM powers unit and integration coverage. Place specs beside source in `__tests__/` directories or as `*.test.ts(x)` siblings (`src/fronted/components/__tests__/Button.test.tsx`). Import `src/test/setup.ts` when DOM globals are needed. Assert user-visible behavior and IPC contracts, and keep coverage healthy via `yarn test:coverage`.

## Commit & Pull Request Guidelines
Use Conventional Commits for commit messages (e.g., `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `test: ...`, `build: ...`, `ci: ...`). Keep each commit scoped to a single feature or fix; do not bundle unrelated changes. PRs should explain context, list verification steps, attach UI captures when flows change, and link issues. Call out migration updates in `drizzle/` or scripts, and mention when contributors must rerun `yarn run download`.

## Service Configuration & Security
External integrations drive key features: Youdao, Tencent, OpenAI, Sherpa ONNX. Configure credentials through the in-app Settings UI or local secure storage—never commit keys or generated data. Ensure `lib/` binaries match the branch (rerun `yarn run download` after upgrades) and review `forge.config.ts` plus `drizzle.config.ts` whenever changing build or database behavior.

## Logging & Debug Filters
Use log tags to reduce noise during debugging. Set `DP_LOG_TAGS` (comma-separated, or `*`/`all` to disable filtering) in `.env` to only emit tagged logs. Add tags via `getMainLogger('Module').withTags('tag').info(...)`. When troubleshooting, suggest filtering to relevant tags/modules to reduce unrelated log spam. Prefer top-level `const logger = getMainLogger('Module')` in main and `const logger = getRendererLogger('Module')` in renderer. Tags are for coarse feature filtering only (1-2 tags, e.g. subtitle/whisper/translate/ipc), and only when you need to filter. Dev-time log level and filters must be set in env: `DP_LOG_LEVEL=debug`, `VITE_DP_LOG_LEVEL=debug`, `DP_LOG_TAGS=subtitle,whisper`.

## Agent Notes
- Drizzle migrations under `drizzle/migrations/` are auto-generated; never edit them manually. Change the schema in `src/backend/db/tables/` and run `yarn drizzle-kit generate` afterwards.
- This is a personal open-source project. Favor simple, pragmatic designs; avoid over-engineering architecture.
- Avoid compatibility shims; remove dead/legacy code thoroughly when refactoring.
- If you notice a potential new guideline worth adding to this file, ask before adding it.

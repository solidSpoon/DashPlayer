# Repository Guidelines

## Project Structure & Architecture
DashPlayer uses Electron 39 with Vite splitting the app into main (`src/main.ts`), preload (`src/preload.ts`), and renderer (`src/app.tsx`/`src/renderer.ts`) targets. `src/backend/` holds services, IPC handlers, and SQLite access under `infrastructure/db/`. React UI lives in `src/fronted/` with `components/`, `pages/`, and `hooks/`, while shared contracts and utilities stay in `src/common/`. Database migrations reside in `drizzle/`, packaged binaries (ffmpeg, whisper) in `lib/`, and documentation lives in `Writerside/`.

## Build, Test, and Development Commands
`yarn start` runs `yarn run download` and wires Vite + Electron Forge for live reload. `yarn make`/`yarn package`/`yarn publish` also run `yarn run download` before building artifacts. Use `yarn lint` for ESLint checks. Testing flows rely on Vitest: `yarn test` or `yarn test:watch` for iteration, `yarn test:coverage` before PRs, and `yarn test:ui` for the graphical dashboard.

## Coding Style & Naming Conventions
Write TypeScript/TSX with 4-space indentation, single quotes, and trailing commas on multiline lists. Components and classes use `PascalCase`, hooks begin with `use`, and services/utilities stay `camelCase`. Keep UI concerns in renderer folders and business logic in backend services. Follow Tailwind utility ordering from existing files, and use the configured path aliases (`@/fronted/...`, `@/backend/...`, `@/common/...`).

- 注释语言：新增/修改的注释一律使用中文（避免中英混杂）。
- 方法注释：对新增/修改的 function/method，必须在方法顶部写 JSDoc，说明意图、关键入参/出参，以及任何不直观的行为/边界条件。
- 变量注释：如果变量含义/约束无法一眼看懂，在变量声明前写一行中文注释说明。
- 类型注释：对新增/修改的 `type`/`interface`/`class`，必须写顶部 JSDoc；对关键字段写字段级注释（解释含义、单位/格式、约束）。

## Testing Guidelines
Vitest with Testing Library and JSDOM powers unit and integration coverage. Place specs beside source in `__tests__/` directories or as `*.test.ts(x)` siblings (`src/fronted/components/__tests__/Button.test.tsx`). Import `src/test/setup.ts` when DOM globals are needed. Assert user-visible behavior and IPC contracts, and keep coverage healthy via `yarn test:coverage`.

- 测试代码描述规范：`describe` / `it` 文案统一使用中文，且尽量白话、易懂，优先表达真实业务行为，避免过度技术术语。

## Commit & Pull Request Guidelines
Use Conventional Commits for commit messages (e.g., `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `test: ...`, `build: ...`, `ci: ...`). Keep each commit scoped to a single feature or fix; do not bundle unrelated changes. PRs should explain context, list verification steps, attach UI captures when flows change, and link issues. Call out migration updates in `drizzle/` or scripts, and mention when contributors must rerun `yarn run download`.

## Service Configuration & Security
External integrations drive key features: Youdao, Tencent, OpenAI, Sherpa ONNX. Configure credentials through the in-app Settings UI or local secure storage—never commit keys or generated data. Ensure `lib/` binaries match the branch (rerun `yarn run download` after upgrades) and review `forge.config.ts` plus `drizzle.config.ts` whenever changing build or database behavior.

## Logging & Debug Filters
Use module and focus-token filters to reduce noise during debugging. Set `DP_LOG_INCLUDE_MODULES` / `DP_LOG_EXCLUDE_MODULES` and `VITE_DP_LOG_INCLUDE_MODULES` / `VITE_DP_LOG_EXCLUDE_MODULES` in `.env` to filter by module. For temporary feature-focused debugging, set `DP_LOG_FOCUS_TOKEN` and `VITE_DP_LOG_FOCUS_TOKEN`, and use `getMainLogger('Module').withFocus('token')` / `getRendererLogger('Module').withFocus('token')` or a temporary `[FOCUS:token]` message prefix. Prefer top-level `const logger = getMainLogger('Module')` in main and `const logger = getRendererLogger('Module')` in renderer. Dev-time log level and filters must be set in env: `DP_LOG_LEVEL=debug`, `VITE_DP_LOG_LEVEL=debug`.

## Agent Notes
- Drizzle migrations under `drizzle/migrations/` are auto-generated; never edit them manually. Change the schema in `src/backend/infrastructure/db/tables/` and run `yarn drizzle-kit generate` afterwards.
- This is a personal open-source project. Favor simple, pragmatic designs; avoid over-engineering architecture.
- Avoid compatibility shims; remove dead/legacy code thoroughly when refactoring.
- Before implementing new features or refactors, read `docs/architecture-guidelines.md` and follow its file placement/layering rules.
- If you notice a potential new guideline worth adding to this file, ask before adding it.

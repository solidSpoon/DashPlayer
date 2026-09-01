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
写或改测试前，先读 `docs/testing-guidelines.md`（测试规约：分层策略、依赖注入约定、内存库基建、mock 边界）。核心红线：

- 测试必须断言真实业务行为（返回值、数据库状态、DOM），禁止以 mock 调用断言为主；服务层测试一律使用内存 SQLite（`createMemoryDb()`），禁止 mock 仓储层。
- 服务类依赖一律构造函数注入，禁止属性注入后测试强转私有字段。
- `src/fronted/components/ui/`（shadcn 生成）等第三方代码不写测试；删除模块时同步删除对应测试，不留孤儿测试与死配置。
- 禁止用 `.skip`、删断言、放宽期望值让测试变绿；测试挂了先修根因。
- 修改公开行为时必须同步更新对应测试；`describe` / `it` 文案统一使用中文白话，表达真实业务行为，避免过度技术术语。

## Commit & Pull Request Guidelines
Use Conventional Commits for commit messages (e.g., `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `test: ...`, `build: ...`, `ci: ...`). Keep each commit scoped to a single feature or fix; do not bundle unrelated changes. PRs should explain context, list verification steps, attach UI captures when flows change, and link issues. Call out migration updates in `drizzle/` or scripts, and mention when contributors must rerun `yarn run download`.

## Service Configuration & Security
External integrations drive key features: Youdao, Tencent, OpenAI, Sherpa ONNX. Configure credentials through the in-app Settings UI or local secure storage—never commit keys or generated data. Ensure `lib/` binaries match the branch (rerun `yarn run download` after upgrades) and review `forge.config.ts` plus `drizzle.config.ts` whenever changing build or database behavior.

## Agent Notes
- Drizzle migrations under `drizzle/migrations/` are auto-generated; never edit them manually. Change the schema in `src/backend/infrastructure/db/tables/` and run `yarn drizzle-kit generate` afterwards.
- This is a personal open-source project. Favor simple, pragmatic designs; avoid over-engineering architecture.
- Avoid compatibility shims; remove dead/legacy code thoroughly when refactoring.
- Before implementing new features or refactors, read `docs/architecture-guidelines.md` and follow its file placement/layering rules.
- 遇到并发控制、限流、让步调度、锁顺序或重入相关需求时（例如 ffmpeg/ffprobe/whisper 任务并发、gpt/tts/tencent 请求限流、视频分析让步调度），先阅读 `docs/concurrency-kernel-usage.md`，按该文档的约定实现。
- 涉及日志产出、崩溃归因、子进程/后台任务身份标识（`job`）、检索键（`traceId`/`module`）或"这条日志该写什么字段"时，先阅读 `docs/observability.md`：本项目的故障排查由 AI 只读 JSONL 日志完成，日志形状与检索键是契约的一部分。
- 禁止编写 fallback 逻辑来掩盖配置或数据问题（包括前端默认值兜底、静默回退、隐式纠偏）；一旦数据异常必须尽早失败并显式暴露问题。
- 遇到问题必须优先做根因修复，不以“最小改动”作为决策依据；应消除问题源头及相关死代码，避免临时性补丁长期残留。
- 作为 Agent 执行实现时，不要为了控制改动面而牺牲正确性；应优先选择从根源解决问题的方案，允许为此进行必要的重构，并主动删除因旧方案产生的遗留、兼容分支和无效代码。
- 未明确要求编写或修改测试时，不要新增测试文件，也不要因默认流程补测试。
- If you notice a potential new guideline worth adding to this file, ask before adding it.

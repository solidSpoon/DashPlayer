# 仓库约定

## 注释规范
- 注释一律使用中文，避免中英混杂。
- 新增/修改的 function/method 在顶部写 JSDoc：说明意图、关键入参/出参、不直观的行为与边界条件。
- 新增/修改的 `type`/`interface`/`class` 写顶部 JSDoc；含义/单位/约束不直观的字段写字段级注释，含义一眼可懂的变量不用注释。

## 测试规范
- `describe` / `it` 文案统一使用中文，尽量白话、易懂，优先表达真实业务行为，避免过度技术术语。
- 断言面向用户可见行为和 IPC 契约，而非实现细节。
- 未明确要求编写或修改测试时，不要新增测试文件，也不要因默认流程补测试。

## 提交与发版
- 提交信息使用 Conventional Commits（`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:` / `build:` / `ci:`）。**这条是硬约束**：Release Please 靠提交类型决定版本号和 changelog，无类型的提交会被直接忽略，等于白做了不发版。
- 每个提交只做一件事，不捆绑无关改动。
- 发版流程已全自动化：合并到 main 的提交由 Release Please 自动攒发版 PR（含版本号和 changelog）；合并该 PR 会自动打 tag 并创建 Release，tag 推送触发 `.github/workflows/release.yml` 四平台构建，产物自动挂到 Release。**不要手动改 `package.json` 的 version 或手动打 tag**。
- CI 中没有 lint / 测试质量门，发版前质量靠本地把关（`yarn lint`、`yarn test:run`）。
- PR 应说明背景、验证步骤，UI 流程变化时附截图；涉及 `drizzle/` 迁移或要求重新执行 `yarn run download` 时必须注明。

## 安全
- 外部服务密钥（有道、腾讯、OpenAI、Sherpa ONNX）只能通过应用内设置或本地安全存储配置，严禁提交密钥或生成数据到仓库。

## Agent 注意事项
- 这是个人开源项目，偏好简单务实的方案，避免过度设计。
- 实现新功能或重构前，先读 `docs/architecture-guidelines.md` 并遵守其文件摆放与分层规则。
- 涉及并发控制、限流、让步调度、锁顺序或重入（如 ffmpeg/whisper 任务并发、gpt/tts 请求限流）时，先读 `docs/concurrency-kernel-usage.md` 按其约定实现。
- 涉及日志产出、崩溃归因、`job`/`traceId`/`module` 等检索键时，先读 `docs/observability.md`：故障排查由 AI 只读 JSONL 日志完成，日志形状与检索键是契约的一部分。
- Drizzle 迁移（`drizzle/migrations/`）是自动生成的，禁止手改；改 `src/backend/infrastructure/db/tables/` 下的 schema 后执行 `yarn drizzle-kit generate`。
- 禁止编写 fallback 掩盖配置或数据问题（含前端默认值兜底、静默回退、隐式纠偏）；数据异常必须尽早失败并显式暴露。
- 问题一律根因修复，不以“最小改动”为决策依据；允许为从根源解决而重构，并主动删除旧方案的遗留、兼容分支和死代码。
- 如果发现值得新增的约定，先询问再写入本文件。

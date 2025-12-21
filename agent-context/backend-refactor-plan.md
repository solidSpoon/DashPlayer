# DashPlayer 后端重构方案（仅后端）

目标：逐步降低耦合、强化单一职责、让业务逻辑可测试、让目录结构“按分层/按领域”更清晰；每次只改一项，保持可运行。

## 现状观察（基于 `src/backend`）

- **业务 service 过胖/职责混杂**
  - `src/backend/services/impl/SubtitleServiceImpl.ts`：解析字幕 + 缓存 + 单词匹配 + 反向调用 renderer。
  - `src/backend/services/impl/VideoLearningServiceImpl.ts`：体量很大（>1000 行），包含队列/缓存/DB/文件/通知等多类职责。
- **反向依赖：业务层直接调用 renderer**
  - `SystemService.callRendererApi` 被业务 service 调用（如 `SubtitleServiceImpl`、`VideoLearningServiceImpl`）。
- **DB 访问散落**
  - service 直接 `import db` + tables（如 `VocabularyServiceImpl`、`DpTaskServiceImpl`），SQL 细节与业务逻辑混在一起。
- **命名/归档不一致导致认知成本**
  - `src/backend/services/AiTransServiceImpl.ts` 实际是接口（`TranslateService`），实现却在 `src/backend/services/impl/TranslateServiceImpl.ts`。
  - `src/backend/services/AiServiceImpl.ts` 同文件既声明接口又实现。
  - Controller 里有时注入实现类（如 `AiFuncController`、`MediaController`），破坏“只依赖接口”的原则。
- **Location/路径逻辑与 DI 混用**
  - `LocationUtil` 作为 static util 同时读写 store、依赖 electron app；同时又存在 `LocationServiceImpl`。
  - `db/db.ts`、`ioc/simple-logger.ts` 等绕过 DI 使用 `LocationUtil`，导致启动顺序与测试更难控。

## 总体设计：按“分层 + 领域”拆分

建议把后端拆成三层（在现有 Electron 主进程架构上渐进实现）：

1) **Adapter 层（边界层）**
- IPC/Controller：路由映射、参数校验、错误映射、鉴权（如需）、将输入转为用例调用。
- 不写业务规则、不直接操作 DB、不直接使用第三方 SDK。

2) **Application/UseCase 层（业务编排层）**
- 负责“用例流程”：组合多个领域服务/仓储/网关，编排事务与边界交互。
- 不知道 IPC/renderer；只通过接口（gateway/event-bus）通知外部。

3) **Infrastructure 层（基础设施层）**
- DB 仓储（drizzle）、文件系统、ffmpeg、OpenAI、Tencent/Youdao、缓存、electron-store、日志等。
- 对外暴露接口实现（Repository/Gateway），供 UseCase 层依赖。

### 核心原则

- **依赖方向**：Adapter → UseCase → (Repository/Gateway 接口) ← Infrastructure 实现。
- **业务不依赖 UI**：业务层不直接 `callRendererApi`，改为事件或 gateway。
- **单一职责**：一个 class/文件尽量只做一类事情（解析/持久化/编排/IO 分离）。
- **可测试**：UseCase 用 mock repository/gateway 即可测，不需要 Electron/DB/FS。

## 目录结构建议（在 `src/backend` 下渐进落地）

不要求一次性迁移，可以先新增目录并逐个搬迁。

```
src/backend/
  adapters/
    ipc/               # registerRoute / controllers 的适配层（或保留现有 controllers 并逐步迁移）
  application/
    usecases/          # 业务用例（编排流程）
  domain/
    models/            # 领域模型（可选）
    services/          # 纯业务规则（可选）
    events/            # 领域事件（可选）
  infrastructure/
    db/
      repositories/    # drizzle + SQL 细节
    fs/                # FileUtil/路径等 IO
    media/             # ffmpeg/whisper 等
    external/
      openai/
      tencent/
      youdao/
    cache/
    settings/          # electron-store 等
  ioc/                 # 保留 inversify，但建议模块化
  utils/               # 纯函数工具（不带副作用/不依赖 electron）
```

> 说明：现有 `services/` 可以逐步演进为 `domain/services`（接口与纯业务）+ `infrastructure/*`（实现），中间阶段可以保留现状但把新代码按新结构写。

## “基础 service” vs “业务 service” 的界线

### 基础 service / gateway（Infrastructure）

特点：封装外部系统与副作用（IO），对业务暴露稳定接口。

- `Db*Repository`：封装 drizzle 查询/写入、事务、表结构。
- `MediaGateway`：ffmpeg/媒体信息/缩略图生成。
- `TranscriptionGateway`：OpenAI Whisper、本地 whisper。
- `TranslationGateway`：Tencent/Youdao/OpenAI 的翻译能力。
- `SettingsStore`：electron-store 读写（替代业务层直接 `storeGet/storeSet`）。
- `RendererGateway` 或 `EventBus`：向 renderer 通知（替代业务层直接 `callRendererApi`）。

### 业务 service / usecase（Application）

特点：实现业务流程与规则，不关心实现细节。

- `ParseSubtitleUseCase`：解析 srt → 缓存 →（触发事件）请求词匹配。
- `VideoLearningAutoClipUseCase`：候选片段分析 → 去重 → 入库 → 触发同步/通知。
- `DpTaskUseCase`：任务状态机、节流持久化、取消机制等。

## 关键改造点（建议按优先级逐项做）

### P0：建立“业务不依赖 renderer”的边界

- 新增接口：`RendererGateway`（或 EventBus）
  - 业务层只调用 `rendererGateway.notifyVocabularyMatch(...)` 之类方法，或 `eventBus.publish(...)`。
  - IPC/主进程里实现该接口，内部再调用 `SystemService.callRendererApi` / `webContents.send`。
- 首个落点：`SubtitleServiceImpl` 的 `processVocabularyMatching` 与 `VideoLearningServiceImpl` 的通知逻辑。

收益：解除“业务→UI”耦合，后续拆服务更容易。

### P1：把 DB 操作收敛到 Repository

- 为高频表先建仓储：
  - `WordsRepository`：`getAll/search/upsert` 等（承接 `VocabularyServiceImpl`）。
  - `DpTaskRepository`：`create/update/get` 等（承接 `DpTaskServiceImpl` 的持久化段）。
  - `VideoLearningClipRepository`：承接 `VideoLearningServiceImpl` 的查询/插入/批处理。
- UseCase/Service 只拿“领域对象/DTO”，不拼 SQL。

收益：业务逻辑更干净；事务边界清晰；测试更容易 mock。

### P2：拆大类（尤其 `VideoLearningServiceImpl`）

建议拆分方向（示例）：

- `ClipCandidateAnalyzer`：从字幕/词匹配产出候选。
- `ClipWriter`：入库/去重/更新状态（仅 DB）。
- `ClipSyncOrchestrator`：与 OSS/本地文件交互。
- `ClipTaskQueue`：队列/节流/进度（与业务规则分离）。

收益：每个类职责单一，改动影响面变小。

### P3：统一命名与依赖注入约束

- 规则：
  - `services/*.ts` 放接口（不带 `Impl`）。
  - 实现放 `services/impl/*` 或迁入 `infrastructure/*`。
  - Controller 注入接口，不注入实现类。
- 先修正明显错位：
  - `AiTransServiceImpl.ts`（接口文件）重命名为 `TranslateService.ts`（或迁移）。
  - `AiServiceImpl.ts` 拆成 `AiService.ts` + `impl/AiServiceImpl.ts`。

### P4：减少 static util 副作用，收敛 Location 逻辑

- 让“决定路径/写默认配置”只发生在 `LocationService`（或 `StoragePathService`）内部。
- `LocationUtil` 尽量变为纯函数工具（不触碰 store、app），或只留在 infrastructure 层。

收益：启动顺序更可控；更易测试；更少隐式依赖。

### P5：IoC 模块化

- 将 `src/backend/ioc/inversify.config.ts` 按领域拆为多个 module 文件，再统一加载。

收益：依赖更清晰，冲突更少，新增功能更快。

## 建议的落地顺序（一次改一项，保持可运行）

1. 新增 `RendererGateway`（或 EventBus）接口与实现；把 `SubtitleServiceImpl` 的 renderer 调用迁出去。
2. 给 `VocabularyServiceImpl` 抽 `WordsRepository`，让 service 只编排导入/导出规则。
3. 给 `DpTaskServiceImpl` 抽 `DpTaskRepository`（保留缓存与节流逻辑），逐步清晰“状态机 vs 持久化”。
4. 拆 `VideoLearningServiceImpl`：先从“DB 写入与查询”抽仓储；再把“候选分析”抽成独立组件。
5. 最后做命名与目录迁移（减少大规模 rename 带来的冲突）。

## 验收/约束（每一步都可检查）

- 业务层代码不再直接 import `electron`、不直接 `callRendererApi`。
- controller 只做适配，不出现大量业务流程。
- 新增/重构的 DB 访问只出现在 `repositories/`。
- 每次重构后能正常跑主进程（必要时补最小单测/或现有 vitest 覆盖）。


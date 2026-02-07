# DashPlayer 架构规范（目标态）

> 本文档用于指导 **后续开发** 的文件落位、依赖方向与模块边界。
>
> 原则：不迁就历史债务；新增与重构代码以本文为准。

## 1. 目标与非目标

### 1.1 目标

- 明确每层职责与依赖方向，避免“能跑就行”的跨层调用。
- 让新增功能可以按模板落位，减少目录与命名争议。
- 让业务逻辑可测试，外部依赖可替换（DB、Electron、第三方 API、文件系统）。

### 1.2 非目标

- 不要求一次性重写历史代码。
- 不追求形式化 DDD 全套术语。
- 不为低价值工具代码强行抽象。

## 2. 全局架构边界

DashPlayer 是 Electron 应用，分为三条主线：

- `main` 进程（后端业务 + IPC 路由 + 系统能力）
- `preload`（安全桥接层）
- `renderer` 进程（前端 UI + 状态管理）

统一约束：

- 跨进程通信契约统一放在 `src/common/api/**`。
- 共享业务类型（DTO/VO）统一放在 `src/common/contracts/**`（新建时使用；历史 `common/types` 可逐步迁移）。
- 任一层都不得 import 另一层的基础设施实现细节（例如前端 import 后端 `db/tables`）。

## 3. 目标目录（规范）

以下为目标态目录，后续新增代码按此组织。

```text
src/
  main.ts
  preload.ts
  app.tsx
  renderer.ts

  backend/
    adapters/
      controllers/            # IPC Controller：参数校验、调用 application、错误映射
      ipc/                    # registerRoute、IPC 事件桥接

    application/
      services/               # 业务用例（按领域分组）
      ports/
        repositories/         # 持久化端口接口
        gateways/             # 外部能力端口接口（renderer/settings/media/http）
      contracts/              # 仅后端内部使用的 DTO/Command/Result
      errors/

    infrastructure/
      db/
        db.ts
        migrate.ts
        tables/               # Drizzle schema（仅 infra 内可见）
        repositories/         # repositories 实现
      media/                  # ffmpeg/whisper/yt-dlp 适配实现
      settings/               # electron-store 适配实现
      renderer/               # 发送到 renderer 的 gateway 实现
      openai/                 # OpenAI SDK 适配实现
      logger/                 # 日志实现
      config/                 # 配置文件存储实现（非系统设置）
      system/                 # BrowserWindow/app/shell 等系统能力

    startup/                  # 启动迁移、seed、启动时修复逻辑
    ioc/                      # 依赖注入装配
    utils/                    # 后端纯工具函数

  fronted/
    pages/                    # 页面级 UI 组合
    components/               # 复用组件
    hooks/                    # 视图状态/交互逻辑
    application/
      usecases/               # 前端用例（可选，复杂场景使用）
      ports/                  # BackendClient/Event/Logger 等端口
      bootstrap/              # 初始化与装配
    infrastructure/
      electron/               # 对 window.electron 的实现
    log/
    i18n/
    lib/

  common/
    api/                      # IPC 契约（主<->渲）
    contracts/                # 共享 DTO/VO（目标位置）
    constants/
    utils/                    # 纯工具
    log/
```

## 4. 依赖方向（强约束）

允许依赖：

- `backend/adapters -> backend/application`
- `backend/application -> backend/application/ports`
- `backend/infrastructure -> backend/application/ports`
- `backend/ioc -> backend/adapters + backend/application + backend/infrastructure`
- `fronted/application -> common`
- `fronted/infrastructure -> fronted/application/ports`
- `fronted/pages|components|hooks -> fronted/application + common`

禁止依赖：

- `application` import `infrastructure/**`（包括 logger、db tables、store、ffmpeg 命令等）
- `fronted/**` import `backend/**`
- `common/**` import `backend/**` 或 `fronted/**`
- `ports` 引用 ORM/SDK 专属类型（如 drizzle table row）

一句话：**依赖指向抽象，不指向实现。**

## 5. 文件放置规则（最实用）

### 5.1 新增一个“后端功能”放哪里

以“字幕时间轴修正”为例，应包含：

- Controller：`src/backend/adapters/controllers/SubtitleTimingController.ts`
- Service：`src/backend/application/services/subtitle/AdjustSubtitleTimingService.ts`
- Port（如需持久化）：`src/backend/application/ports/repositories/SubtitleTimingRepository.ts`
- Infra 实现：`src/backend/infrastructure/db/repositories/SubtitleTimingRepositoryImpl.ts`
- IPC 契约：`src/common/api/api-def.ts`（仅新增路径与参数返回类型）
- 共享 DTO：`src/common/contracts/subtitle/*.ts`

### 5.2 新增一个“前端功能”放哪里

以“设置页新增选项卡”为例：

- Page：`src/fronted/pages/setting/<Feature>Setting.tsx`
- 复用组件：`src/fronted/pages/setting/components/<Feature>*.tsx`
- 调后端端口：通过 `fronted/application/ports/backend/BackendClientPort.ts`
- Electron 实现保持在 `fronted/infrastructure/electron/**`
- 禁止直接依赖 `window.electron`（只能通过 port 封装）

### 5.3 数据类型放哪里

- IPC 请求/响应类型：`src/common/api/**`
- 跨进程 DTO/VO：`src/common/contracts/**`
- 后端内部命令对象：`src/backend/application/contracts/**`
- ORM 行类型：只在 `src/backend/infrastructure/db/**`

## 6. 命名规范

- Controller：`<Domain>Controller`
- Service（用例）：`<Verb><Domain>Service`
- Repository Port：`<Domain>Repository`
- Repository Impl：`<Domain>RepositoryImpl`
- Gateway Port：`<Capability>Gateway` / `*Store`
- Gateway Impl：`<Capability>GatewayImpl` / `*StoreImpl`
- DTO：`<Domain><Action>Request|Response|VO`

避免：

- `Impl` 出现在 application 层（除兼容历史，新增代码不再使用）
- `ServiceImpl` 文件名与接口名分离导致跳转困难

## 7. Controller / Service / Repository 职责边界

### 7.1 Controller

- 只做参数校验、调用 service、错误映射。
- 不写业务流程，不访问 DB，不操作文件系统。

### 7.2 Service

- 负责用例编排与业务决策。
- 通过 ports 调用持久化、外部服务、渲染通知。
- 不直接 import Electron/Drizzle/fs/axios SDK。

### 7.3 Repository / Gateway

- Repository：数据持久化细节。
- Gateway：系统能力和第三方能力适配。
- 实现层负责“脏活”，application 只感知接口。

## 8. IPC 规范

- 所有 IPC 路径在 `src/common/api/api-def.ts` 统一声明。
- 路径命名：`<domain>/<action>`，例如 `settings/update-appearance`。
- Controller 注册路径，Service 不感知 IPC。
- Renderer 回调事件在 `src/common/api/renderer-api-def.ts` 声明。

## 9. 数据与持久化规范

- Drizzle `tables` 仅 `infrastructure/db/**` 可 import。
- application ports 只使用领域 DTO，不暴露 drizzle row 类型。
- 迁移文件由 drizzle 生成，禁止手改 `drizzle/migrations/**`。
- 系统设置继续走 `SettingsStore`（electron-store）。
- 任务级临时上下文可走 `ConfigStore`（JSON 文件）。

## 10. 日志规范

- main：`getMainLogger('<Module>')`
- renderer：`getRendererLogger('<Module>')`
- application 层仅依赖 `LoggerPort`（目标态）。
- 新增代码不要直接 import `infrastructure/logger`。
- 临时排障优先使用 focus token，不在业务代码长期保留噪声日志。

## 11. 测试规范（架构相关）

- Service 测试优先：mock ports，验证业务分支。
- Repository 测试次之：验证 SQL/映射逻辑。
- Controller 测试：验证参数与错误映射，不重复测业务。
- 新增复杂功能至少配一个 Service 级用例测试。

## 12. 代码评审检查清单（PR 必看）

- 是否出现 `fronted -> backend/infrastructure` 依赖？
- 是否出现 `application -> infrastructure` 依赖？
- 新增类型是否放在 `common/contracts` 而非 db tables？
- Controller 是否只做路由与参数处理？
- Service 是否只依赖 ports？
- 新增 IPC 是否同步更新 `common/api` 契约？

任一项为“是（违规）”，PR 不应合并。

## 13. 渐进治理策略（不一次性推倒）

- 新功能：100% 按本规范。
- 修改旧功能：触达到的文件顺手修正边界，不额外扩大重构面。
- 禁止新增“债务复制代码”（例如继续在前端引用后端表类型）。

这意味着：历史问题可以暂存，但不能继续扩散。

## 14. 当前已识别的高优先级治理项（下一阶段）

- 清理 `fronted/**` 对 `backend/infrastructure/db/tables/**` 的类型依赖，迁移到 `common/contracts/**`。
- 清理 `application/**` 对 `infrastructure/**` 的直接依赖，补齐 ports。
- 将 `application/ports/repositories/**` 中基于 drizzle table 的类型替换为领域 DTO。
- 收敛 service 命名与目录（按领域分组，减少 `impl` 平铺）。

---

如果新增需求无法判断放置位置，按以下优先级决策：

1. 先问“这是业务规则还是技术细节？”（业务进 application，技术进 infrastructure）
2. 再问“是否跨进程共享？”（是则进 common/contracts）
3. 最后问“是否有外部副作用？”（有则必须通过 port）

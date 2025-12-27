# DashPlayer 后端重构方案（简版，仅后端）

目标：降低耦合、强化单一职责，让业务可测试、目录可维护；每次只做一小步，保持可运行。

## 整体架构思想（Ports & Adapters / Clean-ish）

- 分层：Adapter（入口）→ Application（用例编排）→ Domain（业务规则）→ Infrastructure（DB/IO/第三方实现）。
- 依赖规则：上层只能依赖下层的“接口/契约（ports）”，Infrastructure 只实现接口（adapters），业务代码不 import `electron/fs/db/axios`。
- 单一职责：用例只做流程编排；Repository 只做持久化；Gateway 只做对外调用；解析/队列/缓存单独成组件。

## 目标目录结构（逐步迁移，允许并存）

```
src/backend/
  adapters/                       # 边界层（入口）
    controllers/                  # controllers：参数校验/错误映射/调用用例
    ipc/                          # IPC 监听与路由（不写业务规则）

  application/                    # 用例层（编排）
    usecases/                     # 一个用例对应一个用户动作（TranslateSubtitle、AddClip...）
    dto/                          # 用例入参/出参（可选）

  domain/                         # 领域层（纯业务）
    models/                       # 值对象/聚合/领域事件（不依赖基础设施）
    services/                     # 纯规则（可选）

  infrastructure/                 # 基础设施层（实现）
    db/
      tables/                     # drizzle tables（保留现状或渐进迁入）
      repositories/               # Repository 接口（ports）
      repositories/impl/          # Repository 实现（drizzle/sql）
    renderer/
      RendererGateway.ts          # 后端 -> 前端（port）
      RendererGatewayImpl.ts      # electron/IPC 实现（adapter）
    settings/                     # store/electron-store 封装
    media/                        # ffmpeg/whisper/yt-dlp 等封装

  ioc/                            # DI 容器与 types
  startup/                        # 启动/seed/migrate（尽量薄）
```

## 代码层面口径（可执行规则）

- Service/UseCase 层：不直接写 SQL（统一下沉到 repository），不直接碰 `BrowserWindow/webContents`（统一走 gateway/通知接口）。
- DB：只允许 `repositories/impl` 使用 `db/drizzle-orm`；上层只依赖 `repositories` 接口。
- 前端通知：只允许 `RendererGateway`（或后续抽象的 `NotificationService`）作为出口，禁止散落 `SystemService.mainWindow().webContents.send`。

## 大 Service 的拆分方向（只列目标）

- `VideoLearningServiceImpl`：候选收集 / 队列调度 / 剪辑执行 / 状态上报。
- `TranslateServiceImpl`：provider 选择 / 缓存 / 落库 / 渲染更新。
- `WatchHistoryServiceImpl`：库同步 / 文件扫描 / 媒体信息提取 / VO 组装 / 通知。

## 迁移策略

- 新旧并存：先新增接口与新实现，再把调用点一处处迁移，避免一次性大改。
- 一次一件事：每次只动一个用例/一个 service，改完跑 `yarn lint` + 相关测试。

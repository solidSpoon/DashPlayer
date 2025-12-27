# DashPlayer 后端重构方案（简版，仅后端）

目标：降低耦合、强化单一职责，让业务可测试、目录可维护；每次只做一小步，保持可运行。

## 整体架构思想

（轻量）三层边界：Controller → Application(Service) → Ports(Repository/Gateway) → Infrastructure(实现)

- 依赖规则：业务代码不直接 import `electron/fs/db/axios`，通过接口隔离
- 单一职责：Service 只做流程编排；Repository 只做持久化；Gateway 只做对外调用

## 适用范围（Electron 本地项目，避免过度设计）

- `ports` 只为“高副作用/高变动”的边界建：`db/repository`、`renderer(webContents)`、`settings(electron-store)`、`media(ffmpeg/whisper/yt-dlp)`、必要时 `http/sdk`
- 纯函数与低风险工具类继续放 `utils/` 直接用；不要为了分层强行给每个小功能都建接口
- 是否使用 DI 容器不重要，关键是依赖方向单向、边界清晰

## 目标目录结构

最终以“边界清晰、依赖单向”为目标；不保留任何过渡目录/中间态命名。

```
src/
  backend/
    adapters/
      controllers/                # IPC 路由注册 + 参数校验 + 错误映射；只调用 application
      ipc/                        # ipcMain / 事件桥接（例如日志、通用 registerRoute 封装）

    application/
      services/                   # 按领域分组的业务编排（翻译、收藏、历史等）；只依赖 ports（轻量）
      ports/
        repositories/             # 持久化端口（接口）：不暴露 drizzle/table 类型（仅核心领域）
        gateways/                 # 外部能力端口（接口）：renderer/media/settings/http（仅必要边界）
      dto/                        # 入参/出参 DTO（可选；优先复用 common 的 DTO/VO）

    infrastructure/
      db/
        db.ts                     # drizzle 初始化
        migrate.ts                # 迁移入口
        tables/                   # drizzle tables（只在 infrastructure 内部使用）
        repositories/
          impl/                   # repositories 的实现（唯一允许 import drizzle/db/tables）
      renderer/                   # RendererGateway 实现（唯一允许触达 webContents）
      settings/                   # electron-store 封装实现
      media/                      # ffmpeg/whisper/yt-dlp 封装实现
      logger/                     # 日志实现（对外暴露简单 logger 接口）

    ioc/                          # DI 容器与 types；组装 ports -> impl
    utils/                        # 仅后端使用、但仍尽量保持“纯”的工具；有副作用的能力放 infrastructure

  common/
    api/
      api-def.ts                  # 后端 API 契约（纯类型）；禁止 import backend/**
      renderer-api-def.ts         # 前端 API 契约（纯类型）
      dto/                        # 跨进程共享 DTO/VO（可选）
    utils/                        # 跨进程可复用的纯工具（无 electron/fs/db 副作用）
```

## 代码层面规则

- Controller 层：只做参数校验与错误映射，业务编排下沉到 `application/services`
- Service 层：不需要为 service 单独写接口（默认用具体类即可）；不直接写 SQL（走 repository），不直接碰 `webContents`（走 gateway）；不为小工具强行建 ports
- DB：只允许 `infrastructure/db/**` 接触 drizzle（`db/tables/drizzle-orm` 只在此处出现）
- 前端通知：只允许 RendererGateway 作为出口

## 大 Service 的拆分方向

- `VideoLearningServiceImpl`：候选收集 / 队列调度 / 剪辑执行 / 状态上报
- `TranslateServiceImpl`：provider 选择 / 缓存 / 落库 / 渲染更新
- `WatchHistoryServiceImpl`：库同步 / 文件扫描 / 媒体信息提取 / VO 组装 / 通知

## 迁移策略

- 新旧并存：先新增接口与新实现，再把调用点一处处迁移，避免一次性大改
- 一次一件事：每次只动一个 service，改完跑 `yarn lint` + 相关测试

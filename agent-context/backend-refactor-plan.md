# DashPlayer 后端重构方案（简版，仅后端）

目标：降低耦合、强化单一职责，让业务可测试、目录可维护；每次只做一小步，保持可运行。

## 整体架构思想

三层架构：Controller → Service → Repository/Gateway

- 依赖规则：业务代码不直接 import `electron/fs/db/axios`，通过接口隔离
- 单一职责：Service 只做流程编排；Repository 只做持久化；Gateway 只做对外调用

## 目标目录结构

```
src/backend/
  adapters/
    controllers/                  # IPC 路由注册、参数校验、错误映射、调用 service

  application/
    services/                     # 按领域分组的业务编排（翻译、收藏、历史等）
    dto/                          # 入参/出参（可选）

  infrastructure/
    db/
      tables/                     # drizzle tables
      repositories/               # Repository 接口（ports）
      repositories/impl/          # Repository 实现
    renderer/                     # RendererGateway - 通知前端
    cache/                        # CacheStore - 缓存
    queue/                        # TaskQueue - 任务队列
    media/                        # ffmpeg/whisper/yt-dlp
    settings/                     # electron-store 封装
    logger.ts                     # 日志

  ioc/                            # DI 容器与 types
```

## 代码层面规则

- Controller 层：只做参数校验与错误映射，业务编排下沉到 `application/services`
- Service 层：不直接写 SQL（走 repository），不直接碰 `webContents`（走 gateway）
- DB：只允许 `infrastructure/db/**` 接触 drizzle
- 前端通知：只允许 RendererGateway 作为出口

## 大 Service 的拆分方向

- `VideoLearningServiceImpl`：候选收集 / 队列调度 / 剪辑执行 / 状态上报
- `TranslateServiceImpl`：provider 选择 / 缓存 / 落库 / 渲染更新
- `WatchHistoryServiceImpl`：库同步 / 文件扫描 / 媒体信息提取 / VO 组装 / 通知

## 迁移策略

- 新旧并存：先新增接口与新实现，再把调用点一处处迁移，避免一次性大改
- 一次一件事：每次只动一个 service，改完跑 `yarn lint` + 相关测试

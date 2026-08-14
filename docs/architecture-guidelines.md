# DashPlayer 后端代码规范（务实版）

> 这是一份轻量的代码落位和依赖边界说明。
>
> 目标不是把 DashPlayer 做成大型企业系统，而是让代码容易找到、容易修改，并避免业务逻辑和 Electron、数据库、第三方 SDK 互相缠绕。

## 1. 基本结构

后端主要运行在 Electron main 进程中。新增代码优先遵循下面的关系：

```text
IPC Controller
    ↓
Service
    ↓
Infrastructure
```

目标目录：

```text
src/backend/
  controllers/          # IPC 请求适配
  services/             # 业务流程
    <domain>/            # 功能较多时按业务分组
  infrastructure/       # 外部依赖的具体实现
    db/
    media/
    settings/
    system/
    translate/
    renderer/
  startup/              # 启动初始化
  ioc/                  # 依赖装配
  utils/                # 后端专用的轻量工具
```

当前仓库中的 `adapters/controllers`、`application/services`、
`application/ports` 等目录属于历史结构，不要求立即整体搬迁。

不要求每个功能都创建完整的一套目录。功能少时，一个文件就近放置即可。

## 2. 各部分负责什么

### 2.1 Controller

Controller 负责：

- 注册 IPC 路径；
- 接收和整理 IPC 参数；
- 调用 Service；
- 将结果返回给 renderer。

Controller 不负责：

- 编写业务流程；
- 直接查询数据库；
- 直接调用 ffmpeg 或第三方 SDK；
- 组合多个业务 Service。

简单的系统操作，例如打开文件选择框、获取应用版本，可以直接放在
Controller 中，不必为了几行代码强行新建 Service。

### 2.2 Service

Service 负责一个功能的业务流程和决策，例如：

- 创建观看记录；
- 执行翻译并写入缓存；
- 自动裁切学习片段；
- 更新任务状态。

Service 可以调用：

- Repository；
- Gateway；
- 基础能力 Service；
- 普通工具函数。

Service 不应直接依赖：

- `electron`；
- `drizzle-orm` 和数据库表定义；
- `fs`、`child_process`；
- OpenAI、axios 等第三方 SDK；
- 具体的 logger 实现。

一个 Service 如果同时负责业务决策、文件处理、第三方请求、数据库映射和
后台调度，并且已经难以理解，应拆出职责明确的辅助模块或 Service。

### 2.3 Infrastructure

Infrastructure 负责外部世界的具体实现：

- 数据库查询和数据映射；
- 文件系统操作；
- ffmpeg、whisper 进程；
- Electron API；
- 第三方网络服务；
- renderer 事件发送；
- 日志写入。

Infrastructure 可以依赖 Service 使用的类型，但 Service 不应反过来依赖
Infrastructure 的具体实现。

### 2.4 纯逻辑

复杂且适合脱离外部环境测试的逻辑，可以放在 Service 附近的普通模块中，
例如：

- 并发调度；
- 限流；
- 字幕解析；
- 词形匹配；
- 状态机。

简单的纯函数继续放在普通工具文件中。不要为了“分层完整”而创建
`kernel`、`manager` 等目录。

## 3. Service 之间如何调用

Service 之间可以调用，但必须保持单向关系：

```text
Controller
    ↓
用例 Service
    ↓
基础能力 Service / Repository / Gateway
```

用例 Service 是 Controller 直接调用的入口，代表一个完整用户动作，例如：

- `ConvertService`
- `WatchHistoryService`
- `VideoLearningService`
- `TranslationService`

基础能力负责可复用的单一能力，例如：

- `DpTaskService`
- `FfmpegService`
- `WordMatchService`
- `CacheService`
- `StorageService`

约定：

- Controller 尽量只调用一个用例 Service；
- 用例 Service 可以调用多个基础能力；
- 基础能力不要反过来调用用例 Service；
- Service 之间不能形成循环依赖；
- 两个 Service 需要共享逻辑时，提取普通函数或独立能力模块；
- 不为了禁止互调而引入事件总线、CQRS 等复杂机制。

例如：

```text
ConvertController
    → ConvertService
        → DpTaskService
        → FfmpegService
```

下面这种关系应当避免：

```text
TagService
    → FavouriteClipsService
        → TagService
```

如果一个 Controller 同时调用多个 Service，通常说明编排逻辑应该下沉到
一个用例 Service。

## 4. 什么时候需要抽接口

不是所有依赖都必须创建 Port 或接口。只有在下面情况使用：

- 业务代码需要隔离数据库、文件系统或第三方服务；
- 测试需要替换真实依赖；
- 外部实现比较复杂或未来可能更换；
- 一个能力被多个业务模块复用。

适合抽接口的例子：

- `FfmpegGateway`
- `RendererGateway`
- `SettingsStore`
- `WatchHistoryRepository`
- `SpeechRecognitionGateway`

不必抽接口的例子：

- 纯函数；
- 简单的字符串或对象转换；
- 只使用一次的小工具；
- 没有业务判断的简单路径处理。

接口中只使用业务类型或普通 TypeScript 类型，不要暴露 Drizzle 表类型、
SDK 类型或 Electron 类型。

## 5. 类型放置

- IPC 请求和响应：`src/common/api/**`；
- 跨进程共享的 DTO/VO：`src/common/contracts/**`；
- 后端内部类型：靠近对应的 Service；
- 数据库表、插入类型、查询行类型：只放在 `infrastructure/db/**`；
- 纯工具类型：放在 `common/utils` 或后端自己的 `utils`。

新代码不要继续往 `common/types` 增加跨进程类型。历史类型可以在修改
相关功能时逐步迁移，不要求一次性清理。

## 6. IPC 约定

- IPC 路径统一在 `src/common/api/api-def.ts` 声明；
- 路径使用 `<domain>/<action>` 格式，例如 `watch-history/update-progress`；
- Controller 负责注册路径；
- Service 不感知 IPC；
- 高频请求和敏感数据避免记录完整参数或返回值；
- 用户取消任务和真正失败要区分处理。

IPC 类型只是编译期约束。文件路径、设置项、枚举值等外部输入，仍要在
进入业务逻辑前进行必要的运行时检查。

## 7. 数据库和迁移

- Drizzle 表定义只能放在 `src/backend/infrastructure/db/tables/`；
- 数据库查询和映射放在 `src/backend/infrastructure/db/`；
- Service 不直接写 SQL；
- 迁移文件由 Drizzle 生成，不手动修改 `drizzle/migrations/`；
- 修改表结构时，先改 schema，再运行 `yarn drizzle-kit generate`。

简单查询不必过度抽象。查询涉及多个表、数据映射或业务规则时，再放入
Repository。

## 8. 并发和后台任务

遇到以下问题时，先阅读 `docs/concurrency-kernel-usage.md`：

- ffmpeg、ffprobe、whisper 并发；
- 翻译、TTS、腾讯 API 限流；
- 视频分析队列；
- 锁、重入、取消和让步调度。

后台任务要明确：

- 谁负责启动；
- 是否允许重复启动；
- 如何取消；
- 应用退出时如何清理。

不要在普通 IPC 请求中偷偷启动长期后台循环。简单任务可以直接由 Service
管理；复杂队列再拆出调度模块。

## 9. 日志

- main 进程使用 `getMainLogger('<Module>')`；
- renderer 使用 `getRendererLogger('<Module>')`；
- 日志文件使用 JSON Lines（`.jsonl`），每行必须是一个完整 JSON 对象；
- 稳定字段包括 `schemaVersion`、`timestamp`、`level`、`process`、`module`、`message`，请求链路按需包含 `traceId` 和 `data`；
- renderer 发起 IPC 时生成 trace ID，main 进程在 IPC 边界通过异步上下文自动贯穿后端日志；
- 日志参数应放进结构化 `data`，不要把 `path=value`、对象预览等信息拼进 `message`；
- 不要在业务代码中留下长期的临时调试日志；
- 日志中不能写入 API Key、Authorization、完整敏感配置或不必要的大对象。

## 10. 依赖方向

推荐依赖方向：

```text
controllers → services
services → infrastructure / common
infrastructure → common
ioc → controllers / services / infrastructure
common → 不依赖 backend 和 fronted
```

禁止出现：

- Service 依赖 Infrastructure 中不必要的具体实现；
- `fronted → backend`；
- `common → backend`；
- Service 或接口直接引用 Drizzle、Electron、第三方 SDK 类型。

这里的目标是控制依赖方向，不是要求每个调用都经过三层。

## 11. 历史代码和重构原则

不要求一次性重写历史代码。

修改旧代码时遵循以下顺序：

1. 先修正当前功能的根本问题；
2. 新增代码遵守本规范；
3. 如果旧代码阻碍修改，再进行必要的局部拆分；
4. 删除已经没有用途的兼容分支和死代码；
5. 不为了“看起来分层”而增加无实际价值的接口和目录。

旧目录中的 `services/impl`、`common/types` 等历史结构可以逐步迁移。
除非正在修改相关功能，不需要专门发起全项目搬迁。

## 12. 最简单的判断方法

新增代码时，只问自己四个问题：

1. 这是 IPC 适配，还是业务流程？
2. 它是否直接依赖 Electron、数据库、文件系统或第三方服务？
3. 如果依赖外部能力，它是否应该放到 Infrastructure？
4. 这个依赖是否真的需要抽成接口？

通常按下面方式处理即可：

```text
接收 IPC 参数        → Controller
做业务判断和编排     → Service
访问数据库/文件/SDK   → Infrastructure
复杂纯逻辑           → 普通模块
跨进程共享类型       → common
```

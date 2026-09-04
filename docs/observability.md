# 可观测性与日志排障手册

本文档说明 DashPlayer 的日志产出位置、字段语义、检索键约定，以及"只用 grep/jq 读日志文件"时如何还原一次故障的完整因果链。

面向的读者是后续排查问题的 AI Agent 与维护者：项目功能主要由 AI 实现，人工把控有限，因此**任何排障都应先以日志为唯一证据源**，而不是先猜代码。

## 1. 日志位置与命名

- 根目录是 Electron `userData` 下的 `logs`，开发环境自动追加 `-dev` 后缀，因此开发与已安装的生产版本互不覆盖：
  - macOS 开发：`~/Library/Application Support/DashPlayer/logs-dev/`
  - macOS 生产：`~/Library/Application Support/DashPlayer/logs/`
- 文件名 `main-YYYY-MM-DD.jsonl`，按**本地日期**切分；记录内部时间戳一律 UTC ISO 8601，两者不要混淆。
- 单文件超过 **4 MiB** 即归档为 `main-YYYY-MM-DD.<seq>.jsonl`（`seq` 从 1 递增到第一个空位）。归档用序号而不是默认的固定 `.old`，因为固定名会在同日第二次轮转时**覆盖上一份证据**。
- 落盘、轮转与预算清理都由 `simple-logger` 自己实现（同步 `appendFileSync` + 同进程内序号重命名），不依赖任何第三方日志库，因此"什么时候归档、归档会不会丢证据"完全由本项目语义决定。每次归档当场补记一条 `module: logger-rotate` 的 `log archived`（含 `archivedPath`、`bytes`）；落盘本身失败时不抛给业务，恢复成功后补记 `log write failed`（含 `error` 与累计 `failedCount`）——日志系统自身的故障也必须有证据。
- 清理策略：保留 14 天；同时整个目录预算 **128 MiB**，超预算时按修改时间升序删除已归档文件，**当天正在写入的文件永不删除**。进程启动 60 秒后先跑一次，之后每 24 小时跑一次（`initLogMaintenance`）。
- renderer 进程没有独立日志文件：它经 `preload` 的 `dpLogger.write` 发 `dp-log/write` 送到 main 统一落盘。该投递若失败（preload 未挂载、通道不可用），会直接在浏览器控制台打 `[dp-log] renderer log write failed`，不会静默断链——排查 renderer"日志为什么没落盘"时先看 DevTools。

排查前先看目录状态：

```bash
ls -lt "$HOME/Library/Application Support/DashPlayer/logs-dev" | head
du -sh "$HOME/Library/Application Support/DashPlayer/logs-dev"
```

如果目录里出现 `main-<day>.old.jsonl`，说明该文件由旧版轮转策略产生（历史遗留）；出现 `main-<day>.<seq>.jsonl` 才是当前轮转生效的证据。

## 2. 逐字段规范

每行是一个完整 JSON 对象（`schemaVersion: 1`）：

| 字段 | 含义 | 注意点 |
|---|---|---|
| `schemaVersion` | 结构版本，当前固定 1 | 分析脚本按它判定是否结构化 |
| `appVersion` | 产生日志的软件版本 | |
| `runId` | **一次应用生命周期**的 32 位十六进制标识 | 崩溃循环会把多次启动写进同一天的同一文件，切分会话只能靠它 |
| `pid` | 主进程号 | renderer 记录的 `runId`/`pid` 同样是 main 的（由 main 落盘），代表同一次应用生命周期 |
| `timestamp` | UTC ISO 8601 | |
| `level` | `debug` / `info` / `warn` / `error` | |
| `process` | `main` / `renderer` | |
| `module` | 稳定的模块名（见第 3 节） | 由 `getMainLogger('<Module>')` / `getRendererLogger('<Module>')` 决定 |
| `message` | 简短、可检索的事件名 | 约定不拼参数，参数一律进 `data` |
| `traceId` | 单次 IPC 调用链 | 由 preload 生成、main 在 IPC 边界写入异步上下文，自动贯穿，无需显式传 |
| `data` | 已脱敏裁剪的结构化上下文 | |

`data` 的自动约束（`sanitizeValue`）：

- 递归深度 ≤ 5，对象键数 ≤ 50（超出记 `__truncatedKeys`），数组长度 ≤ 50（超出追加 `"[Truncated N items]"`）；
- **字符串超过 4000 字符是"保头丢尾"**，而 ffmpeg/sherpa 的致命错误恰恰在输出末尾；
- `Error` 序列化为 `{ name, message, stack, cause }`，若错误对象自带 `statusCode`/`responseBody`（AI SDK 等第三方错误的 upstream 证据）会一并保留；命中敏感键名的值替换为 `***`。

由此得出一条硬约束：**可能很长的文本必须以"行数组"入 `data`**，例如 `stderrTail: string[]`。这样尾部关键行是若干独立短字段，不会被整体截断。

## 3. 检索键约定

三类键，用途不同，不要互相替代：

### 3.1 `traceId`：一次 IPC 请求

preload 每次 `invoke` 生成一个 trace id，main 在 `registerRoute` 边界进入异步上下文，因此该请求内所有 main 侧日志自动带同一个 `traceId`。

- 适用：用户点一下按钮 → 一次 IPC → 若干后端日志。
- **禁止**把 IPC 的 `traceId` 绑定到后台长任务/队列延后 `drain()` 的场景：那时继承的 traceId 属于另一次请求，比没有 trace 更误导。

### 3.2 `job`：一次后台任务

后台任务（转码、转录、片段裁切、分章）用统一的 `data.job` 字符串贯穿 service → ffmpeg/识别子进程首尾。取值约定：

| job 形态 | 来源 | 产出位置 |
|---|---|---|
| `dp_task:<id>` | `dp_task` 表主键，转码/字幕提取等带任务 ID 的链路 | `FfmpegServiceImpl` → `FfmpegGatewayImpl` |
| `transcription:<媒体绝对路径>` | 本地转录不挂 `dp_task`，路径即稳定身份 | `LocalTranscriptionService`、WAV 切片 ffmpeg、`SherpaOnnx` |
| `clip:<clipKey>` | 学习片段 / 收藏片段 | `VideoLearningServiceImpl`、`FavouriteClipsService` → 裁切 ffmpeg |
| `split:<输出目录>` | 分章切段 | `FfmpegServiceImpl` → `splitVideoByTimes` |

无 `job` 的子进程日志（例如单次 ffprobe、缩略图）靠 `spawned ffmpeg` 里的完整 `command`（含输入输出路径）归因。

### 3.3 `module`：模块面

排障常用模块清单：

| module | process | 负责什么 |
|---|---|---|
| `ipc` | main | 每条 IPC 的 `ipc request started/completed/cancelled/failed`，含 `path`、`durationMs`、`result`/`error` |
| `MainStartup` | main | `app ready`（含 `runtimeVersions`）、`gpu feature status` |
| `ProcessWatchdog` | main | 崩溃/白屏/卡死类进程事件（见第 5 节） |
| `RendererGateway` | main | renderer API 调用生命周期：`renderer api call dispatched` / `renderer api call settled`（带 `callId`、`outcome`、`elapsedMs`）/ `renderer api call dropped` |
| `RendererEvents` | main | main → renderer 的推送；窗口不可用时的 `renderer event dropped`（按通道窗口合并，带 `suppressedCount`）；`task status pushed to renderer` 只在状态跃迁时记录 |
| `FfmpegServiceImpl` | main | 只记录网关看不到的任务体异常（`ffmpeg task failed`，含 `job`）；子进程失败与取消不在这里重复 |
| `FfmpegGatewayImpl` | main | `spawned ffmpeg`（`job`/`pid`/`command`）、`FFmpeg 执行完成`、`FFmpeg 执行失败`（error，含 `exitCode`/`pid`/`stderrTail`）、`FFmpeg 已取消`（info）——子进程维度的唯一证据点 |
| `SherpaOnnx` / `SherpaTts` | main | 识别/合成子进程启停与异常退出：`spawned sherpa-onnx`、`sherpa-onnx exited abnormally`、`sherpa-onnx output rejected`、`sherpa-onnx cancelled` |
| `LocalTranscriptionService` | main | `transcription started`、分段识别重试与耗尽、`transcription done`/`transcription cancelled`/`transcription failed` 任务收尾（含 `elapsedMs`，done 另带 `chunkCount`/`srtPath`）——`job` 首尾成对靠这三条收尾闭环 |
| `VideoLearningServiceImpl` | main | `clip trim started` / `clip ready` / 片段任务失败 |
| `concurrency` | main | 信号量/限流等待与持锁超阈值（见第 4 节） |
| `GlobalError` | renderer | `uncaught exception`、`unhandled rejection`、`resource load failed` |
| `ErrorBoundary` | renderer | `react render error`，唯一带 React `componentStack` 的记录 |
| `MainUncaught` | main | `main uncaught exception`、`main unhandled rejection`：JS 层未被任何 catch 接住的异常，不接住就永远消失 |
| `logger-rotate` / `logger-prune` | main | 归档事实（`log archived`）、落盘失败补记（`log write failed`）、目录清理结果 |

## 4. 级别与噪声预算

- 默认级别：开发 `debug`，生产 `info`。
- `debug` 允许逐行输出（如 `ffmpeg stderr line`），但**任何新增高频日志都要先算进 4 MiB/128 MiB 预算**。播放相关的每帧/50ms 级状态（如精确播放时间）**禁止**打日志。
- 级别语义：
  - `info`：一次操作的边界事件（启动、完成、状态跃迁），要能凭它画出时间线；
  - `warn`：可继续但需要解释的现象（用户取消、事件被丢弃、重试、慢等待）；
  - `error`：需要人看的原因（异常退出、渲染崩溃、加载失败）。
- 重复抑制（共享实现 `createWindowedDeduper`）：renderer 侧同名异常、main 侧按通道丢弃都走同一套语义——窗口内只落首条，**窗口结束时补记的仍是首条原消息**，附带 `suppressedCount` 与 `windowMs`（历史遗留的 `repeated error suppressed` 独立消息已废弃）。因此按 `message` 聚合时不会丢掉计数，也不会因为换了消息文本而看不出刷屏源头。之所以要合并，是 `ErrorBoundary` 会被逐字组件复用，一次崩溃可能触发 N 次回调。
- 并发内核阈值：等待 > 500ms 记 `semaphore wait passed`（debug）；**持有期间**满 5s 当场记 `long hold detected`（warn，字段 `name`/`kind`/`heldMs`/`queueLen`/`inUse`/`capacity`），不等 release——任务卡死把锁占死这类故障永远走不到释放，只有持有期间的定时器能在卡住的当场留下证据；`kind` 为 `mutex` 时说明是排他锁排队。
- 取消判定只认异常类型名（`isUserCancellation`：`AbortError`/`CanceledError`/`CancelByUserError`，常量集中在 `common/utils/cancellation`，抛出端与判定端共用同一字面量），不再用消息正则。原因：`/cancel|取消/i` 会把 `Failed to cancel the download`、以及 stderr 正文里带 `SIGTERM`/`killed` 的真实故障误判成预期取消并降级。子进程被用户取消时由执行器直接抛 `CancelByUserError`，被系统 OOM kill 则仍是失败记录。
- 禁止用 fallback 掩盖问题：日志层面同样成立——归档失败先记 `error` 再抛出，窗口销毁丢事件必须记 `renderer event dropped`，而不是静默 `return`。

## 5. 崩溃面清单

`initProcessWatchdog`（`module: ProcessWatchdog`）覆盖以下 Electron 事件：

| message | 级别 | 关键字段 | 说明 |
|---|---|---|---|
| `render process gone` | error（`clean-exit` 时 info） | `reason`、`exitCode`、`url`、`webContentsId`、`osProcessId`、`isDevelopment` | 渲染进程消失（崩溃、OOM、被 kill） |
| `child process gone` | error（同上） | `processType`、`reason`、`exitCode`、`processName`、`serviceName`、`isDevelopment` | 含 GPU 进程；Electron 39 **没有** `gpu-process-gone` 事件，GPU 崩溃从这里来（`processType === 'GPU'`） |
| `renderer did fail load` / `renderer did fail provisional load` | warn | `errorCode`、`errorDescription`、`validatedURL`、`isMainFrame` | 白屏/黑屏第一手证据；不对 `-3(ABORTED)` 做静默过滤 |
| `renderer unresponsive` / `renderer responsive again` | warn / info | `webContentsId`、`url`、`osProcessId` | 界面冻结的时间区间 |
| `renderer preload error` | error | `preloadPath`、`error` | preload 抛错（Electron 事件 `preload-error`），通常导致 `window.electron` 缺失 |
| `web contents destroyed` | debug | `webContentsId` | 与 `renderer event dropped` 对齐，解释"事件为何没送到" |

renderer 侧异常由 `initGlobalErrorLogging`（`module: GlobalError`）落盘：

- `uncaught exception`：`message`、`filename`、`lineno`、`colno`、`error`；
- `unhandled rejection`：`reason` 原样进 `data`，用户主动取消降为 `warn`；
- `resource load failed`：`tagName`、`src`、`pageUrl` —— 监听走**捕获阶段**，所以 `<video>`/字幕这类元素级 `error` 也会被记录，这是播放故障最直接的证据；
- 组件渲染崩溃另有 `ErrorBoundary` / `react render error`，携带 `componentStack`。

**刻意不接** `console-message`：它与既有 renderer 结构化日志重复，且会吃掉配额。

主进程 JS 层未捕获异常由 `initLogMaintenance` 注册的 `process.on('uncaughtException' / 'unhandledRejection')` 兜底，落盘为 `module: MainUncaught` 的 `main uncaught exception` / `main unhandled rejection`（只记录，不改变进程行为）。它与 `ProcessWatchdog` 互补：看门狗管"进程级死亡"，这里管"异常没被任何 catch 接住"。

## 6. 环境变量

main 与 renderer 是两套（renderer 走 Vite 编译期注入，必须以 `VITE_` 开头）：

| 变量 | 作用 |
|---|---|
| `DP_LOG_LEVEL` | main 最低输出级别：`debug`/`info`/`warn`/`error`；未设置时开发 `debug`、生产 `info` |
| `VITE_DP_LOG_LEVEL` | renderer 级别，未设置时 `info` |

只有级别一个开关：写入端全量落盘，收窄一律发生在**读取端**。需要只看某条链路时按 `module` 字段过滤，而不是让证据在写盘前就消失：

```bash
grep '"module":"FfmpegGatewayImpl"' main-*.jsonl
grep -E '"module":"(FfmpegGatewayImpl|ProcessWatchdog|GlobalError)"' main-*.jsonl
```

磁盘吃紧时优先降低级别（`DP_LOG_LEVEL=info`）而不是放大预算。历史上曾有 `DP_LOG_INCLUDE_MODULES` / `DP_LOG_EXCLUDE_MODULES` 这类写入端模块白/黑名单，已移除——它会在排障前就丢掉现场，不要重新加回。

## 7. AI 排障配方

以下命令在 macOS 开发环境下执行；把 `logs-dev` 换成 `logs` 即生产。

```bash
cd "$HOME/Library/Application Support/DashPlayer/logs-dev"
LATEST=$(ls -t main-*.jsonl | head -1)
```

### 7.1 取最新一次会话

```bash
jq -r '.runId' "$LATEST" | tail -1                       # 最新 runId
RUN=$(jq -r '.runId' "$LATEST" | tail -1)
jq -c 'select(.runId == env.RUN)' "$LATEST" > /tmp/run.jsonl   # 该次会话的完整时间线
jq -r '.runId' main-*.jsonl | sort -u                    # 有几次启动
```

跨轮转回溯要按文件名序号从大到小一起读：`main-<day>.3.jsonl` 早于 `main-<day>.2.jsonl`。

### 7.2 按 traceId 串一次 IPC

```bash
grep '"module":"ipc"' "$LATEST" | grep '"message":"ipc request failed"' | jq -c '{timestamp,path:(.data.path),error:.data.error.message}'
# 拿到 traceId 后还原整条链
grep '"traceId":"<TRACE>"' "$LATEST" | jq -c '{timestamp,module,message}'
```

### 7.3 按 job 串一次后台任务

```bash
grep -o '"job":"[^"]*"' "$LATEST" | sort | uniq -c | sort -rn          # 有哪些任务、各自多少条日志
grep '"job":"clip:xxx"' "$LATEST" | jq -c '{timestamp,process,module,message}'
grep '"job":"transcription:' "$LATEST" | grep -E '"message":"(transcription started|spawned ffmpeg|spawned sherpa-onnx|.*失败|.*abnormally)"'
```

同一个 `job` 应当"首尾成对"：只有 `transcription started` / `clip trim started` 而没有收尾记录，就是中途炸掉或被静默吞掉。

### 7.4 error / warn 时间线

```bash
jq -c 'select(.level=="error" or .level=="warn") | {timestamp,level,process,module,message}' "$LATEST" | head -50
```

### 7.5 崩溃与白屏

```bash
grep -E '"module":"(ProcessWatchdog|GlobalError|ErrorBoundary)"' "$LATEST" | jq -c '{timestamp,level,module,message,data:(.data|keys)}'
grep -E 'render process gone|child process gone' "$LATEST" | jq -c '.data'
grep 'resource load failed' "$LATEST" | jq -c '{timestamp,src:.data.src,tag:.data.tagName}'   # 媒体/字幕资源失败
```

### 7.6 时间窗切片

```bash
jq -c 'select(.timestamp >= "2026-08-30T03:10:00Z" and .timestamp <= "2026-08-30T03:20:00Z")
       | {timestamp,level,process,module,message}' "$LATEST"
```

### 7.7 IPC 失败率与慢调用 top-N

```bash
grep '"module":"ipc"' "$LATEST" | jq -r '.data.path' | sort | uniq -c | sort -rn | head    # 调用量
grep '"module":"ipc"' "$LATEST" | grep -E '"message":"ipc request (failed|cancelled)"' | jq -r '.data.path' | sort | uniq -c | sort -rn
grep '"message":"ipc request completed"' "$LATEST" | jq -r 'select(.data.durationMs > 300) | "\(.data.durationMs)ms \(.data.path)"' | sort -rn | head
```

### 7.8 并发瓶颈

```bash
grep '"module":"concurrency"' "$LATEST" | grep -E 'long hold detected|wait passed|acquire timeout' | jq -c '{timestamp,message,name:.data.name,kind:.data.kind,heldMs:.data.heldMs,waitMs:.data.waitMs,queueLen:.data.queueLen}'
```

`long hold detected` 在锁被占住的当场就会触发，因此它后面若一直没有对应的释放/完成记录，就是任务把锁占死；用同一条记录的 `name` 与时间窗去对齐 `job` 或 `traceId`，即可定位卡住的具体任务。

### 7.9 自检：轮转是否真的生效

```bash
ls | grep -E 'main-[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+\.jsonl' || echo "尚无归档：未触发轮转或日志量不足"
ls | grep -E '\.old\.jsonl' && echo "存在历史 .old 文件（旧策略遗留），确认它没被当成当前归档"
grep -E '"message":"(log archived|log write failed)"' "$LATEST" | jq -c '{timestamp,message,archivedPath:.data.archivedPath,bytes:.data.bytes,failedCount:.data.failedCount}'
```

若某天的主文件仍停留在 1 MiB 附近却没有 `.1.jsonl`，说明轮转配置未生效（多半是运行中的实例仍是改动前的构建）。

## 8. 症状 → 看哪条日志 → grep 什么

| 症状 | 先查 | 命令要点 |
|---|---|---|
| 播放黑屏/画面卡住、硬解异常 | `GlobalError` 的 `resource load failed`、`PlayerEngine` 的 media 事件、`ProcessWatchdog` 的 GPU 进程消失 | `grep -E 'resource load failed\|child process gone'` |
| 界面白屏、窗口打开即空 | `renderer did fail load`、`renderer preload error` | 看 `errorCode`、`validatedURL` |
| 整个应用偶发闪退 | `render process gone` / `child process gone`，再往前 20 行看最后一条 info | 用 `runId` 限定本次会话 |
| 字幕转录卡住不动 | `transcription started` 是否有、分段重试 warn、`long hold detected`（whisper 锁） | `grep '"job":"transcription:<路径>"'` |
| 转录/转码报错但没有原因 | `FfmpegGatewayImpl` 的 `FFmpeg 执行失败`、`SherpaOnnx` 的 `sherpa-onnx exited abnormally` 的 `stderrTail` 数组 | `jq '.data.stderrTail'`，不要看 `error.message`（会被截断） |
| 学习片段没生成 | `clip trim started` 有、`clip ready` 没有 → 中间失败；再查片段任务失败 error | `grep '"job":"clip:'` |
| 提示没弹出来 / 状态没刷新 | `RendererEvents` 的 `renderer event dropped`（窗口销毁/不可用）与 `web contents destroyed` 对齐 | `grep -E 'renderer event dropped|web contents destroyed'` |
| 操作很慢 | `ipc request completed` 的 `durationMs`；再看 `concurrency` 的 `wait passed` / `long hold detected` | 见 7.7、7.8 |
| 反应崩溃、组件树报错 | `ErrorBoundary` 的 `react render error`（含 `componentStack`） | `jq '.data.componentStack'` |
| 同一错误刷屏 | 窗口结束补记的那条就是原消息，带 `suppressedCount` | `jq -c 'select(.data.suppressedCount) | {module,message,count:.data.suppressedCount}'`，说明抑制生效，不必再逐条看 |

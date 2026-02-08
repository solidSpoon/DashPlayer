---
name: log-focus-debug
description: 'DashPlayer 日志聚焦调试技能。Use when developers ask to reduce noisy logs, focus on one feature log chain, add temporary focus markers (e.g. [FOCUS:token]), or clean up temporary debug logs after task completion. Triggers on: "日志太乱", "只看某个功能日志", "focus token", "withFocus", "临时日志标记", "清理调试日志".'
---

## 目的

在 DashPlayer 中快速建立“只看当前功能点日志”的调试闭环，并确保临时日志标记在任务结束后被清理。

## 适用范围

- Main + Renderer 全链路日志调试
- 临时功能聚焦（短期）
- AI 辅助排障与回收

## 先决条件

1. 确认项目日志能力已可用：
   - `DP_LOG_LEVEL` / `VITE_DP_LOG_LEVEL`
   - `DP_LOG_INCLUDE_MODULES` / `DP_LOG_EXCLUDE_MODULES`
   - `VITE_DP_LOG_INCLUDE_MODULES` / `VITE_DP_LOG_EXCLUDE_MODULES`
   - `DP_LOG_FOCUS_TOKEN` / `VITE_DP_LOG_FOCUS_TOKEN`
2. 确认 logger API 可用：
   - Main: `getMainLogger('Module').withFocus(token)`
   - Renderer: `getRendererLogger('Module').withFocus(token)`

## 标准操作流程

### 1) 定义本次调试 token

使用稳定命名：`<feature>-<yyyymmdd>`，例如：`player-speed-20260207`。

### 2) 开启聚焦过滤

在 `.env` 中设置：

```bash
DP_LOG_LEVEL=debug
VITE_DP_LOG_LEVEL=debug
DP_LOG_FOCUS_TOKEN=player-speed-20260207
VITE_DP_LOG_FOCUS_TOKEN=player-speed-20260207
```

可选叠加模块过滤：

```bash
DP_LOG_INCLUDE_MODULES=PlaybackService,PlayerWithControlsPage,SpeedSlider
VITE_DP_LOG_INCLUDE_MODULES=PlayerWithControlsPage,SpeedSlider
```

### 3) 注入临时聚焦日志

优先使用 `withFocus`：

```ts
const mainLogger = getMainLogger('PlaybackService').withFocus('player-speed-20260207');
mainLogger.debug('sync playback rate', { rate, source });

const rendererLogger = getRendererLogger('SpeedSlider').withFocus('player-speed-20260207');
rendererLogger.debug('speed changed by user', { rate });
```

兼容写法（仅临时）：

```ts
logger.debug('[FOCUS:player-speed-20260207] speed changed', { rate });
```

### 4) 验证

- 控制台仅出现目标功能链路
- 主进程落盘日志仅包含目标 token（在设置了 `DP_LOG_FOCUS_TOKEN` 时）

## 清理规约（必须执行）

任务结束时必须移除临时标记，避免调试噪音进入长期代码。

1. 搜索：

```bash
rg "\\[FOCUS:|withFocus\\(" src
```

2. 删除本次任务临时加的 `withFocus(...)` 与 `[FOCUS:...]`。
3. 保留有长期价值的结构化日志字段（如关键业务上下文），但去掉临时 token。
4. 运行最小验证：

```bash
yarn eslint -c .eslintrc.react-compiler.json <touched-files>
```

5. 再次搜索，确保零残留。

## 输出约定

当使用本技能时，agent 应在回复中明确：

- 当前 focus token
- 影响的模块范围（main/renderer）
- 已注入的临时标记点
- 清理是否完成（附搜索结果结论）

# e2e 测试指南

> 用 Playwright 驱动真实 Electron 应用，覆盖跨进程链路。新增用例前先读本文档；通用测试原则见 [testing-guidelines.md](./testing-guidelines.md)。

## 1. 定位

- **测什么**：单元测试覆盖不到的跨进程链路——真实界面操作 → preload IPC → 主进程 → 数据库/配置文件，例如启动门槛、引导流程、设置项落盘与重启持久化。
- **不测什么**：能用 vitest 覆盖的（纯函数、服务层、业务组件）不写在这里；第三方代码不测。
- **要求**：少而稳，只保关键链路；用例独立、可重跑、失败信息能直接定位到坏在哪一环。

## 2. 运行

```bash
yarn test:e2e    # 构建 + 跑全部用例（日常用这个）
yarn e2e:build   # 只重新构建 .vite 产物（改了 src 后需要）
yarn e2e:run     # 只跑用例（仅改 e2e/ 下的测试时）
```

- 用例串行执行（`workers: 1`）；单条用例真实启动一次应用，约 2~4 秒；构建约 25 秒。
- 首次运行会按需下载 Electron 二进制到 `node_modules/electron`，需要网络。
- 目前未接入 CI，PR 前本地跑通 `yarn test:e2e` 即可。

## 3. 工作原理

- **只能走开发态**：打包产物被 FusesPlugin 关闭 `--inspect`，Playwright 无法接管；因此用例以 `electron .` 启动，读取 `.vite/` 构建产物。
- **构建脚本**：`e2e/build.mjs` 复用 forge 的 Vite 配置（`ViteConfigGenerator`）生成 `.vite/build` + `.vite/renderer/main_window`；不需要 `yarn download` 拉取的原生资源（whisper / ffmpeg 等不参与）。
- **数据隔离**：每个用例独占临时 userData 目录（`--user-data-dir`），数据库、日志、配置全部落在里面，用例结束自动删除；启动后立刻校验隔离生效，一旦 `--user-data-dir` 失效会尽早失败，避免写坏本机真实数据。
- **越过首次引导**：引导完成标记存在数据库里、启动前无法预置；fixture 通过真实 IPC（与应用内「跳过」同一个后端入口 `system/config/set`）写入标记后 `page.reload()`，让启动门槛重新判定，全程不使用 mock。

开发态与生产路径的区别（写断言时会用到）：

| | 生产 | 开发态（e2e 跑的） |
|---|---|---|
| 数据库 | `data/dp_db.sqlite3` | `data-dev/dp_db.sqlite3` |
| 日志 | `logs/` | `logs-dev/` |
| 配置 | `config.json` | `config.dev.json` |

## 4. 基建 API（`e2e/fixtures.ts`）

| 导出 | 用途 |
|---|---|
| `test` | 扩展后的 test，提供下面两个 fixture |
| `session` | 已启动并处于主界面的应用会话，`session.page` 可直接操作 |
| `userDataDir` | 用例独占的临时 userData 目录，用例结束自动清理 |
| `launchAppSession(userDataDir)` | 手动启动一次会话，重启场景用 |
| `readConfigValue(userDataDir, 'a.b')` | 读配置文件里的嵌套值（如 `appearance.theme`） |

```typescript
// 普通用例：直接拿 session
test('...', async ({ session, userDataDir }) => { /* ... */ });

// 重启场景：不用 session fixture，自己控制两次启动
const first = await launchAppSession(userDataDir);
// ...操作...
await first.close();
const restarted = await launchAppSession(userDataDir);
```

## 5. 新页面用例怎么写

参考实现：`e2e/appearance-settings.spec.ts`（外观设置页）。

1. **入口定位用 getByRole**：`link` / `button` / `heading` + 中文文案（fixture 已固定 `i18n.language: 'zh-CN'`，不随宿主系统语言漂移）；避免 CSS 选择器。
2. **断言"操作 → 可观测结果"**：界面状态（类名 / DOM）+ 持久化结果（配置文件 / 数据库）。只断言界面容易假通过——界面变了但防抖保存没跑起来就看不出来。
3. **用自动重试的断言**：`expect(locator).toHaveClass()`、`expect.poll()` 等；不要用 `waitForTimeout` 硬等。
4. **用例互相独立**：每条用例都是全新进程 + 全新数据目录，不要依赖其他用例或执行顺序。
5. **文案用中文白话**：describe / it 描述真实业务行为，与 vitest 用例风格一致。

新文件骨架：

```typescript
import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';

/** 进入 xxx 设置页：首页「设置中心」→ 侧边栏「xxx」。 */
async function openXxxSetting(page: Page): Promise<void> {
    await page.getByRole('link', { name: '设置中心' }).click();
    await page.getByRole('link', { name: 'xxx' }).click();
    await expect(page.getByRole('button', { name: 'xxx' })).toBeVisible();
}

test.describe('xxx 设置', () => {
    test('改动后立即生效并写入配置', async ({ session, userDataDir }) => {
        await openXxxSetting(session.page);
        // 操作 + 断言 UI 与配置文件
    });
});
```

## 6. 红线

- **禁止 mock 应用内部实现**（IPC、仓储、服务）：e2e 的价值就是验证这些真实边界。
- **禁止复用会话或数据目录来"提速"**：会引入用例顺序依赖；每条用例必须独立启动。
- **禁止为变绿放宽断言**（沿用 testing-guidelines 的原则 5）；删除功能时同步删除对应用例。
- 断言失败要能一眼看出坏点（UI 没生效 vs 没落盘），写断言时按这个标准取舍。

## 7. 已知坑

- **启动偶发停顿几十秒到几分钟（环境级，与 Playwright 无关）**：`launch()` 偶尔迟迟不返回，stderr 在 `Debugger listening` 后长期不出 `DevTools listening`；停顿期间应用就绪前的 JS（建库、迁移）已完成，但 Chromium 不 fork GPU 进程、不建 profile，恢复时一次性补齐。纯手动 `electron .` 同样复现（实测停顿 17 秒至 2 分钟以上），与本项目代码、`app.evaluate()`（实测 5~64ms 正常）无关；本机触发源为显示器切换器：把本机切走期间启动一律卡住（实测 12 分钟窗口内多次尝试无一例外），切回瞬间恢复，切回后重跑即可。遇到启动超时先查切换器状态与 `journalctl -k` 的外设事件，不要怀疑用例本身。
- **Chromium 开关必须用 `--flag=value` 等号形式**：`--user-data-dir <path>` 写成两个 token 会被解析成"无值开关 + 位置参数"，userData 静默回退到真实目录、污染开发数据。fixture 里是 `--user-data-dir=${dir}`（另有 `assertUserDataIsolated` 兜底）；手写启动脚本时容易踩。
- **`yarn install` 后 Electron 二进制可能缺失**：仓库里 `electron` 包的 postinstall 不落盘二进制，首次 `e2e:run` 会自动补下，日志出现 `Downloading Electron binary...` 属正常。
- **配置是嵌套 JSON**：electron-store 按点号访问，`appearance.theme` 在文件里存成 `{"appearance":{"theme":"dark"}}`；断言用 `readConfigValue`，不要按平铺 key 读。

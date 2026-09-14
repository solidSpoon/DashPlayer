# e2e 测试指南

> 用 Playwright 驱动真实 Electron 应用，覆盖跨进程链路。**测什么（场景清单与缺口）见 [test-cases/](./test-cases/)**；新增用例前先读本文档；通用测试原则见 [testing-guidelines.md](./testing-guidelines.md)。

## 1. 定位

- **测什么**：单元测试覆盖不到的跨进程链路——真实界面操作 → preload IPC → 主进程 → 数据库/配置文件，例如启动门槛、引导流程、设置项落盘与重启持久化。
- **不测什么**：能用 vitest 覆盖的（纯函数、服务层、业务组件）不写在这里；第三方代码不测。
- **要求**：少而稳，只保关键链路；用例独立、可重跑、失败信息能直接定位到坏在哪一环。

## 2. 运行

```bash
yarn test:e2e          # 校验用例文档 + 构建 + 跑全部用例（日常用这个）
yarn test:cases:check  # 只做「用例文档 ↔ 用例 ID」双向校验（秒级，改文档或删用例后单独跑）
yarn e2e:build         # 只重新构建 .vite 产物（改了 src 后需要）
yarn e2e:run           # 只跑用例（仅改 e2e/ 下的测试时）
```

- 用例串行执行（`workers: 1`）；单条用例真实启动一次应用，约 2~4 秒；构建约 25 秒。
- 首次运行会按需下载 Electron 二进制到 `node_modules/electron`，需要网络。
- 首次拉取本分支后要先装依赖：`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 yarn install`。`@playwright/test` 是这套基建引入的依赖；跳过浏览器下载是因为用例只用 Electron，用不到 Playwright 自带的 Chromium。
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

### 设置页公共工具（`e2e/settings-page.ts`）

设置页的导航与定位在各页面用例里是重复的，这部分抽到了独立模块：

| 导出 | 用途 |
|---|---|
| `openSettingsSection(page, '网络代理', ready)` | 从首页进「设置中心」再切到指定栏目，并等该页标志性元素出现 |
| `reloadSettingsPage(page, ready)` | 重新加载当前设置页（HashRouter 保留路由），验证值来自后端回读 |
| `selectInRow(page, 行内独有文案)` | 定位某一设置行里的下拉框；同页多个 Select 时按行缩小范围 |
| `chooseInRow(page, 行内独有文案, '选项文案')` | 在指定行点开下拉框并选中一项 |

## 5. 新页面用例怎么写

设置中心六个页面已全覆盖（22 条用例）。**每条用例测什么、哪些场景还是缺口，看 [docs/test-cases/](./test-cases/)（一个设置页一份文档）**；本文档只讲怎么写，按页面形态挑最近的抄：

| 页面形态 | 参考文件 |
|---|---|
| 按钮 / 档位切换 | `e2e/appearance-settings.spec.ts` |
| 文本输入（含「填了要真保存、重进要回显」范式） | `e2e/proxy-settings.spec.ts`、`e2e/storage-settings.spec.ts` |
| 下拉框与自定义提示词 | `e2e/service-resource-settings.spec.ts` |
| 弹窗内录制 / 保存 | `e2e/shortcut-settings.spec.ts` |
| 只读页（无可填字段的守卫） | `e2e/about-settings.spec.ts` |
| 保存时机（跨页面） | `e2e/settings-autosave.spec.ts` |

1. **入口定位用 getByRole**：`link` / `button` / `heading` + 中文文案（fixture 已固定 `i18n.language: 'zh-CN'`，不随宿主系统语言漂移）；避免 CSS 选择器。设置页导航走 `openSettingsSection`，不要手写点击链接——面包屑里可能出现同名链接。
2. **「用户填了但没保存」是这套用例的首要防范对象**：设置页没有保存按钮，改动由页面防抖自动保存，所以每条用例都按三段式写——① 操作控件；② `expect.poll(() => readConfigValue(...))` 断言值真进了配置文件；③ `reloadSettingsPage` 后断言界面回显。只做第 ① 步，或只断言界面 state，都可能在「保存链路断了」时假通过。涉及保存时机的用例还要多走一步「切到别的栏目再切回来」，因为整页 reload 会清掉前端缓存，验不到缓存过期一类的问题（见下面的已知坑）。
3. **断言"操作 → 可观测结果"**：界面状态（类名 / DOM）+ 持久化结果（配置文件 / 数据库）。
4. **用自动重试的断言**：`expect(locator).toHaveClass()`、`expect.poll()` 等；不要用 `waitForTimeout` 硬等。
5. **用例互相独立**：每条用例都是全新进程 + 全新数据目录，不要依赖其他用例或执行顺序。
6. **文案用中文白话**：describe / it 描述真实业务行为，与 vitest 用例风格一致。
7. **可填字段的页面要补一条失败路径**：三段式只能证明"保存成功"，证明不了"保存失败时用户看得见"。后端拒绝写入时（路径不可用、被功能占用等），页面必须把原因显式露出来，所以补一条用例：① 造一个后端必然拒绝的输入；② 断言 `page.getByRole('alert')` 可见且文案包含拒绝原因；③ 断言配置文件里的旧值没被覆盖。只断言界面报错、不断言值未落盘会漏掉"报错同时把坏值也写进去了"。

   以无写权限目录为例（`e2e/storage-settings.spec.ts`）：

   ```typescript
   // 把父目录设成只读，后端校验会真实失败（chmod 后无需还原，目录属于本用例）
   const readOnlyParent = path.join(userDataDir, 'read-only-parent');
   fs.mkdirSync(readOnlyParent);
   fs.chmodSync(readOnlyParent, 0o500);

   await libraryInput.fill(path.join(readOnlyParent, 'library'));

   const saveError = page.getByRole('alert');
   await expect(saveError).toBeVisible();
   await expect(saveError).toContainText('当前存储目录暂时无法访问');
   // 报错时旧值不能被覆盖
   expect(readConfigValue(userDataDir, 'storage.path')).toBe(initialPath);
   ```

   失败横幅统一加 `role="alert"`（`ProxySetting` / `ShortcutSetting` / `StorageSetting` 已加），既方便定位也补上无障碍语义。

标题开头的 `[SET-XXX-01]` 是用例 ID。先在对应页面的用例文档里写一段场景并挂上这个 ID（一个设置页一份，ID 规则见 [test-cases/README.md](./test-cases/README.md)），再把 ID 写进 `test()` 标题，`yarn test:cases:check` 会把两边对起来。

新文件骨架：

```typescript
import { expect, type Page } from '@playwright/test';
import { readConfigValue, test } from './fixtures';
import { openSettingsSection, reloadSettingsPage } from './settings-page';

/** 进入 xxx 设置页。 */
async function openXxxSetting(page: Page): Promise<void> {
    await openSettingsSection(page, 'xxx', page.getByRole('heading', { name: 'xxx' }));
}

test.describe('xxx 设置', () => {
    test('[SET-XXX-01] 填完 xxx 后落盘，重进页面仍回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openXxxSetting(page);

        await page.getByPlaceholder('占位符文案').fill('要保存的值');

        // 落盘：断言配置文件里的真实键
        await expect.poll(() => readConfigValue(userDataDir, 'xxx.yyy')).toBe('要保存的值');

        // 回显：重进页面后界面显示的是刚保存的值
        await reloadSettingsPage(page, page.getByRole('heading', { name: 'xxx' }));
        await expect(page.getByPlaceholder('占位符文案')).toHaveValue('要保存的值');
    });
});
```

## 6. 红线

- **禁止 mock 应用内部实现**（IPC、仓储、服务）：e2e 的价值就是验证这些真实边界。
- **禁止复用会话或数据目录来"提速"**：会引入用例顺序依赖；每条用例必须独立启动。
- **禁止为变绿放宽断言**（沿用 testing-guidelines 的原则 5）；删除功能时同步删除对应用例。
- **用例与文档同步改**：标题里的 ID 必须在对应页面的用例文档里登记为「自动化」，文档里标「自动化」的场景也必须有对应用例；只改一边会被 `yarn test:cases:check` 拦下。
- 断言失败要能一眼看出坏点（UI 没生效 vs 没落盘），写断言时按这个标准取舍。

## 7. 已知坑

- **启动偶发停顿几十秒到几分钟（环境级，与 Playwright 无关）**：`launch()` 偶尔迟迟不返回，stderr 在 `Debugger listening` 后长期不出 `DevTools listening`；停顿期间应用就绪前的 JS（建库、迁移）已完成，但 Chromium 不 fork GPU 进程、不建 profile，恢复时一次性补齐。纯手动 `electron .` 同样复现（实测停顿 17 秒至 2 分钟以上），与本项目代码、`app.evaluate()`（实测 5~64ms 正常）无关；本机触发源为显示器切换器：把本机切走期间启动一律卡住（实测 12 分钟窗口内多次尝试无一例外），切回瞬间恢复，切回后重跑即可。遇到启动超时先查切换器状态与 `journalctl -k` 的外设事件，不要怀疑用例本身。
- **Chromium 开关必须用 `--flag=value` 等号形式**：`--user-data-dir <path>` 写成两个 token 会被解析成"无值开关 + 位置参数"，userData 静默回退到真实目录、污染开发数据。fixture 里是 `--user-data-dir=${dir}`（另有 `assertUserDataIsolated` 兜底）；手写启动脚本时容易踩。
- **`yarn install` 后 Electron 二进制可能缺失**：仓库里 `electron` 包的 postinstall 不落盘二进制，首次 `e2e:run` 会自动补下，日志出现 `Downloading Electron binary...` 属正常。
- **配置是嵌套 JSON**：electron-store 按点号访问，`appearance.theme` 在文件里存成 `{"appearance":{"theme":"dark"}}`；断言用 `readConfigValue`，不要按平铺 key 读。
- **与默认值相同的写入根本不会落盘**：`storeSet` 发现新值等于当前值（含 schema 默认值）时直接返回、不写文件，所以默认档位的键在 `config.dev.json` 里是**不存在**的。想让某键出现在文件里，要先把它改成非默认值；断言"改回默认"时只能用重进页面回显，不能用 `readConfigValue` 断言等于默认值。快捷键页还有一条相关语义：非 `shortcut.*` 键写空字符串会被替换成默认值，而快捷键支持空绑定（表示解绑）。
- **保存成功后必须刷新详情缓存（已修，接新页面时别漏传 `detailKey`）**：`useAutoSaveSettingsForm` 的 `detailKey` 参数在保存成功后会 `mutate` 该详情缓存。原因：SWR 在一次请求完成后的 `dedupingInterval`（默认 2 秒）内保留「请求进行中」标记，重新进入该页时会被判定为无需重拉，于是页面一直显示旧值——用户改完设置、切走再切回来核对，看到旧值就会以为没保存成功（整页 reload 才正常，所以老用例发现不了）。该刷新同时让「新增云端模型后立刻能在功能下拉里选中」成立：功能下拉的模型清单读的就是这份详情缓存，不再是「必须重进页面」。
- **引擎下拉框的模型列表来自页面加载时的快照**：新增云端模型后不再需要重进页面（见上一条）；但如果将来绕过 `detailKey`，这个坑会回来。
- **存储路径会被追加环境后缀**：`resolveStorageRootPath` 在可用性校验前给目录名加环境后缀（开发态 `-dev`），所以指向一个真实文件时会变成同级的 `文件-dev` 路径，在可写父目录下反而算"可用"、保存成功。要构造真正的失败必须让父目录无写权限（`chmod 0o500`），而不是靠指向不存在的路径或文件。

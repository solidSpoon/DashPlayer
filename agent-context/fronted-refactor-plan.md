# DashPlayer 前端（renderer/fronted）重构方案（简版）

目标：让 UI/状态/与后端通信三者边界清晰，减少 `window.electron.*` 散落与“模块顶层副作用”，便于迭代与排错；每次只改一个 feature，保持可运行。

## 前端在 Electron 里的“分层”怎么理解

（轻量）UI(Page/Component) → Application(业务编排/状态协调) → Ports(对后端/系统的抽象) → Infrastructure(对 `window.electron` 的实现)

- UI：只关心展示与交互，不直接拼装复杂业务流程
- Application：把“做什么/先后顺序/策略”放这里（例如：触发转录、根据设置选择云/本地、失败后 toast、刷新缓存）
- Ports：只为高副作用边界建抽象（ipc call、renderer api 注册、logger、文件对话框等）
- Infrastructure：唯一允许直接碰 `window.electron.call/registerRendererApi/dpLogger/...` 的地方

## 当前痛点（从现状抽象出来）

- 页面/Hook 里大量直接 `window.electron.call(...)`，错误处理/重试/toast 分散
- 一些模块在顶层就做初始化（例如遍历 settings key 去 `storage/get`），不利于控制时机与测试
- `src/fronted/controllers/**` 本质是“后端 → 前端”的入站适配器，但它直接操作 store，后续扩展容易变成大杂烩

## 建议的目标目录（不要求一次性搬完）

```
src/fronted/
  pages/                         # 页面路由与布局
  components/                    # 纯 UI 组件（尽量无副作用）
  hooks/                         # UI hook（薄），只调用 application

  application/
    services/                    # 业务编排（翻译/转录/收藏/任务中心/...）
    ports/
      backend/                   # 对后端 ipc-call 的抽象（typed client）
      renderer-api/              # registerRendererApi 的抽象（后端回调入口）
      logger/                    # 前端日志抽象（可选）
    bootstrap/                   # init：注册 renderer api、启动 settings 同步等

  infrastructure/
    electron/                    # 以上 ports 的实现（唯一触达 window.electron）

  controllers/                   # （过渡）后续迁到 application/bootstrap + adapters 后再删
```

## UI 组件目录怎么分（推荐做法）

先用“组件的复用范围 + 是否带业务语义”来分，而不是按“长得像什么”分：

- **UI primitives（无业务语义）**：按钮/弹窗/表单/表格/图标/Popover 等，只管展示与交互细节。
- **Shared components（跨业务复用，但有一点语义）**：例如 `EmptyState`、`SearchInput`、`ConfirmDialog`、`ErrorBoundary`、`AppToaster`。
- **Feature components（有明确业务语义）**：例如 `TranscriptList`、`VocabularyTable`、`PlayerControlBar`、`ProjectListCard`。
- **Page-local components（只服务某个页面）**：页面内部临时拆出来的组件，不值得放到全局 `components/`。

建议的目录长相（你现在已有的 `components/ui` 可以直接延续）：

```
src/fronted/components/
  ui/                            # 设计系统/基础组件（shadcn 或自研）
  layout/                        # 纯布局：TitleBar、Sidebar、SplitPane、AppShell
  shared/                        # 跨 feature 复用（但不属于 ui 的通用组件）
  feature/
    player/                      # 播放器领域组件（有业务语义）
    transcript/                  # 转录/字幕领域组件
    translation/                 # 翻译领域组件
    vocabulary/                  # 生词本领域组件
    download/                    # 下载/yt-dlp 领域组件
    settings/                    # 设置页复用组件（注意：只是 UI，不是 settings 逻辑）
```

页面内如果有“只在这个页面用”的组件，优先放这里（避免 `components/` 被污染）：

```
src/fronted/pages/
  player/
    components/                  # 只给 player 页面用的组件
  transcript/
    components/
```

### 放置规则（避免越界）

- `components/ui/**`：
  - 禁止依赖 `application/**`、禁止 `window.electron`、禁止直接 call 后端
  - 允许依赖 `components/ui` 内部互相引用、以及 `fronted/styles`/纯工具
- `components/shared/**`：
  - 允许做“UI 级别的小状态”（开关、输入框受控、动画），允许接收回调
  - 不负责业务编排；业务策略放 `application/services/**`
- `components/feature/**`：
  - 可以有业务语义，但尽量做到“容器/展示分离”：展示组件收 props，容器组件用 hook/service 拿数据
  - 仍然不直接碰 `window.electron`（通过 `application` 或 hooks）
- `pages/**`：
  - 允许做组合与路由级编排，但避免把完整业务流程写在页面里（下沉到 `application/services`）

### 命名与复用判断（简单可执行）

- 组件名：`PascalCase.tsx`；目录名：`kebab-case` 或沿用现有风格（尽量统一）
- 如果一个组件：
  - **被 2+ 个页面/feature 使用** → `components/shared` 或 `components/ui`
  - **只在一个 feature 使用** → `components/feature/<feature>`
  - **只在一个页面用** → `pages/<page>/components`
- 测试：`src/fronted/components/**/__tests__/*` 或同目录 `*.test.tsx`（跟现有习惯一致即可）

## 迁移规则（和后端保持一致的“轻量边界”）

- 不给前端 application service 强行写 interface（直接 class/函数即可）
- Ports 只给“变化大/副作用强”的边界建：`window.electron.call`、`registerRendererApi`、`dpLogger`、可能的文件/系统能力
- 任何“顶层就发请求/注册监听”的逻辑，收敛到 `application/bootstrap/*`，由入口显式调用

## 推荐迁移顺序（每次只做一个点）

1. 建立 `BackendClientPort`：把 `window.electron.call` 包一层（集中错误映射、可选的 toast/日志、统一返回类型）
2. 建立 `RendererApiRegistryPort`：把 `registerRendererApi` 的注册放到 bootstrap（把 `src/fronted/controllers` 逐步迁走）
3. 把一个 feature 先迁完（建议从 `Translation` 或 `Transcript` 开始）：
   - 页面/Hook 只调用 `application/services/*`
   - service 内部用 ports 调后端、更新 zustand store、触发 swr mutate/toast
4. 把 settings 初始化/订阅从模块顶层移到 `application/bootstrap/initSettingsSync.ts`
5. 清理：`controllers/`、重复的错误处理、散落的 apiPath/swrKey 组装，逐步收敛

## 验收标准（最小可见收益）

- 新增/修改一个功能时，只需要改：`pages/hooks` + `application/services`（很少碰 `infrastructure`）
- `window.electron.*` 基本只出现在 `src/fronted/infrastructure/electron/**`
- 页面文件里不再出现长串 `call(...) + try/catch + toast + mutate` 的重复代码

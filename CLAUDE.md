# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目概述

DashPlayer 是一个专为英语学习设计的视频播放器，基于 Electron、React 和 TypeScript 构建。它具有双语字幕、AI 字幕生成、单词查询和针对语言学习优化的播放控制等功能。

## 开发命令

### 核心开发
- `yarn run download` - 运行前下载必需的依赖/脚本
- `yarn run start` - 启动开发环境（运行 download + electron-forge start）
- `yarn run package` - 打包应用程序用于分发
- `yarn run make` - 构建不同平台的可分发包

### 测试与质量
- `yarn run test` - 使用 Vitest 运行测试
- `yarn run test:run` - 运行一次测试
- `yarn run test:watch` - 监听模式运行测试
- `yarn run test:coverage` - 运行测试覆盖率报告
- `yarn run test:ui` - 使用 Vitest UI 运行测试
- `yarn run lint` - 运行 ESLint 代码质量检查

### 数据库
- 项目使用 Drizzle ORM 和 SQLite。数据库迁移在 `drizzle/` 目录
- 架构定义在 `src/backend/db/tables/`

## 架构概述

### Electron 架构
- **主进程**: `src/main.ts` - 处理窗口创建、协议注册和应用生命周期
- **渲染进程**: `src/app.tsx` - React 应用，包含路由和 UI 组件
- **预加载脚本**: `src/preload.ts` - 主进程和渲染进程之间的桥梁
- **IPC 通信**: `src/backend/` 中的后端服务与 IPC 处理器

### 目录结构

#### 前端 (`src/fronted/`)
- **组件**: 可重用的 UI 组件在 `components/ui/`（shadcn/ui 组件）
- **页面**: 应用页面如 `HomePage`、`PlayerWithControlsPage`、设置页面
- **钩子**: 用于状态管理和 API 调用的自定义 React 钩子
- **样式**: Tailwind CSS 配置和自定义样式

#### 后端 (`src/backend/`)
- **服务**: 核心业务逻辑实现 (`services/impl/`)
- **数据库**: SQLite 数据库设置、迁移和表定义 (`db/`)
- **对象**: 业务对象和 API 客户端 (`objs/`) - YouDao、腾讯、OpenAI 客户端
- **IPC**: 进程间通信处理器 (`ipc/`)
- **调度器**: 主 IPC 请求调度器 (`dispatcher.ts`)

#### 公共 (`src/common/`)
- 应用程序中使用的共享工具和常量

### 关键依赖和技术

#### 核心技术栈
- **Electron 29.2.0** - 桌面应用框架
- **React 18.2.0** - 带 TypeScript 的 UI 库
- **Vite** - 构建工具和开发服务器
- **Tailwind CSS** - 使用 shadcn/ui 组件的样式

#### AI 和语言处理
- **OpenAI API** - 用于字幕生成和学习功能
- **Compromise.js** - 自然语言处理

#### 数据库和状态
- **Better SQLite3** - 数据库引擎
- **Drizzle ORM** - 带 TypeScript 支持的数据库 ORM
- **Zustand** - 客户端状态管理
- **React Hook Form** - 带 Zod 验证的表单处理

#### 视频和媒体
- **React Player** - 视频播放组件
- **FFmpeg** - 视频处理（包含静态二进制文件）
- **FFprobe** - 媒体分析

#### UI 组件
- **Radix UI** - 无头 UI 组件（通过 shadcn/ui）
- **Lucide React** - 图标库
- **Framer Motion** - 动画

### 核心功能实现

#### 字幕系统
- 支持 SRT 字幕文件
- 通过 OpenAI Whisper 实现 AI 字幕生成
- 使用腾讯云 API 的机器翻译
- 使用 YouDao API 的逐词翻译

#### 播放控制
- 为语言学习定制的自定义键盘快捷键
- 蓝牙游戏手柄支持远程控制
- 句子级导航和重复
- 可调节的字幕时间

#### 文件管理
- 自定义文件协议（`dp://`）用于安全文件访问
- 视频下载功能
- 长视频分割功能
- 用于存储用户数据和偏好的 SQLite 数据库

### 环境设置要求

#### 开发环境
- Node.js（package.json 中指定的版本）
- Yarn 包管理器

#### API 配置
应用程序需要配置几个外部 API：
- **YouDao API** - 用于单词翻译和词典查询
- **腾讯云 API** - 用于字幕翻译
- **OpenAI API** - 用于字幕生成和 AI 驱动的学习功能

### 数据库架构
应用程序使用 SQLite，主要包含以下领域：
- 用户设置和偏好
- 视频播放历史和进度
- 字幕数据和翻译
- 下载任务和处理状态

### 构建配置
- **Electron Forge** - 应用程序打包和分发
- **多个 Vite 配置** - 主进程、预加载和渲染进程的单独配置
- **平台特定构建** - 支持 Windows、macOS 和 Linux

### 测试
- **Vitest** - 带 React Testing Library 的测试运行器
- **JSDOM** - 测试的 DOM 环境
- 可用覆盖率报告

## API 接口架构

### 概述
DashPlayer 通过 `src/preload.ts` 中暴露的 `window.electron` 使用双向 IPC 架构。前端通过 `api.call()` 调用后端，后端通过 `SystemService.callRendererApi()` 调用前端。

### 核心组件

#### 1. API 定义文件
- **`src/common/api/api-def.ts`** - 后端 API 定义（前端调用后端）
- **`src/common/api/renderer-api-def.ts`** - 渲染器 API 定义（后端调用前端）
- **`src/preload.ts`** - 主进程和渲染进程之间的桥梁

#### 2. 通信模式

**前端 → 后端（请求/响应）**
```typescript
// 项目通用模式：const api = window.electron
const api = window.electron;

// 前端调用后端 API
const result = await api.call('ai-trans/word', { word: 'hello' });

// 带错误处理的安全调用
const result = await api.safeCall('ai-trans/word', { word: 'hello' });
```

**后端 → 前端（通知/回调）**
```typescript
// 后端向前端发送通知
await this.systemService.callRendererApi('translation/batch-result', {
    translations: [{ key: 'text1', translation: '翻译结果' }]
});
```

### API 实现模式

#### 后端 API 注册
```typescript
// 在后端控制器中
import registerRoute from '@/common/api/register';

// 注册单个 API - 通过 ipcMain.handle 自动注册
registerRoute('ai-trans/word', async (params) => {
    return await translationService.translateWord(params.word);
});
```

#### 前端 API 注册
```typescript
// 在前端控制器中（BaseRendererController）
protected setupApis(): void {
    this.batchRegisterApis({
        'translation/result': async (params) => {
            // 处理来自后端的翻译结果
            updateTranslationUI(params);
        }
    });
}

// 注册使用预加载脚本
const unregister = window.electron.registerRendererApi(path, handler);
```

### 类型安全

#### 带有 TypeScript 接口的 API 定义
```typescript
// 后端 API 定义
interface AiTransDef {
    'ai-trans/word': { 
        params: { word: string; forceRefresh?: boolean }, 
        return: YdRes | null 
    };
}

// 前端 API 定义
interface TranslationRendererDef {
    'translation/result': { 
        params: { key: string, translation: string }, 
        return: void 
    };
}
```

#### 生成的 API 类型
```typescript
// 完整的类型安全 API 映射
export type ApiMap = {
    [K in keyof ApiDefinitions]: ApiFunction<
        ApiDefinitions[K]['params'], 
        Promise<ApiDefinitions[K]['return']>
    >
}
```

### 关键 API 类别

#### 后端 API（前端调用）
- **系统 API** - 文件操作、窗口管理、系统信息
- **AI 翻译** - 单词翻译、批量字幕翻译
- **AI 功能** - TTS、短语分析、语法分析
- **观看历史** - 视频进度、历史管理
- **设置** - API 配置、服务管理
- **视频处理** - 下载、转换、分割视频
- **收藏/剪辑** - 管理学习剪辑和标签

#### 前端 API（后端调用）
- **UI 更新** - 显示通知、进度更新、提示
- **翻译结果** - 实时翻译回调
- **转录更新** - AI 字幕生成进度
- **词汇匹配** - 单词识别结果

### 实际使用示例

#### 翻译流程
1. 前端使用字幕索引调用 `ai-trans/request-group-translation`
2. 后端通过腾讯/OpenAI API 异步处理翻译
3. 后端调用 `translation/batch-result` 将结果发送回前端
4. 前端用翻译的字幕更新 UI

#### 转录流程
1. 前端调用 `ai-func/transcript` 启动 AI 字幕生成
2. 后端使用 Whisper 处理音频
3. 后端调用 `transcript/batch-result` 发送进度更新
4. 前端显示实时转录进度

### 核心优势

- **类型安全**: 所有 API 调用的完整 TypeScript 类型
- **双向**: 支持请求/响应和发布/订阅模式
- **批量处理**: 翻译和更新的高效批量操作
- **错误处理**: 集中错误处理和日志记录
- **可扩展**: 通过扩展接口定义轻松添加新 API

## 开发注意事项

- 项目使用路径别名（`@/` 表示 src 目录）
- 自定义文件协议处理用于安全本地文件访问
- 应用程序包含针对语言学习优化的广泛键盘快捷键
- 蓝牙控制器支持学习期间免提操作

# DashPlayer 项目基本情况

## 项目概述
DashPlayer 是一款专为英语学习打造的视频播放器，采用 Electron + React + TypeScript 技术栈开发。

## 技术架构

### 前端技术栈
- **框架**: React 18 + TypeScript
- **状态管理**: Zustand
- **UI组件**: Radix UI + Tailwind CSS + Lucide React
- **路由**: React Router DOM
- **视频播放**: React Player
- **数据请求**: SWR
- **构建工具**: Vite + Electron Forge

### 后端技术栈
- **运行时**: Electron (Node.js)
- **数据库**: SQLite + Drizzle ORM
- **依赖注入**: Inversify
- **AI集成**: OpenAI SDK
- **媒体处理**: FFmpeg

## 项目结构

### 主要目录
```
src/
├── backend/           # 后端代码 (Electron Main Process)
│   ├── controllers/   # API控制器
│   ├── services/      # 业务逻辑服务
│   ├── db/           # 数据库相关
│   └── utils/        # 工具函数
├── fronted/          # 前端代码 (Electron Renderer Process)
│   ├── components/   # React组件
│   ├── hooks/        # 自定义Hooks
│   ├── pages/        # 页面组件
│   └── lib/          # 前端工具库
└── common/           # 前后端共享代码
    ├── api/          # API定义
    ├── types/        # 类型定义
    └── utils/        # 通用工具
```

### 关键组件
- **Player.tsx**: 视频播放器主组件
- **PlayerControlPanel.tsx**: 播放控制面板
- **ControlBox.tsx**: Player Controls控制区域
- **FileBrowser.tsx**: Video Explorer文件浏览器
- **usePlayerController**: 播放器状态管理Hook
- **useFile**: 文件状态管理Hook

## 核心功能
1. **视频播放**: 支持多种格式的视频播放
2. **字幕处理**: SRT字幕解析、显示和时间调整
3. **AI辅助**: 字幕翻译、语法分析、词汇解释
4. **播放历史**: 记录观看进度和历史
5. **文件管理**: 文件/文件夹模式播放列表
6. **快捷键**: 丰富的键盘快捷键支持
7. **主题**: 支持明暗主题切换

## 开发相关

### 常用命令
```bash
yarn start      # 启动开发环境
yarn lint       # 代码检查
yarn test       # 运行测试
yarn make       # 构建应用
```

### 数据库
- 使用 Drizzle ORM 管理 SQLite 数据库
- 主要表: watchHistory, videoClip, tag, words 等
- 支持数据库迁移

### API架构
- 基于 Electron IPC 的前后端通信
- 控制器-服务模式的后端架构
- 统一的 API 注册和调用机制

### 状态管理
- Zustand store 分片管理
- 播放器状态: usePlayerController
- 文件状态: useFile
- 布局状态: useLayout
- 设置状态: useSetting

### 日志系统
**必须使用统一日志系统，禁止使用 console.log**

#### 后端日志
```typescript
import { getMainLogger } from '@/backend/ioc/simple-logger';
const logger = getMainLogger('module-name');
logger.debug('message', { data });
```

#### 前端日志
```typescript
import { getRendererLogger } from '@/fronted/log/simple-logger';
const logger = getRendererLogger('module-name');
logger.debug('message', { data });
```

## API开发规范

### 重要提醒 ⚠️
**修改API时必须在以下文件中更新类型定义：**
- `src/common/api/api-def.ts` - API类型定义文件
- 所有新增的API都必须在对应的interface中定义参数和返回值类型

### API定义结构
```typescript
interface WatchHistoryDef {
    'watch-history/get-next-video': { params: string, return: WatchHistoryVO | null };
    // 其他API定义...
}
```

### API开发流程
1. 在 `api-def.ts` 中定义API类型
2. 在对应的Controller中实现方法
3. 在Service接口中添加方法定义
4. 在ServiceImpl中实现具体逻辑
5. 在Controller的registerRoutes中注册路由

## 当前开发任务
✅ 已完成：实现自动播放下一个视频功能，在文件夹模式下视频播放结束后自动播放下一个视频。

## 注意事项
- 项目使用 TypeScript 严格模式
- 遵循 React Hooks 最佳实践
- 后端使用依赖注入模式
- 前端组件采用 shadcn/ui 设计规范
- **API开发必须先在 `api-def.ts` 中定义类型**
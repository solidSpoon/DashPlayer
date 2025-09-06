# DashPlayer 日志系统现状文档

## 1. 前端日志实现

### 1.1 实现方式
- **主要工具**: 原生 `console` API (console.log, console.error, console.warn)
- **使用范围**: 50 个文件中使用 console API
- **日志级别**: 无明确级别控制
- **错误处理**: 使用 react-error-boundary 进行组件级错误捕获

### 1.2 日志分类和标识
```typescript
// 控制器日志
console.log(`[${this.name}] API called: ${path}`, params);

// 功能模块日志
console.error('[TRANS-HOOK] ❌ Group translation request failed:', error);

// 状态标识日志
console.log('✅ SRT file saved successfully:', srtFileName);
console.error('❌ Failed to save SRT file:', saveError);
```

### 1.3 Console API 使用分布
- **console.log**: 一般信息日志
- **console.error**: 错误日志
- **console.warn**: 警告日志

### 1.4 主要使用场景
- **控制器层**: BaseRendererController.ts 中的 API 调用日志
- **任务中心**: useDpTaskCenter.ts 中的任务状态日志
- **翻译功能**: useTranslation.ts 中的翻译相关日志
- **SWR 工具**: swr-util.ts 中的数据缓存更新日志

## 2. 后端日志实现

### 2.1 实现方式
- **主要工具**: `electron-log/main` (dpLog) + 原生 console
- **配置文件**: `src/backend/ioc/logger.ts`
- **日志级别**: info 级别及以上
- **存储位置**: `~/Documents/DashPlayer/logs/main.log`

### 2.2 electron-log 配置
```typescript
import log from "electron-log/main";

log.initialize({ preload: true });
log.transports.file.level = "info";
log.transports.file.resolvePathFn = () =>
    path.join(logPath, "main.log");
log.errorHandler.startCatching();
```

### 2.3 日志存储路径
- **基础路径**: `~/Documents/DashPlayer` (可配置)
- **开发环境**: `~/Documents/DashPlayer-dev/logs`
- **生产环境**: `~/Documents/DashPlayer/logs`
- **最终日志文件**: `~/Documents/DashPlayer/logs/main.log`

### 2.4 文件使用情况

#### 2.4.1 使用 dpLog 的文件 (15个)
**服务层**:
- `src/backend/services/TtsService.ts`
- `src/backend/services/impl/TranslateServiceImpl.ts`
- `src/backend/services/impl/WhisperServiceImpl.ts`
- `src/backend/services/impl/FfmpegServiceImpl.ts`
- `src/backend/services/impl/SplitVideoServiceImpl.ts`
- `src/backend/services/impl/FavouriteClipsServiceImpl.ts`
- `src/backend/services/impl/DpTaskServiceImpl.ts`
- `src/backend/services/ScheduleServiceImpl.ts`

**对象层**:
- `src/backend/objs/TencentClient.ts`
- `src/backend/objs/OpenAiWhisperRequest.ts`
- `src/backend/objs/OpenAiTtsRequest.ts`
- `src/backend/objs/dl-video/DlpFetchFileName.ts`
- `src/backend/objs/dl-video/DlpDownloadVideo.ts`

#### 2.4.2 使用原生 console 的文件 (14个)
**控制器层**:
- `src/backend/controllers/AiFuncController.ts`
- `src/backend/services/impl/SystemServiceImpl.ts`

**服务层**:
- `src/backend/services/impl/ParakeetServiceImpl.ts`
- `src/backend/services/impl/SubtitleServiceImpl.ts`
- `src/backend/services/impl/ConvertServiceImpl.ts`
- `src/backend/services/AiServiceImpl.ts`
- `src/backend/services/CheckUpdate.ts`

**工具层**:
- `src/backend/utils/FileUtil.ts`
- `src/backend/db/migrate.ts`

### 2.5 日志内容示例

#### 2.5.1 dpLog 使用示例
```typescript
// TranslateServiceImpl.ts
dpLog.log(`命中缓存并将 ${cachedTranslations.length} 条结果回传前端`);
dpLog.log(`准备使用 ${engine} 翻译 ${sentencesToTranslate.length} 条句子`);
dpLog.error('腾讯批量翻译失败:', error);
```

#### 2.5.2 原生 console 使用示例
```typescript
// AiFuncController.ts
console.log('taskId', taskId);
console.log('Using Whisper for transcription');
console.log('whisper transcript result:', r);
console.log('✅ SRT file saved successfully:', srtFileName);

// ParakeetServiceImpl.ts
console.log('🚀 Starting whisper.cpp:', binaryPath, args.join(' '));
console.log('🔧 Spawn options for', process.platform, process.arch);
console.log('📋 File type info:', stdout);
console.log('✅ Binary supports current architecture');
```

## 3. 前后端通信机制

### 3.1 IPC 架构
- **通信方式**: Electron IPC (双向通信)
- **API 定义**: TypeScript 接口类型安全
- **实时通信**: 支持批量状态更新和回调机制
- **错误处理**: 统一的错误处理和状态管理

### 3.2 关键组件
- **Preload 脚本**: `src/preload.ts` - API 调用和注册
- **API 定义**: `src/common/api/api-def.ts` - 后端 API 类型定义
- **渲染 API**: `src/common/api/renderer-api-def.ts` - 前端 API 类型定义
- **控制器系统**: 前后端控制器管理和注册

### 3.3 通信流程
```typescript
// 前端调用后端
electronHandler.call = async function invok<K extends keyof ApiMap>(
    path: K, 
    param?: ApiDefinitions[K]['params']
): Promise<ApiDefinitions[K]['return']> {
    return ipcRenderer.invoke(path, param);
};

// 后端调用前端
electronHandler.registerRendererApi = function<K extends keyof RendererApiMap>(
    path: K, 
    handler: RendererApiMap[K]
): () => void {
    const listener = async (event: IpcRendererEvent, callId: string, params: any) => {
        try {
            const result = await handler(params);
            ipcRenderer.send(`renderer-api-response-${callId}`, { 
                success: true, 
                result 
            });
        } catch (error) {
            ipcRenderer.send(`renderer-api-response-${callId}`, { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            });
        }
    };
    
    ipcRenderer.on(`renderer-api-call-${path}`, listener);
    return () => {
        ipcRenderer.removeListener(`renderer-api-call-${path}`, listener);
    };
};
```

## 4. 错误处理机制

### 4.1 前端错误处理
```typescript
// BaseRendererController.ts 统一错误处理
const wrappedHandler = async (params: any) => {
    try {
        console.log(`[${this.name}] API called: ${path}`, params);
        const result = await handler(params);
        console.log(`[${this.name}] API success: ${path}`, result);
        return result;
    } catch (error) {
        console.error(`[${this.name}] API error: ${path}`, error);
        throw error;
    }
};

// React 错误边界
import { ErrorBoundary } from 'react-error-boundary';
import FallBack from '@/fronted/components/FallBack';

const Eb = ({children}:{
    children?: React.ReactNode
}) => {
    return (
        <ErrorBoundary FallbackComponent={FallBack}>
            {children}
        </ErrorBoundary>
    )
}
```

### 4.2 后端错误处理
```typescript
// 全局错误捕获
log.errorHandler.startCatching();

// 装饰器模式 (FileUtil.ts)
function handlePathAccessError(): MethodDecorator {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function(...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error: any) {
                if (isPermissionError(error)) {
                    console.error(`重新尝试访问路径失败: ${err}`);
                }
            }
        };
    };
}

// API 路由错误处理
ipcMain.handle(path, (_event, param) => {
    dpLog.log('api-call', path, JSON.stringify(param));
    return func(param).catch((e: Error) => {
        dpLog.error('api-error', path, e);
        container.get<SystemService>(TYPES.SystemService).sendErrorToRenderer(e);
        throw e;
    });
});
```

## 5. 日志标识和分类

### 5.1 模块标识
- `[ControllerName]` - 控制器日志
- `[TRANS-HOOK]` - 翻译功能日志
- `swrMutateStr/swrMutateArr` - SWR 缓存日志

### 5.2 表情符号标识
- `🔥` - 重要操作日志（下载、设置等）
- `❌` - 错误日志
- `✅` - 成功日志
- `🚀` - 性能相关日志

### 5.3 日志级别使用
- **INFO**: `console.log` - 用于一般信息记录
- **WARN**: `console.warn` - 用于警告信息
- **ERROR**: `console.error` - 用于错误信息
- **dpLog.log()`: 一般日志 (相当于 info)
- **dpLog.error()`: 错误日志

## 6. 批量通信机制

### 6.1 翻译批量结果
```typescript
interface BatchTranslationResult {
    translations: Array<{
        key: string;
        translation: string;
        isComplete?: boolean;
    }>;
}
```

### 6.2 转录批量更新
```typescript
interface BatchTranscriptUpdate {
    updates: Array<{
        filePath: string;
        taskId: number | null;
        status?: string;
        progress?: number;
        result?: any;
    }>;
}
```

### 6.3 实时状态更新示例
```typescript
// 翻译服务实时回传
this.systemService.callRendererApi('translation/batch-result', {
    translations: resultsToRender
});

// 转录状态实时更新
this.systemService.callRendererApi('transcript/batch-result', {
    updates: [{
        filePath,
        taskId,
        status: 'completed',
        progress: 100,
        result: { srtPath: srtFileName, segments: r.segments }
    }]
});
```

## 7. 前端 Controller 通知机制

### 7.1 通知架构
- **通信方式**: 后端通过 SystemService.callRendererApi 调用前端 Controller
- **类型安全**: 基于 TypeScript 接口定义
- **批量处理**: 支持批量状态更新
- **实时性**: 即时通知前端状态变化

### 7.2 核心组件
- **SystemService**: 后端调用前端 API 的统一入口
- **BaseRendererController**: 前端控制器基类
- **ControllerManager**: 前端控制器管理器
- **Renderer API**: 前端 API 类型定义

### 7.3 通知流程
```typescript
// 后端调用前端 Controller
public async callRendererApi<K extends keyof RendererApiDefinitions>(
    path: K,
    params: RendererApiDefinitions[K]['params']
): Promise<RendererApiDefinitions[K]['return']> {
    const mainWindow = this.mainWindowRef.current;
    if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Main window is not available');
    }

    const callId = `${path}-${++this.callIdCounter}-${Date.now()}`;

    return new Promise<RendererApiDefinitions[K]['return']>((resolve, reject) => {
        // 监听响应
        const eventName = `renderer-api-response-${callId}`;
        ipcMain.once(eventName, (event: any, response: any) => {
            if (response.success) {
                resolve(response.result);
            } else {
                reject(new Error(response.error || 'Unknown error'));
            }
        });

        // 发送调用请求
        mainWindow.webContents.send(`renderer-api-call-${path}`, callId, params);
    });
}
```

### 7.4 前端 Controller 接收机制
```typescript
// BaseRendererController 基类
export abstract class BaseRendererController implements RendererController {
    protected registerApi<K extends keyof RendererApiMap>(
        path: K,
        handler: ApiHandler<K>
    ): void {
        const wrappedHandler = async (params: any) => {
            try {
                console.log(`[${this.name}] API called: ${path}`, params);
                const result = await handler(params);
                console.log(`[${this.name}] API success: ${path}`, result);
                return result;
            } catch (error) {
                console.error(`[${this.name}] API error: ${path}`, error);
                throw error;
            }
        };

        const unregister = window.electron.registerRendererApi(path, wrappedHandler);
        this.registeredApis.push(unregister);
    }
}
```

### 7.5 具体通知示例

#### 7.5.1 翻译结果通知
```typescript
// TranslationController
export class TranslationController extends BaseRendererController {
    protected setupApis(): void {
        this.registerApi('translation/result', async (params) => {
            const { key, translation, isComplete } = params;
            useTranslation.getState().updateTranslation(key, translation, isComplete);
        });

        this.registerApi('translation/batch-result', async (params) => {
            const { translations } = params;
            useTranslation.getState().updateTranslations(translations);
        });
    }
}
```

#### 7.5.2 转录状态通知
```typescript
// TranscriptionController
export class TranscriptionController extends BaseRendererController {
    protected setupApis(): void {
        this.registerApi('transcript/batch-result', async (params) => {
            const { updates } = params;
            useTranscript.getState().updateTranscriptTasks(updates);
        });
    }
}
```

### 7.6 状态更新示例
```typescript
// 后端发送翻译结果
this.systemService.callRendererApi('translation/batch-result', {
    translations: resultsToRender
});

// 后端发送转录状态
this.systemService.callRendererApi('transcript/batch-result', {
    updates: [{
        filePath,
        taskId,
        status: 'completed',
        progress: 100,
        result: { srtPath: srtFileName, segments: r.segments }
    }]
});
```

### 7.7 前端状态管理
```typescript
// useTranslation 状态更新
updateTranslations: (translations: Array<{ key: string, translation: string, isComplete?: boolean }>) => {
    set(state => {
        const newTranslations = new Map(state.translations);
        const newStatus = new Map(state.translationStatus);

        translations.forEach(({ key, translation, isComplete = true }) => {
            newTranslations.set(key, translation);
            newStatus.set(key, isComplete ? 'completed' : 'translating');
        });

        return {
            ...state,
            translations: newTranslations,
            translationStatus: newStatus
        };
    });
}

// useTranscript 状态更新
updateTranscriptTasks: (updates) => {
    set((state) => {
        const newFiles = [...state.files];
        
        updates.forEach(async (update) => {
            const { filePath, taskId, status, progress, result } = update;
            const existingIndex = newFiles.findIndex((f) => f.file === filePath);
            
            if (existingIndex >= 0) {
                // 更新现有任务
                if (taskId !== undefined) {
                    newFiles[existingIndex] = { ...newFiles[existingIndex], taskId };
                }
            } else if (taskId !== null) {
                // 添加新任务
                newFiles.push({ file: filePath, taskId });
            }
            
            // 处理完成逻辑
            if (status === 'completed' && result?.srtPath) {
                await api.call('watch-history/attach-srt', {
                    videoPath: filePath,
                    srtPath: 'same'
                });
                toast('Transcript done', { icon: '🚀' });
            }
        });
        
        return { files: newFiles };
    });
}
```

---

**文档版本**: 1.0  
**创建日期**: 2024-01-01  
**最后更新**: 2024-01-01
import { OpenAIDictionaryResult } from '@/common/types/YdRes';

/**
 * 前端API定义文件 - 定义后端可以调用的前端方法
 * 遵循与后端API相同的设计模式，支持分散定义和类型安全
 */

// 示例接口定义
interface RendererApiDefinition {
    'example': { params: string, return: number };
}

// UI相关的前端API定义
interface UIRendererDef {
    'ui/show-notification': { params: { title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error' }, return: void };
    'ui/show-confirm-dialog': { params: { title: string, message: string }, return: boolean };
    'ui/update-progress': { params: { taskId: string, progress: number, message?: string }, return: void };
    'ui/show-toast': { params: { message: string, duration?: number }, return: void };
}

// 翻译相关的前端API定义
interface TranslationRendererDef {
    'translation/result': { params: { key: string, translation: string, isComplete?: boolean }, return: void };
    'translation/batch-result': { params: { translations: Array<{ key: string, translation: string, isComplete?: boolean }> }, return: void };
}

// 字典相关的前端API定义
interface DictionaryRendererDef {
    'dictionary/openai-update': {
        params: {
            requestId: string;
            word: string;
            data: OpenAIDictionaryResult;
            isComplete?: boolean;
        },
        return: void
    };
}

// 转录相关的前端API定义
interface TranscriptRendererDef {
    'transcript/batch-result': { 
        params: { 
            updates: Array<{ 
                filePath: string; 
                taskId: number | null; 
                status?: string; 
                progress?: number;
                result?: any;
            }> 
        }, 
        return: void 
    };
}

// 词汇匹配相关的前端API定义
interface VocabularyRendererDef {
    'vocabulary/match-result': { 
        params: { 
            vocabularyWords: string[]; // 未还原的复数等形态的单词数组
        }, 
        return: void 
    };
}

// 视频学习裁切状态更新的前端API定义
interface VideoLearningRendererDef {
    'video-learning/clip-status-update': {
        params: {
            videoPath: string;
            srtKey: string;
            status: 'pending' | 'in_progress' | 'completed' | 'analyzing';
            pendingCount?: number;
            inProgressCount?: number;
            completedCount?: number;
            message?: string;
            analyzingProgress?: number;
        },
        return: void
    };
}


// 使用交叉类型合并所有前端API定义
export type RendererApiDefinitions = RendererApiDefinition
    & UIRendererDef
    & TranslationRendererDef
    & DictionaryRendererDef
    & TranscriptRendererDef
    & VocabularyRendererDef
    & VideoLearningRendererDef;

// 定义前端API函数类型
type RendererApiFunction<P, R> = (params: P) => R | Promise<R>;

// 更新前端API映射类型
export type RendererApiMap = {
    [K in keyof RendererApiDefinitions]: RendererApiFunction<
        RendererApiDefinitions[K]['params'],
        RendererApiDefinitions[K]['return']
    >;
}

// 前端API调用函数类型 - 用于后端调用前端
export type RendererApiCaller = {
    [K in keyof RendererApiDefinitions]: (
        params: RendererApiDefinitions[K]['params']
    ) => Promise<RendererApiDefinitions[K]['return']>;
}

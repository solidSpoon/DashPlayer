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

// 使用交叉类型合并所有前端API定义
export type RendererApiDefinitions = RendererApiDefinition
    & UIRendererDef
    & TranslationRendererDef;

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

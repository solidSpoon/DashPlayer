/**
 * 前端Controller抽象基类
 * 提供通用的API注册和错误处理功能
 */

import RendererController, { ApiHandler } from '@/fronted/interfaces/RendererController';
import { RendererApiMap } from '@/common/api/renderer-api-def';

/**
 * 前端Controller抽象基类
 */
export abstract class BaseRendererController implements RendererController {
    abstract readonly name: string;

    private registeredApis: Array<() => void> = [];
    private isRegistered = false;

    /**
     * 注册单个API处理方法
     */
    protected registerApi<K extends keyof RendererApiMap>(
        path: K,
        handler: ApiHandler<K>
    ): void {
        if (this.isRegistered) {
            console.warn(`Controller ${this.name}: API ${path} registered after controller initialization`);
        }

        // 包装处理器，添加错误处理和日志
        const wrappedHandler = async (params: any) => {
            try {
                console.log(`[${this.name}] API called: ${path}`, params);
                const result = await (handler as any)(params);
                console.log(`[${this.name}] API success: ${path}`, result);
                return result;
            } catch (error) {
                console.error(`[${this.name}] API error: ${path}`, error);
                throw error;
            }
        };

        // 注册到全局
        const unregister = window.electron.registerRendererApi(path, wrappedHandler as any);
        this.registeredApis.push(unregister);
    }

    /**
     * 批量注册API处理方法
     */
    protected batchRegisterApis(apis: Partial<RendererApiMap>): void {
        for (const [path, handler] of Object.entries(apis)) {
            if (handler) {
                this.registerApi(path as keyof RendererApiMap, handler as any);
            }
        }
    }

    /**
     * 实现基础接口方法
     */
    public registerApis(): () => void {
        if (this.isRegistered) {
            console.warn(`Controller ${this.name} is already registered`);
            return () => {
                //
            };
        }

        this.isRegistered = true;
        this.setupApis();

        console.log(`Controller ${this.name} registered with ${this.registeredApis.length} APIs`);

        // 返回取消注册的函数
        return () => {
            this.unregisterApis();
        };
    }

    /**
     * 子类需要实现的方法，用于设置具体的API处理
     */
    protected abstract setupApis(): void;

    /**
     * 取消注册所有API
     */
    private unregisterApis(): void {
        this.registeredApis.forEach(unregister => unregister());
        this.registeredApis = [];
        this.isRegistered = false;
        console.log(`Controller ${this.name} unregistered`);
    }

    /**
     * 创建标准错误响应
     */
    protected createErrorResponse(message: string, error?: any) {
        console.error(`[${this.name}] ${message}`, error);
        throw new Error(message);
    }

    /**
     * 创建成功响应
     */
    protected createSuccessResponse<T>(data?: T): T extends undefined ? { success: true } : T {
        return (data ?? { success: true }) as any;
    }

    /**
     * 安全执行异步操作
     */
    protected async safeExecute<T>(
        operation: () => Promise<T> | T,
        errorMessage: string
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.createErrorResponse(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`, error);
            throw error; // 这行不会执行，但TypeScript需要它
        }
    }
}

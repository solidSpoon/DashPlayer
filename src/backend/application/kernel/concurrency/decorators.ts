import { concurrency } from '@/backend/application/kernel/concurrency';

/**
 * 为异步方法添加信号量保护。
 * @param key 信号量配置键。
 * @param options 装饰器扩展选项。
 */
export function WithSemaphore(
    key: string,
    options?: {
        reentrant?: boolean;
        timeoutMs?: number;
    },
) {
    return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args: unknown[]) {
            return concurrency.withSemaphore(key, async () => {
                return await originalMethod.apply(this, args);
            }, {
                reentrant: options?.reentrant,
                timeoutMs: options?.timeoutMs,
            });
        };
        return descriptor;
    };
}

/**
 * 为异步方法添加速率限制保护。
 * @param key 速率限制配置键。
 * @param options 装饰器扩展选项。
 */
export function WithRateLimit(
    key: string,
    options?: {
        timeoutMs?: number;
    },
) {
    return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args: unknown[]) {
            return concurrency.withRateLimit(key, async () => {
                return await originalMethod.apply(this, args);
            }, {
                timeoutMs: options?.timeoutMs,
            });
        };
        return descriptor;
    };
}

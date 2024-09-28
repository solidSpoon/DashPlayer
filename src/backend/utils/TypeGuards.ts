import AssertionError from '@/backend/errors/AssertionError';

export class TypeGuards {
    /**
     * 检查一个值是否为 null 或 undefined
     * @param value 要检查的值
     * @returns 如果值为 null 或 undefined 则返回 true，否则返回 false
     */
    public static isNull<T>(value: T | null | undefined): value is null | undefined {
        return value === null || value === undefined;
    }

    /**
     * 检查一个值是否不为 null 且不为 undefined
     * @param value 要检查的值
     * @returns 如果值既不为 null 也不为 undefined 则返回 true，否则返回 false
     */
    public static isNotNull<T>(value: T | null | undefined): value is NonNullable<T> {
        return value !== null && value !== undefined;
    }

    /**
     * 断言一个值不为 null 且不为 undefined
     * @param value 要断言的值
     * @param message 可选的错误消息
     * @throws 如果值为 null 或 undefined，则抛出错误
     */
    public static assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is NonNullable<T> {
        if (this.isNull(value)) {
            throw new AssertionError(message || "Value is null or undefined");
        }
    }

    public static assertType<T>(value: any, type: string, message?: string): asserts value is T {
        if (typeof value !== type) {
            throw new AssertionError(message || `Value is not a ${type}`);
        }
    }
}


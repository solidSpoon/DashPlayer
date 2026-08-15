import AssertionError from '@/backend/utils/errors/AssertionError';
import { TypeGuards as CommonTypeGuards } from '@/common/utils/TypeGuards';

/**
 * 扩展跨进程空值判断，提供仅供后端使用的断言能力。
 */
export class TypeGuards extends CommonTypeGuards {
    /**
     * 断言一个值不为 null 且不为 undefined
     * @param value 要断言的值
     * @param message 可选的错误消息
     * @throws 如果值为 null 或 undefined，则抛出错误
     */
    public static assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is NonNullable<T> {
        if (this.isNull(value)) {
            throw new AssertionError(message || 'Value is null or undefined');
        }
    }

    /**
     * 断言值的 JavaScript 运行时类型符合预期。
     *
     * @param value 待断言的值。
     * @param type 期望的 typeof 类型名称。
     * @param message 断言失败时使用的错误信息。
     */
    public static assertType<T>(value: unknown, type: string, message?: string): asserts value is T {
        if (typeof value !== type) {
            throw new AssertionError(message || `Value is not a ${type}`);
        }
    }
}

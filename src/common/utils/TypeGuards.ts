/**
 * 提供跨进程可复用的空值类型判断。
 */
export class TypeGuards {
    /**
     * 判断值是否为 null 或 undefined。
     *
     * @param value 待判断的值。
     * @returns 值为空时返回 true。
     */
    public static isNull<T>(value: T | null | undefined): value is null | undefined {
        return value === null || value === undefined;
    }

    /**
     * 判断值是否不是 null 且不是 undefined。
     *
     * @param value 待判断的值。
     * @returns 值存在时返回 true，并收窄为非空类型。
     */
    public static isNotNull<T>(value: T | null | undefined): value is NonNullable<T> {
        return value !== null && value !== undefined;
    }
}

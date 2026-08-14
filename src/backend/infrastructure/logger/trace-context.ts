import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

/** 单次异步调用链的日志追踪上下文。 */
interface TraceContext {
    /** 32 位小写十六进制 trace ID。 */
    traceId: string;
}

const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;
const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * 创建符合 W3C trace ID 长度约定的随机标识。
 * @returns 32 位小写十六进制 trace ID。
 */
export function createTraceId(): string {
    return randomBytes(16).toString('hex');
}

/**
 * 判断候选值是否为合法 trace ID。
 * @param candidate 待校验值。
 * @returns 仅 32 位小写十六进制字符串返回 true。
 */
export function isTraceId(candidate: unknown): candidate is string {
    return typeof candidate === 'string' && TRACE_ID_PATTERN.test(candidate);
}

/**
 * 校验并解析外部传入的 trace ID；非法输入会直接生成新 ID，避免污染日志索引。
 * @param candidate renderer 或其他边界传入的候选值。
 * @returns 可安全写入日志的 trace ID。
 */
export function resolveTraceId(candidate: unknown): string {
    return isTraceId(candidate) ? candidate : createTraceId();
}

/**
 * 在指定 trace 上下文中执行回调，异步子调用会自动继承该上下文。
 * @param traceId 已校验的 trace ID。
 * @param callback 需要纳入追踪的同步或异步工作。
 * @returns 回调的原始返回值。
 */
export function runWithTrace<T>(traceId: string, callback: () => T): T {
    return traceStorage.run({ traceId }, callback);
}

/**
 * 获取当前异步调用链的 trace ID。
 * @returns 当前 trace ID；不在追踪上下文中时返回 undefined。
 */
export function getCurrentTraceId(): string | undefined {
    return traceStorage.getStore()?.traceId;
}

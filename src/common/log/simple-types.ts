/** 日志级别。 */
export type SimpleLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 跨进程传递的日志事件。
 *
 * `traceId` 使用 32 位小写十六进制字符串；没有请求上下文的启动或后台日志可以不携带。
 */
export interface SimpleEvent {
    /** 事件发生时间，ISO 8601 格式。 */
    ts: string;
    /** 日志级别。 */
    level: SimpleLevel;
    /** 产生日志的 Electron 进程。 */
    process: 'main' | 'renderer';
    /** 组件、类或文件的稳定名称。 */
    module: string;
    /** 简短、可检索的事件描述。 */
    msg: string;
    /** 可选的结构化上下文。 */
    data?: unknown;
    /** 可选的跨异步调用链追踪标识。 */
    traceId?: string;
}

/**
 * renderer 调用 main IPC 时附带的追踪信息。
 */
export interface TraceCarrier {
    /** 32 位小写十六进制 trace ID。 */
    traceId: string;
}

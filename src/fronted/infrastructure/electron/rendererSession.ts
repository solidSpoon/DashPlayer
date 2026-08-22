/**
 * 当前 renderer 进程的全局会话标识。
 *
 * 同一个 renderer 生命周期内保持不变，renderer 重启后重新生成，
 * 用于让后端区分不同进程中的局部递增序号。
 */
export const rendererSessionId = globalThis.crypto.randomUUID();

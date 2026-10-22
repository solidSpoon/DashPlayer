/**
 * renderer 侧的开发态判定。
 *
 * renderer 没有同步可知的 dev 标志（打包后 renderer 与开发态完全同构），
 * 唯一可信来源是 main 进程的 `isDevelopmentMode()`，经 `system/info` 的 `devMode` 字段下发。
 * 该查询在启动时发起一次并缓存：调试/QA 入口与埋点都读这个缓存，生产构建恒为 false。
 */
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

/** 缓存的判定结果；null 表示查询尚未结束。 */
let devMode: boolean | null = null;

/** 进行中的查询；重复调用复用同一次 IPC。 */
let pending: Promise<boolean> | null = null;

/**
 * 发起（或复用）开发态查询。
 *
 * 查询失败按「非开发态」处理：拿不到证据时不应该开启调试入口。
 *
 * @returns 查询结束后给出开发态判定。
 */
export function resolveDevMode(): Promise<boolean> {
    if (devMode !== null) {
        return Promise.resolve(devMode);
    }
    if (!pending) {
        pending = backendClient
            .call('system/info')
            .then((info) => {
                devMode = info.devMode === true;
                return devMode;
            })
            .catch(() => {
                devMode = false;
                return devMode;
            })
            .finally(() => {
                pending = null;
            });
    }
    return pending;
}

/**
 * 读取开发态判定的当前值。
 *
 * @returns 查询完成且确认为开发态时返回 true；查询未完成时返回 false（fail closed）。
 */
export function isDevMode(): boolean {
    return devMode === true;
}

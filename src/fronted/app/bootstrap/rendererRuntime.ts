import { initRendererApis } from '@/fronted/app/bootstrap/initRendererApis';
import { initSettingsSync } from '@/fronted/app/bootstrap/initSettingsSync';
import { initIpcMessageToasts } from '@/fronted/app/bootstrap/initIpcMessageToasts';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import {
    startListeningToDpTasks,
    stopListeningToDpTasks,
} from '@/fronted/hooks/useDpTaskCenter';
import { syncStatus } from '@/fronted/hooks/useSystem';

let cleanupRuntime: (() => void) | null = null;

/**
 * 初始化 renderer 进程的基础运行时，并集中管理所有全局监听器的生命周期。
 *
 * @returns 清理 renderer 运行时资源的函数；重复初始化时复用当前运行时。
 */
export function startRendererRuntime(): () => void {
    const logger = getRendererLogger('RendererRuntime');
    if (cleanupRuntime) {
        logger.warn('renderer runtime already initialized');
        return cleanupRuntime;
    }

    const cleanups: Array<() => void> = [];

    try {
        cleanups.push(initRendererApis());
        cleanups.push(initSettingsSync());
        cleanups.push(initIpcMessageToasts());
        startListeningToDpTasks();
        syncStatus();
    } catch (error) {
        cleanups.reverse().forEach((cleanup) => cleanup());
        stopListeningToDpTasks();
        logger.error('renderer runtime initialization failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }

    logger.info('renderer runtime initialized');

    cleanupRuntime = () => {
        cleanups.reverse().forEach((cleanup) => cleanup());
        stopListeningToDpTasks();
        cleanupRuntime = null;
        logger.info('renderer runtime stopped');
    };
    return cleanupRuntime;
}

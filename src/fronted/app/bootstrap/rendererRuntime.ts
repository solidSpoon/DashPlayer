import { initRendererApis } from '@/fronted/app/bootstrap/initRendererApis';
import { initSettingsSync } from '@/fronted/app/bootstrap/initSettingsSync';
import { initIpcMessageToasts } from '@/fronted/app/bootstrap/initIpcMessageToasts';
import { startGlobalErrorLogging } from '@/fronted/app/bootstrap/initGlobalErrorLogging';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import {
    startListeningToDpTasks,
    stopListeningToDpTasks,
} from '@/fronted/hooks/useDpTaskCenter';
import {
    startListeningToRepairEvents,
    stopListeningToRepairEvents,
} from '@/fronted/features/repair/repairEvents';
import { syncStatus } from '@/fronted/hooks/useSystem';
import { initPlayerDebug } from '@/fronted/features/player/dev/playerDebug';
import { resolveDevMode } from '@/fronted/lib/devMode';

let cleanupRuntime: (() => void) | null = null;

/**
 * 鼠标点击后自动让非输入类元素失焦，避免 focus 残留导致：
 * 1. 出现碍眼的 focus ring；
 * 2. 空格键同时触发快捷键和按钮原生 click。
 *
 * 文本输入类元素（input / textarea / contenteditable）不受影响，保证可正常点击输入。
 *
 * @returns 注销全局监听器的清理函数。
 */
function initMouseFocusCleanup(): () => void {
    let mouseDown = false;

    const onDown = (e: MouseEvent): void => {
        if (e.button === 0) mouseDown = true;
    };

    const onUp = (): void => {
        if (!mouseDown) return;
        mouseDown = false;

        const el = document.activeElement;
        if (!el || el === document.body) return;

        // 文本输入类元素保留焦点，以免影响正常输入
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
        if (el instanceof HTMLElement && el.isContentEditable) return;

        if (el instanceof HTMLElement) el.blur();
    };

    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mouseup', onUp, true);
    return () => {
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('mouseup', onUp, true);
    };
}

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
        // 先注册异常兜底，后续任一步骤失败都能留下日志证据。
        cleanups.push(startGlobalErrorLogging());
        cleanups.push(initRendererApis());
        cleanups.push(initSettingsSync());
        cleanups.push(initIpcMessageToasts());
        cleanups.push(initMouseFocusCleanup());
        startListeningToDpTasks();
        startListeningToRepairEvents();
        syncStatus();
        // 开发态判定与播放器调试面：启动时各查一次，后续所有 dev/qa 能力读缓存
        void resolveDevMode();
        void initPlayerDebug();
    } catch (error) {
        cleanups.reverse().forEach((cleanup) => cleanup());
        stopListeningToDpTasks();
        stopListeningToRepairEvents();
        logger.error('renderer runtime initialization failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }

    logger.info('renderer runtime initialized');

    cleanupRuntime = () => {
        cleanups.reverse().forEach((cleanup) => cleanup());
        stopListeningToDpTasks();
        stopListeningToRepairEvents();
        cleanupRuntime = null;
        logger.info('renderer runtime stopped');
    };
    return cleanupRuntime;
}

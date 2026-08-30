import { app, type WebContents } from 'electron';

import { getMainLogger } from '@/backend/infrastructure/logger';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';

const logger = getMainLogger('ProcessWatchdog');

/** Electron 进程退出原因；`clean-exit` 表示正常结束，不算故障。 */
type GoneReason = 'clean-exit' | 'abnormal-exit' | 'killed' | 'crashed' | 'oom' | 'launch-failed' | 'integrity-failure' | 'memory-eviction';

let initialized = false;

/**
 * 按退出原因选择日志级别：正常结束只是生命周期事件，其余都是需要显式暴露的故障。
 * @param reason Electron 给出的进程退出原因。
 * @returns 对应的日志级别。
 */
function levelForGoneReason(reason: GoneReason): 'info' | 'error' {
    return reason === 'clean-exit' ? 'info' : 'error';
}

/**
 * 为单个 webContents 挂载加载与卡死监听。
 *
 * 统一由 `web-contents-created` 调用，因此窗口销毁后监听随对象回收，
 * 也不需要在 `createWindow()` 里重复注册（`activate` 重建窗口会自动覆盖）。
 * @param contents 新建的 webContents。
 */
function attachWebContentsWatchdog(contents: WebContents): void {
    /**
     * 返回可直接用于日志的窗口标识字段。
     * @returns 含 webContentsId、URL 与操作系统进程号的结构化字段。
     */
    const identity = () => ({
        webContentsId: contents.id,
        url: contents.getURL(),
        osProcessId: contents.getOSProcessId(),
    });

    // 主框架加载失败是"白屏/黑屏"类问题的第一手证据；errorCode -3(ABORTED) 属导航被打断，
    // 保留原始 errorCode 交由分析侧判断，这里不做静默过滤。
    const onLoadFailed = (source: string) => (
        _event: Electron.Event,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean,
    ): void => {
        logger.warn(source, {
            ...identity(),
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame,
        });
    };

    contents.on('did-fail-load', onLoadFailed('renderer did fail load'));
    contents.on('did-fail-provisional-load', onLoadFailed('renderer did fail provisional load'));

    // 渲染主线程卡住不会抛异常，只能靠这两个事件留下"界面冻结"的时间区间。
    contents.on('unresponsive', () => {
        logger.warn('renderer unresponsive', identity());
    });
    contents.on('responsive', () => {
        logger.info('renderer responsive again', identity());
    });

    contents.on('preload-error', (_event, preloadPath, error) => {
        logger.error('renderer preload error', { ...identity(), preloadPath, error });
    });

    contents.on('destroyed', () => {
        logger.debug('web contents destroyed', { webContentsId: contents.id });
    });
}

/**
 * 注册 Electron 进程级异常兜底监听。
 *
 * 这些事件全部不经过 JS 异常通道：渲染进程 SIGSEGV、GPU 进程崩溃、媒体/网络 utility
 * 进程被 kill 都不会触发 `uncaughtException`，也不会有任何 console 输出。缺少这层时，
 * 解码链路故障（例如 VideoToolbox 报错导致的进程级崩溃）在日志里完全不留痕迹。
 *
 * 幂等：重复调用不会重复注册监听。
 */
export function initProcessWatchdog(): void {
    if (initialized) {
        return;
    }
    initialized = true;

    app.on('render-process-gone', (_event, webContents, details) => {
        logger[levelForGoneReason(details.reason)]('render process gone', {
            reason: details.reason,
            exitCode: details.exitCode,
            webContentsId: webContents.id,
            url: webContents.getURL(),
            osProcessId: webContents.getOSProcessId(),
            isDevelopment: isDevelopmentMode(),
        });
    });

    // Electron 39 没有独立的 gpu-process-gone 事件，GPU 进程死亡以 type === 'GPU' 出现在这里。
    app.on('child-process-gone', (_event, details) => {
        logger[levelForGoneReason(details.reason)]('child process gone', {
            processType: details.type,
            reason: details.reason,
            exitCode: details.exitCode,
            processName: details.name,
            serviceName: details.serviceName,
            isDevelopment: isDevelopmentMode(),
        });
    });

    app.on('web-contents-created', (_event, contents) => {
        attachWebContentsWatchdog(contents);
    });

    logger.info('process watchdog started');
}

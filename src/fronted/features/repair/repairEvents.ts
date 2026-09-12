import { create } from 'zustand';
import { RepairTaskEvent, RepairTaskState } from '@/common/contracts/playback-repair';
import { rendererEvents } from '@/fronted/infrastructure/electron/rendererEvents';

/**
 * 判断修复事件是否已进入终态。
 *
 * @param status 修复状态。
 * @returns 已结束（完成、失败或取消）时返回 `true`。
 */
const isFinalStatus = (status: RepairTaskState): boolean =>
    status === RepairTaskState.DONE
    || status === RepairTaskState.FAILED
    || status === RepairTaskState.CANCELLED;

/**
 * 修复链路的实时事件缓存。
 *
 * 修复状态以数据库记录为准（SWR 轮询刷新），这里只保存每个媒体最近一次事件：
 * 进行中事件提供实时进度，终态事件让「修复中」的显示不必等下一轮轮询。
 * 渲染进程刚启动时缓存为空，进行中的记录就只显示「正在修复」而没有百分比。
 */
const useRepairEventStore = create<{ events: Map<string, RepairTaskEvent> }>(() => ({
    events: new Map(),
}));

export default useRepairEventStore;

/** 全局事件监听的清理函数；未启动时为 `null`。 */
let cleanupListener: (() => void) | null = null;

/**
 * 开始监听主进程推送的修复事件。
 *
 * 修复链路不走 dp_task 回传，渲染端自行订阅 `repair-task-update` 通道；
 * 由 renderer 启动流程统一调用，重复调用无副作用。
 */
export const startListeningToRepairEvents = (): void => {
    if (cleanupListener) {
        return;
    }
    cleanupListener = rendererEvents.onRepairTaskUpdate((event) => {
        useRepairEventStore.setState((state) => ({
            events: new Map(state.events).set(event.file, event),
        }));
    });
};

/**
 * 停止监听修复事件；与启动函数成对使用。
 */
export const stopListeningToRepairEvents = (): void => {
    if (cleanupListener) {
        cleanupListener();
        cleanupListener = null;
    }
};

/**
 * 订阅指定媒体的修复事件直到进入终态。
 *
 * 播放页的一次性修复流程使用：必须先建立订阅、再启动修复，保证不漏掉最早的
 * 事件；没有真正启动修复（无需修复）或启动失败时调用 `stop` 拆掉订阅。
 * 直接订阅通道而不是读事件缓存：缓存里可能留着上一轮修复的终态事件。
 *
 * @param filePath 媒体绝对路径。
 * @param onUpdate 收到该媒体事件时的回调。
 * @returns 终态事件的 Promise 与提前拆除订阅的 `stop` 函数。
 */
export const watchRepair = (
    filePath: string,
    onUpdate: (event: RepairTaskEvent) => void,
): { finished: Promise<RepairTaskEvent>; stop: () => void } => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    const finished = new Promise<RepairTaskEvent>((resolve) => {
        unsubscribe = rendererEvents.onRepairTaskUpdate((event) => {
            if (event.file !== filePath || settled) {
                return;
            }
            onUpdate(event);
            if (isFinalStatus(event.status)) {
                settled = true;
                resolve(event);
                unsubscribe?.();
                unsubscribe = null;
            }
        });
    });
    return {
        finished,
        stop: () => {
            settled = true;
            unsubscribe?.();
            unsubscribe = null;
        },
    };
};

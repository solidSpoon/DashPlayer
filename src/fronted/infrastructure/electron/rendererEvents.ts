import { DpTask } from '@/common/contracts/dp-task';
import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';

/**
 * renderer 订阅 main 进程事件的统一入口。
 */
export const rendererEvents = {
    /**
     * 订阅后台任务状态更新。
     *
     * @param handler 任务更新处理函数。
     * @returns 取消订阅函数。
     */
    onTaskUpdate(handler: (task: DpTask) => void): () => void {
        return window.electron.onTaskUpdate(handler);
    },

    /**
     * 订阅运行时设置变化。
     *
     * @param handler 设置变化处理函数。
     * @returns 取消订阅函数。
     */
    onStoreUpdate(handler: (key: RuntimeSettingKey, value: string) => void): () => void {
        return window.electron.onStoreUpdate(handler);
    },

    /**
     * 订阅 main 进程错误提示。
     *
     * @param handler 错误处理函数。
     * @returns 取消订阅函数。
     */
    onErrorMessage(handler: (error: Error) => void): () => void {
        return window.electron.onErrorMsg(handler);
    },

    /**
     * 订阅 main 进程信息提示。
     *
     * @param handler 信息处理函数。
     * @returns 取消订阅函数。
     */
    onInfoMessage(handler: (info: string) => void): () => void {
        return window.electron.onInfoMsg(handler);
    },
};

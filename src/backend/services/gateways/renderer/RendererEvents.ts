import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';
import { DpTask } from '@/common/contracts/dp-task';
import { RepairTaskEvent } from '@/common/contracts/playback-repair';

/**
 * 主进程向渲染进程推送运行时事件的端口。
 */
export default interface RendererEvents {
    storeUpdate(key: RuntimeSettingKey, value: string): void;
    dpTaskUpdate(task: DpTask): void;
    repairTaskUpdate(event: RepairTaskEvent): void;
    error(error: Error): void;
    info(message: string): void;
}

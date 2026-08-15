import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';
import type { StoreEventsPort } from '@/fronted/application/ports/events/StoreEventsPort';

export class ElectronStoreEvents implements StoreEventsPort {
    /**
     * 订阅主进程推送的非敏感运行时设置变化。
     *
     * @param handler 设置变化处理函数。
     * @returns 取消订阅函数。
     */
    onStoreUpdate(handler: (key: RuntimeSettingKey, value: string) => void): () => void {
        return window.electron.onStoreUpdate(handler);
    }

    onErrorMsg(handler: (error: Error) => void): () => void {
        return window.electron.onErrorMsg(handler);
    }

    onInfoMsg(handler: (info: string) => void): () => void {
        return window.electron.onInfoMsg(handler);
    }
}

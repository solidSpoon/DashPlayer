import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';

/**
 * 渲染进程接收设置变化和提示消息的事件端口。
 */
export interface StoreEventsPort {
    onStoreUpdate(handler: (key: RuntimeSettingKey, value: string) => void): () => void;
    onErrorMsg?(handler: (error: Error) => void): () => void;
    onInfoMsg?(handler: (info: string) => void): () => void;
}

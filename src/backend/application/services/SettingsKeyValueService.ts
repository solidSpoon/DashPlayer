import { inject, injectable } from 'inversify';

import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';
import RendererEvents from '@/backend/application/ports/gateways/renderer/RendererEvents';
import TYPES from '@/backend/ioc/types';
import { SettingKey } from '@/common/types/store_schema';

/**
 * 读写设置项，并在写入成功后通知渲染进程。
 */
@injectable()
export default class SettingsKeyValueService {
    @inject(TYPES.SettingsStore)
    private settingsStore!: SettingsStore;

    @inject(TYPES.RendererEvents)
    private rendererEvents!: RendererEvents;

    /**
     * 保存设置项，并在值确实发生变化时发送更新事件。
     *
     * @param key 设置键。
     * @param value 设置值。
     */
    public async set(key: SettingKey, value: string): Promise<void> {
        if (this.settingsStore.set(key, value)) {
            this.rendererEvents.storeUpdate(key, value);
        }
    }

    /**
     * 读取指定设置项。
     *
     * @param key 设置键。
     * @returns 当前设置值。
     */
    public async get(key: SettingKey): Promise<string> {
        return this.settingsStore.get(key);
    }
}

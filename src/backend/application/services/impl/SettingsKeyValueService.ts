import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';
import RendererEvents from '@/backend/infrastructure/renderer/RendererEvents';
import TYPES from '@/backend/ioc/types';
import { SettingKey } from '@/common/types/store_schema';
import { inject, injectable } from 'inversify';

@injectable()
export default class SettingsKeyValueService {
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;

    public async set(key: SettingKey, value: string): Promise<void> {
        if (this.settingsStore.set(key, value)) {
            this.rendererEvents.storeUpdate(key, value);
        }
    }

    public async get(key: SettingKey): Promise<string> {
        return this.settingsStore.get(key);
    }
}


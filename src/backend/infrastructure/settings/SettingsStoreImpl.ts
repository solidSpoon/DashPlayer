import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';
import { storeGet, storeSet } from '@/backend/infrastructure/settings/store';
import { SettingKey } from '@/common/types/store_schema';
import { injectable } from 'inversify';

@injectable()
export default class SettingsStoreImpl implements SettingsStore {
    public get(key: SettingKey): string {
        return storeGet(key);
    }

    public set(key: SettingKey, value: string | undefined | null): boolean {
        return storeSet(key, value);
    }
}


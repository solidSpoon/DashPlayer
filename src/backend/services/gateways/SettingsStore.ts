import { SettingKey } from '@/common/types/store_schema';

export interface SettingsStore {
    get(key: SettingKey): string;
    set(key: SettingKey, value: string | undefined | null): boolean;
}


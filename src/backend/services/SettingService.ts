import { SettingKey } from '@/common/types/store_schema';

export default interface SettingService {
    set(key: SettingKey, value: string): Promise<void>;
    get(key: SettingKey): Promise<string>;
}

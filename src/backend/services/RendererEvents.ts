import { SettingKey } from '@/common/types/store_schema';
import { DpTask } from '@/backend/db/tables/dpTask';

export default interface RendererEvents {
    storeUpdate(key: SettingKey, value: string): void;
    dpTaskUpdate(task: DpTask): void;
}


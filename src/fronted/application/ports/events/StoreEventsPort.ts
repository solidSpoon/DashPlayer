import { SettingKey } from '@/common/types/store_schema';

export interface StoreEventsPort {
    onStoreUpdate(handler: (key: SettingKey, value: string) => void): () => void;
    onErrorMsg?(handler: (error: Error) => void): () => void;
    onInfoMsg?(handler: (info: string) => void): () => void;
}


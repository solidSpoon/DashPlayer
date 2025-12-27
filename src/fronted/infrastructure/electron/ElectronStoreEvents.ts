import { SettingKey } from '@/common/types/store_schema';
import type { StoreEventsPort } from '@/fronted/application/ports/events/StoreEventsPort';

export class ElectronStoreEvents implements StoreEventsPort {
    onStoreUpdate(handler: (key: SettingKey, value: string) => void): () => void {
        return window.electron.onStoreUpdate(handler);
    }

    onErrorMsg(handler: (error: Error) => void): () => void {
        return window.electron.onErrorMsg(handler);
    }

    onInfoMsg(handler: (info: string) => void): () => void {
        return window.electron.onInfoMsg(handler);
    }
}


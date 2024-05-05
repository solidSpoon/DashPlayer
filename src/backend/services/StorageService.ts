import {SettingKey} from "@/common/types/store_schema";
import {storeGet, storeSet} from "../store";
import SystemService from "@/backend/services/SystemService";

export default class StorageService {

    public static async storeSet(key: SettingKey, value: string): Promise<void> {
        if (storeSet(key, value)) {
            SystemService.mainWindowRef?.webContents.send('store-update', key, value);
        }
    }

    public static async storeGet(key: SettingKey): Promise<string> {
        return storeGet(key);
    }
}

import Store from 'electron-store';
import {SettingKey, SettingKeyObj} from "@/common/types/store_schema";
import StrUtil from '@/common/utils/str-util';


const store = new Store();

export const storeSet = (key: SettingKey, value: string | undefined | null): boolean => {
    if (StrUtil.isBlank(value)) {
        value = SettingKeyObj[key];
    }
    const oldValue = store.get(key, SettingKeyObj[key]);
    if (oldValue === value) {
       return false;
    }
    store.set(key, value);
    return true;
};

export const storeGet = (key: SettingKey): string => {
    return store.get(key, SettingKeyObj[key]) as string;
}

export const storeSetObject = (key: SettingKey, value: any): void => {
    store.set(key, value);
}

export const storeGetObject = <T>(key: SettingKey, defaultValue?: T): T => {
    let retrievedValue = store.get(key, defaultValue) as T;
    return retrievedValue;
}



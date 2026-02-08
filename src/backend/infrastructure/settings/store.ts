import Store from 'electron-store';
import {SettingKey, SettingKeyObj} from '@/common/types/store_schema';
import StrUtil from '@/common/utils/str-util';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';


const buildStore = (name: string): Store<Record<string, unknown>> => {
    return new Store({ name });
};

const store = buildStore(getEnvironmentConfigName('config'));

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

import Store from 'electron-store';
import {SettingKey, SettingKeyObj} from '@/common/types/store_schema';
import StrUtil from '@/common/utils/str-util';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';


const buildStore = (name: string): Store<Record<string, unknown>> => {
    return new Store({ name });
};

const store = buildStore(getEnvironmentConfigName('config'));

/**
 * 判断当前设置项是否属于可被用户清空的快捷键配置。
 */
const isShortcutSettingKey = (key: SettingKey): boolean => key.startsWith('shortcut.');

/**
 * 订阅设置项变化。
 *
 * 说明：electron-store 的 onDidChange 只对同一实例的 set() 生效，
 * 因此统一基于 store.ts 内的单例 store 订阅，避免跨实例监听同一份文件收不到事件。
 *
 * @param key 要监听的设置项
 * @param callback 变化回调（无参，触发时按需自行读取最新值）
 * @returns 取消订阅函数
 */
export const subscribeSettingChange = (key: SettingKey, callback: () => void): (() => void) => {
    return store.onDidChange(key, () => {
        callback();
    });
};

/**
 * 写入设置值。
 *
 * 行为说明：
 * - 快捷键配置允许写入空字符串，表示显式取消绑定。
 * - 非快捷键配置仍沿用历史行为：空值回落到默认值。
 */
export const storeSet = (key: SettingKey, value: string | undefined | null): boolean => {
    if (StrUtil.isBlank(value) && !isShortcutSettingKey(key)) {
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

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
};

/**
 * 读取真实持久化过的非空字符串值，不做 schema 默认值兜底。
 *
 * 与 storeGet 的区别：仅当用户/历史版本显式写入过该键时返回内容，
 * 其余（键不存在、非字符串、空白串）返回 null。供启动迁移判断
 * 「用户是否显式设置过」；键允许是已从 schema 移除的历史键。
 *
 * @param key 设置键（可以是历史键）。
 * @returns 持久化过的非空字符串；未持久化或空白返回 null。
 */
export const storeGetPersisted = (key: string): string | null => {
    const value = store.get(key);
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

/**
 * 判断键是否被真实持久化过（配置文件里存在该键），与 schema 默认值无关。
 *
 * @param key 设置键（可以是历史键）。
 * @returns 配置文件里存在该键时为 true。
 */
export const storeHas = (key: string): boolean => {
    return store.has(key);
};

/**
 * 删除设置项，供启动迁移清理已废弃的历史键。
 *
 * 必须走本单例：electron-store 每次落盘都是整份内存快照写回文件，
 * 若用独立实例 delete，单例后续的任何写入都会把已删键带回磁盘。
 * 参数放宽为 string：被清理的键可能已不在 SettingKey 联合类型里。
 *
 * @param key 要删除的设置键。
 */
export const storeDelete = (key: string): void => {
    store.delete(key);
};

/**
 * 清空全部持久化设置，恢复到 schema 默认值状态。
 *
 * 仅供迁移失败后的「重置并重试」使用：有损操作，会清除用户全部显式设置
 * （含 API 密钥、引擎选择与引导完成标记）。
 */
export const storeClear = (): void => {
    store.clear();
};

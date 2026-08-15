/**
 * 管理前端设置缓存，并把用户修改持久化到后端存储。
 */
import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import {
    RuntimeSettingKey,
    RuntimeSettingsSnapshot,
    RuntimeWritableSettingKey,
} from '@/common/contracts/runtime-settings';

/**
 * 渲染进程中的运行时设置状态。
 */
export type SettingState = {
    /** 是否已经完成首次设置快照初始化。 */
    init: boolean;
    /** 当前可供渲染进程使用的非敏感设置。 */
    values: Map<RuntimeSettingKey, string>;
};

/**
 * 运行时设置状态的操作。
 */
export type SettingActions = {
    /**
     * 保存播放器运行期间允许修改的设置。
     *
     * @param key 可直接修改的运行时设置键。
     * @param value 已序列化的设置值。
     */
    setSetting: (key: RuntimeWritableSettingKey, value: string) => Promise<void>;
    /**
     * 仅更新渲染进程缓存，不触发持久化。
     *
     * @param key 运行时设置键。
     * @param value 已序列化的设置值。
     */
    setLocalSetting: (key: RuntimeSettingKey, value: string) => void;
    /**
     * 用后端快照原子初始化设置缓存。
     *
     * @param snapshot 后端返回的完整运行时设置快照。
     */
    initialize: (snapshot: RuntimeSettingsSnapshot) => void;
    /**
     * 读取一个运行时设置。
     *
     * @param key 运行时设置键。
     * @returns 设置值；未初始化或数据缺失时返回空字符串。
     */
    setting: (key: RuntimeSettingKey) => string;
};

const useSetting = create(
    subscribeWithSelector<SettingState & SettingActions>((set, get) => ({
        init: false,
        values: new Map<RuntimeSettingKey, string>(),
        setSetting: async (key: RuntimeWritableSettingKey, value: string) => {
            await backendClient.call('settings/runtime/save', {key, value});
            set((state) => ({
                ...state,
                values: new Map(state.values).set(key, value),
            }));
        },
        setLocalSetting: (key: RuntimeSettingKey, value: string) => {
            set((state) => ({
                ...state,
                values: new Map(state.values).set(key, value),
            }));
        },
        initialize: (snapshot: RuntimeSettingsSnapshot) => {
            set({
                init: true,
                values: new Map(
                    Object.entries(snapshot) as [RuntimeSettingKey, string][],
                ),
            });
        },
        setting: (key: RuntimeSettingKey) => {
            return get().values.get(key) ?? '';
        },
    }))
);

export default useSetting;

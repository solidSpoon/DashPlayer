import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {SettingKey, SettingKeyObj} from '@/common/types/store_schema';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const api = window.electron;

export type SettingState = {
    init: boolean;
    values: Map<SettingKey, string>;
};

export type SettingActions = {
    setSetting: (key: SettingKey, value: string) => Promise<void>;
    setLocalSetting: (key: SettingKey, value: string) => void;
    setting: (key: SettingKey) => string;
};

const useSetting = create(
    subscribeWithSelector<SettingState & SettingActions>((set, get) => ({
        init: false,
        values: new Map<SettingKey, string>(),
        setSetting: async (key: SettingKey, value: string) => {
            set((state) => ({
                ...state,
                values: new Map(state.values).set(key, value),
            }));
            await api.call('storage/put', { key, value });
        },
        setLocalSetting: (key: SettingKey, value: string) => {
            set((state) => ({
                ...state,
                values: new Map(state.values).set(key, value),
            }));
        },
        setting: (key: SettingKey) => {
            return get().values.get(key) ?? '';
        },
    }))
);

for (const key in SettingKeyObj) {
    const k = key as SettingKey;
    getRendererLogger('useSetting').debug('setting init', { key: k });
    api.call('storage/get', k).then((value: string) => {
        getRendererLogger('useSetting').debug('setting init value', { key: k, value });
        useSetting.getState().setLocalSetting(k, value);
    });
}

api.onStoreUpdate((key: SettingKey, value: string) => {
    getRendererLogger('useSetting').debug('store update', { key, value });
    const oldValues = useSetting.getState().values.get(key);
    if (oldValues !== value) {
        useSetting.getState().setLocalSetting(key, value);
    }
});

export default useSetting;

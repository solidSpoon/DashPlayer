import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {SettingKey} from '@/common/types/store_schema';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

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
            await backendClient.call('storage/put', { key, value });
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

export default useSetting;

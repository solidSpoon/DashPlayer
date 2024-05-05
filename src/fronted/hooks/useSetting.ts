import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {SettingKey, SettingKeyObj} from '@/common/types/store_schema';

const api = window.electron;

export type SettingState = {
    init: boolean;
    values: Map<SettingKey, string>;
};

export type SettingActions = {
    setSetting: (key: SettingKey, value: string) => void;
    setting: (key: SettingKey) => string;
};

const useSetting = create(
    subscribeWithSelector<SettingState & SettingActions>((set, get) => ({
        init: false,
        values: new Map<SettingKey, string>(),
        setSetting: async (key: SettingKey, value: string) => {
            set((state) => {
                return {
                    ...state,
                    values: new Map(state.values).set(key, value),
                    setting: (key: SettingKey) => {
                        return get().values.get(key) ?? '';
                    },
                };
            });
            await api.call('storage/put', {key, value});
        },
        setting: (key: SettingKey) => {
            return get().values.get(key) ?? '';
        },
    }))
);

for (const key in SettingKeyObj) {
    const k = key as SettingKey;
    console.log('setting init', k);
    api.call('storage/get', k).then((value: string) => {
        console.log('setting init', k, value);
        useSetting.getState().setSetting(k, value);
    });
}

api.onStoreUpdate((key: SettingKey, value: string) => {
    console.log('onStoreUpdate', key, value);
    const oldValues = useSetting.getState().values.get(key);
    if (oldValues !== value) {
        useSetting.getState().setSetting(key, value);
    }
});

export default useSetting;

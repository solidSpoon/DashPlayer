import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_SETTING, ShortCutValue } from '../../types/SettingType';

const api = window.electron;
interface Secret {
    secretId: string;
    secretKey: string;
}

export type SettingState = {
    keyBinds: ShortCutValue;
    tencentSecret: Secret;
    youdaoSecret: Secret;
};

export const clone = (setting: SettingState): SettingState => {
    return {
        keyBinds: setting.keyBinds,
        tencentSecret: setting.tencentSecret,
        youdaoSecret: setting.youdaoSecret,
    };
};

type Actions = {
    updateKeyBinds: (key: keyof ShortCutValue, value: string) => void;
    setKeyBinds: (keyBinds: ShortCutValue) => void;
};

const useSetting = create(
    subscribeWithSelector<SettingState & Actions>((set) => ({
        ...DEFAULT_SETTING,
        updateKeyBinds: (key: keyof ShortCutValue, value: string) => {
            set((state) => ({
                keyBinds: {
                    ...state.keyBinds,
                    [key]: value,
                },
            }));
        },
        setKeyBinds: (keyBinds: ShortCutValue) => {
            set({
                keyBinds,
            });
        },
    }))
);
// eslint-disable-next-line promise/catch-or-return,promise/always-return
api.getSetting().then((setting: SettingState) => {
    useSetting.setState(setting);
});
useSetting.subscribe(async (state) => {
    await api.updateSetting(clone(state));
});
api.onUpdateSetting((serverSetting: SettingState) => {
    const localSetting = clone(useSetting.getState());
    if (JSON.stringify(localSetting) === JSON.stringify(serverSetting)) {
        return;
    }
    useSetting.setState(serverSetting);
});

export default useSetting;

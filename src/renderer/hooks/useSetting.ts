import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_SETTING, ShortCutValue } from '../../types/SettingType';

const api = window.electron;
export interface Secret {
    secretId: string;
    secretKey: string;
}
export type FontSize = 'fontSizeSmall' | 'fontSizeMedium' | 'fontSizeLarge';
export interface Appearance {
    theme: string;
    fontSize: FontSize;
}
export type SettingState = {
    keyBinds: ShortCutValue;
    tencentSecret: Secret;
    youdaoSecret: Secret;
    appearance: Appearance;
};

export const clone = (setting: SettingState): SettingState => {
    return {
        keyBinds: setting.keyBinds,
        tencentSecret: setting.tencentSecret,
        youdaoSecret: setting.youdaoSecret,
        appearance: setting.appearance,
    };
};

type Actions = {
    setKeyBinds: (keyBinds: ShortCutValue) => void;
    setTencentSecret: (secret: Secret) => void;
    setYoudaoSecret: (secret: Secret) => void;
    setAppearance: (appearance: Appearance) => void;
    setTheme: (theme: string) => void;
};

const useSetting = create(
    subscribeWithSelector<SettingState & Actions>((set) => ({
        ...DEFAULT_SETTING,
        setKeyBinds: (keyBinds: ShortCutValue) => {
            set({
                keyBinds,
            });
        },
        setTencentSecret: (secret: Secret) => {
            set({
                tencentSecret: secret,
            });
        },
        setYoudaoSecret: (secret: Secret) => {
            set({
                youdaoSecret: secret,
            });
        },
        setAppearance: (appearance: Appearance) => {
            set({
                appearance,
            });
        },
        setTheme: (theme: string) => {
            set((state) => {
                const appearance = { ...state.appearance, theme };
                return {
                    ...state,
                    appearance,
                };
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
    console.log('serverSetting', serverSetting);
    const localSetting = clone(useSetting.getState());
    if (JSON.stringify(localSetting) === JSON.stringify(serverSetting)) {
        return;
    }
    useSetting.setState(serverSetting);
});

export default useSetting;

export const nextThemeName = (theme: string): string => {
    const themes = ['light', 'bright', 'deep', 'dark'];
    const index = themes.indexOf(theme);
    return themes[(index + 1) % themes.length];
};
export const prevThemeName = (theme: string): string => {
    const themes = ['light', 'bright', 'deep', 'dark'];
    const index = themes.indexOf(theme);
    return themes[(index - 1 + themes.length) % themes.length];
};

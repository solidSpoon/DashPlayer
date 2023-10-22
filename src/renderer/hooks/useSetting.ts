import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_SETTING, ShortCutValue } from '../../types/SettingType';
import { THEME, ThemeType } from '../../types/Types';

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

const themes = THEME.map((theme) => theme.name);
export const nextThemeName = (theme: string): string => {
    const index = themes.indexOf(theme);
    return themes[(index + 1) % themes.length];
};
export const prevThemeName = (theme: string): string => {
    const index = themes.indexOf(theme);
    return themes[(index - 1 + themes.length) % themes.length];
};

export const isColorfulTheme = (theme: string): boolean => {
    return theme.startsWith('colorful');
};

export const colorfulProp = (theme: string): string => {
    if (theme === 'colorful one') {
        return 'bg-gradient-to-br from-orange-500  via-red-500 to-rose-500';
    }
    if (theme === 'colorful two') {
        return 'bg-gradient-to-br from-green-500  via-teal-500 to-cyan-500';
    }
    if (theme === 'colorful three') {
        return 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500';
    }
    return '';
};
export const usingThemeName = (theme: string): string => {
    return (
        THEME.find((item: ThemeType) => item.name === theme)?.usingThemeName ??
        'light'
    );
};

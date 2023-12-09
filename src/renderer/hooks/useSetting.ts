import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { THEME, ThemeType } from '../../types/Types';
import { SettingKey, SettingKeyObj } from '../../types/store_schema';

const api = window.electron;

export type SettingState = {
    init: boolean;
    values: Map<SettingKey, string>;
}

export type SettingActions = {
    setSetting: (key: SettingKey, value: string) => void;
};



const useSetting = create(
    subscribeWithSelector<SettingState & SettingActions>((set, get) => ({
        init: false,
        values: new Map<SettingKey, string>(),
        setSetting: (key: SettingKey, value: string) => {
            set((state) => {
                    return {
                        ...state,
                        values: new Map(state.values).set(key, value)
                    };
                }
            );
            api.storeSet(key, value);
        }
    }))
);


// 遍历 type: SettingKeyObj
const promiseArr = [];
for (const key in SettingKeyObj) {
    const k = key as SettingKey;
    let promise = api.storeGet(k).then((value: string) => {
            useSetting.setState({
                [k]: value
            });
        }
    );
    promiseArr.push(promise);
}
Promise.all(promiseArr).then(() => {
    useSetting.setState({
        init: true
    });
});

api.onStoreUpdate((key:SettingKey) => {
    api.storeGet(key).then((value: string) => {
            useSetting.setState({
                [key]: value
            });
        }
    );
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

export const usingThemeName = (theme: string): string => {
    return (
        THEME.find((item: ThemeType) => item.name === theme)?.usingThemeName ??
        'light'
    );
};

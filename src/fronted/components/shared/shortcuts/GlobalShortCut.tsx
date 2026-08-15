import React from 'react';
import useSetting from '@/fronted/features/settings/settingsStore';
import {useHotkeys} from "react-hotkeys-hook";

/**
 * 规范化快捷键字符串，去除空白与空项。
 */
const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')

/**
 * 注册全局快捷键（当前仅包含主题切换）。
 */
export default function GlobalShortCut() {
    const nextThemeShortcut = useSetting((s) => s.values.get('shortcut.nextTheme') ?? '');
    const theme = useSetting((s) => s.values.get('appearance.theme') ?? '');
    const setSetting = useSetting((s) => s.setSetting);

    useHotkeys(process(nextThemeShortcut), () => {
        void setSetting('appearance.theme', theme === 'dark' ? 'light' : 'dark');
    }, [theme, setSetting]);
    return <></>;
}

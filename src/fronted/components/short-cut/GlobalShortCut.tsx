import React from 'react';
import useSetting from '../../hooks/useSetting';
import {useHotkeys} from "react-hotkeys-hook";

const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
export default function GlobalShortCut() {

    const setting = useSetting((s) => s.setting);
    const setSetting = useSetting((s) => s.setSetting);
    useHotkeys(process(setting('shortcut.nextTheme')), () => {
        setSetting('appearance.theme', setting('appearance.theme') === 'dark' ? 'light' : 'dark');
    });
    return <></>;
}

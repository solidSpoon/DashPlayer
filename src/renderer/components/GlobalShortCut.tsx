import { ReactNode } from 'react';
import Keyevent from 'react-keyevent';
import { useShallow } from 'zustand/react/shallow';
import { Action, next, prev, repeat } from '../lib/CallAction';
import { defaultShortcut } from '../../types/SettingType';
import useSetting, { nextThemeName, prevThemeName } from '../hooks/useSetting';
import usePlayerController from '../hooks/usePlayerController';

interface ReactParam {
    // eslint-disable-next-line react/require-default-props
    children?: ReactNode;
}

interface GlobalShortCutParam extends ReactParam {
    onAction: (action: Action) => void;
}

export default function GlobalShortCut(
    this: any,
    { onAction, children }: GlobalShortCutParam
) {
    const {
        space,
        changeShowEn,
        changeShowCn,
        changeShowEnCn,
        changeSingleRepeat,
    } = usePlayerController(
        useShallow((s) => ({
            space: s.space,
            changeShowEn: s.changeShowEn,
            changeShowCn: s.changeShowCn,
            changeShowEnCn: s.changeShowEnCn,
            changeSingleRepeat: s.changeSingleRepeat,
        }))
    );
    const keyBinds = useSetting((s) => s.keyBinds);
    const theme = useSetting((s) => s.appearance.theme);
    const setTheme = useSetting((s) => s.setTheme);
    const events: { [key: string]: () => void } = {};
    events.onLeft = onAction.bind(this, prev());
    events.onRight = onAction.bind(this, next());
    events.onDown = onAction.bind(this, repeat());
    events.onSpace = space;
    events.onUp = space;

    const registerKey = (
        values: string | undefined,
        defaultKey: string,
        action: Action | (() => void)
    ) => {
        const finalValues =
            !values || values.trim() === '' ? defaultKey : values;
        const keyArr = finalValues
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k !== '')
            .map((k) => k.toUpperCase());
        keyArr.forEach((k) => {
            if (typeof action === 'function') {
                events[`on${k}`] = action;
            } else {
                events[`on${k}`] = onAction.bind(this, action);
            }
        });
    };

    registerKey(keyBinds?.last, defaultShortcut.last, prev());
    registerKey(keyBinds?.next, defaultShortcut.next, next());
    registerKey(keyBinds?.repeat, defaultShortcut.repeat, repeat());
    registerKey(keyBinds?.space, defaultShortcut.space, space);
    registerKey(
        keyBinds?.singleRepeat,
        defaultShortcut.singleRepeat,
        changeSingleRepeat
    );
    registerKey(keyBinds?.showEn, defaultShortcut.showEn, changeShowEn);
    registerKey(keyBinds?.showCn, defaultShortcut.showCn, changeShowCn);
    registerKey(keyBinds?.sowEnCn, defaultShortcut.sowEnCn, changeShowEnCn);
    registerKey(
        keyBinds?.nextTheme,
        defaultShortcut.nextTheme,
        setTheme.bind(this, nextThemeName(theme))
    );
    registerKey(
        keyBinds?.prevTheme,
        defaultShortcut.prevTheme,
        setTheme.bind(this, prevThemeName(theme))
    );
    return (
        <Keyevent className="TopSide" events={events} needFocusing={false}>
            {children}
        </Keyevent>
    );
}

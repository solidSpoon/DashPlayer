import { ReactNode } from 'react';
import Keyevent from 'react-keyevent';
import {
    Action,
    next,
    prev,
    repeat,
    showCn,
    showEn,
    showEnCn,
    singleRepeat,
    space,
} from '../lib/CallAction';
import useTheme from '../hooks/useTheme';
import { defaultShortcut } from '../../types/SettingType';
import useSetting from '../hooks/useSetting';

export enum JumpPosition {
    BEFORE = 0,
    AFTER = 1,
    CURRENT = 2,
}

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
    const keyBinds = useSetting((s) => s.keyBinds);
    const nextTheme = useTheme((s) => s.nextTheme);
    const prevTheme = useTheme((s) => s.prevTheme);
    const events: { [key: string]: () => void } = {};
    events.onLeft = onAction.bind(this, prev());
    events.onRight = onAction.bind(this, next());
    events.onDown = onAction.bind(this, repeat());
    events.onSpace = onAction.bind(this, space());
    events.onUp = onAction.bind(this, space());

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
    registerKey(keyBinds?.space, defaultShortcut.space, space());
    registerKey(
        keyBinds?.singleRepeat,
        defaultShortcut.singleRepeat,
        singleRepeat()
    );
    registerKey(keyBinds?.showEn, defaultShortcut.showEn, showEn());
    registerKey(keyBinds?.showCn, defaultShortcut.showCn, showCn());
    registerKey(keyBinds?.sowEnCn, defaultShortcut.sowEnCn, showEnCn());
    registerKey(keyBinds?.nextTheme, defaultShortcut.nextTheme, nextTheme);
    registerKey(keyBinds?.prevTheme, defaultShortcut.prevTheme, prevTheme);
    return (
        <Keyevent className="TopSide" events={events} needFocusing={false}>
            {children}
        </Keyevent>
    );
}

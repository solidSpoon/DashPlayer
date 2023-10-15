import { ReactNode, useEffect, useState } from 'react';
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
import callApi from '../lib/apis/ApiWrapper';
import { defaultShortcut } from '../windows/setting/sub/ShortcutSetting';
import useTheme from '../hooks/useTheme';

const api = window.electron;

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

export interface ShortCutValue {
    /**
     * 上一句
     */
    last: string;
    /**
     * 下一句
     */
    next: string;
    /**
     * 重复
     */
    repeat: string;
    /**
     * 播放/暂停
     */
    space: string;
    /**
     * 单句重复
     */
    singleRepeat: string;
    /**
     * 显示/隐藏英文
     */
    showEn: string;
    /**
     * 显示/隐藏中文
     */
    showCn: string;
    /**
     * 显示/隐藏中英
     */
    sowEnCn: string;
    /**
     * next theme
     */
    nextTheme: string;
    /**
     * previous theme
     */
    prevTheme: string;
}

export default function GlobalShortCut(
    this: any,
    { onAction, children }: GlobalShortCutParam
) {
    const [shortCutValue, setShortCutValue] = useState<ShortCutValue>();
    const nextTheme = useTheme((s) => s.nextTheme);
    const prevTheme = useTheme((s) => s.prevTheme);
    useEffect(() => {
        const updateFromServer = async () => {
            let newVar = (await callApi('get-shortcut', [])) as string;
            if (!newVar || newVar === '') {
                newVar = JSON.stringify(defaultShortcut);
            }
            const newVal: ShortCutValue = JSON.parse(newVar);
            const eqServer =
                shortCutValue?.last === newVal.last &&
                shortCutValue?.next === newVal.next &&
                shortCutValue?.repeat === newVal.repeat &&
                shortCutValue?.space === newVal.space &&
                shortCutValue?.singleRepeat === newVal.singleRepeat &&
                shortCutValue?.showEn === newVal.showEn &&
                shortCutValue?.showCn === newVal.showCn &&
                shortCutValue?.sowEnCn === newVal.sowEnCn &&
                shortCutValue?.nextTheme === newVal.nextTheme &&
                shortCutValue?.prevTheme === newVal.prevTheme;
            if (!eqServer) {
                setShortCutValue(newVal);
            }
        };
        const unSub = api.onSettingUpdate(updateFromServer);
        return () => {
            unSub();
        };
    }, [shortCutValue]);

    useEffect(() => {
        const fun = () => {
            console.log('sssssss');
        };
        const unSub = api.onSettingUpdate(fun);
        return () => {
            unSub();
        };
    }, []);

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

    registerKey(shortCutValue?.last, defaultShortcut.last, prev());
    registerKey(shortCutValue?.next, defaultShortcut.next, next());
    registerKey(shortCutValue?.repeat, defaultShortcut.repeat, repeat());
    registerKey(shortCutValue?.space, defaultShortcut.space, space());
    registerKey(
        shortCutValue?.singleRepeat,
        defaultShortcut.singleRepeat,
        singleRepeat()
    );
    registerKey(shortCutValue?.showEn, defaultShortcut.showEn, showEn());
    registerKey(shortCutValue?.showCn, defaultShortcut.showCn, showCn());
    registerKey(shortCutValue?.sowEnCn, defaultShortcut.sowEnCn, showEnCn());
    registerKey(shortCutValue?.nextTheme, defaultShortcut.nextTheme, nextTheme);
    registerKey(shortCutValue?.prevTheme, defaultShortcut.prevTheme, prevTheme);

    console.log('register events', events);
    return (
        <Keyevent className="TopSide" events={events} needFocusing={false}>
            {children}
        </Keyevent>
    );
}

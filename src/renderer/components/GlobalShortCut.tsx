import { Component, ReactNode, useCallback, useEffect, useState } from 'react';
import Keyevent from 'react-keyevent';
import { Action, next, prev, repeat, space } from '../lib/CallAction';
import callApi from '../lib/apis/ApiWrapper';

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
}

export default function GlobalShortCut(
    this: any,
    { onAction, children }: GlobalShortCutParam
) {
    const [shortCutValue, setShortCutValue] = useState<ShortCutValue>();

    useEffect(() => {
        const updateFromServer = async () => {
            const newVar = (await callApi('get-shortcut', [])) as string;
            if (!newVar || newVar === '') {
                return;
            }
            const newVal: ShortCutValue = JSON.parse(newVar);
            const eqServer =
                shortCutValue?.last === newVal.last &&
                shortCutValue?.next === newVal.next &&
                shortCutValue?.repeat === newVal.repeat &&
                shortCutValue?.space === newVal.space;
            if (!eqServer) {
                setShortCutValue(newVal);
            }
        };
        const interval = setInterval(() => {
            updateFromServer();
        }, 5000);
        return () => clearInterval(interval);
    }, [shortCutValue]);

    const events: { [key: string]: () => void } = {};
    events.onLeft = onAction.bind(this, prev());
    events.onRight = onAction.bind(this, next());
    events.onDown = onAction.bind(this, repeat());
    events.onSpace = onAction.bind(this, space());
    events.onUp = onAction.bind(this, space());

    const registerKey = (
        values: string | undefined,
        defaultKey: string,
        action: Action
    ) => {
        const finalValues =
            !values || values.trim() === '' ? defaultKey : values;
        const keyArr = finalValues
            .split(',')
            .map((k) => k.trim())
            .map((k) => k.toUpperCase());
        keyArr.forEach((k) => {
            console.log('register', k);
            events[`on${k}`] = onAction.bind(this, action);
        });
    };

    registerKey(shortCutValue?.last, 'a', prev());
    registerKey(shortCutValue?.next, 'd', next());
    registerKey(shortCutValue?.repeat, 's', repeat());
    registerKey(shortCutValue?.space, 'w', space());

    console.log('register events', events);
    return (
        <Keyevent className="TopSide" events={events} needFocusing={false}>
            {children}
        </Keyevent>
    );
}

import { ReactNode } from 'react';
import Keyevent from 'react-keyevent';
import { useShallow } from 'zustand/react/shallow';
import useSetting from '../hooks/useSetting';
import usePlayerController from '../hooks/usePlayerController';
import useSubtitleScroll from '../hooks/useSubtitleScroll';

interface ReactParam {
    // eslint-disable-next-line react/require-default-props
    children?: ReactNode;
}

export default function GlobalShortCut(this: any, { children }: ReactParam) {
    const {
        space,
        changeShowEn,
        changeShowCn,
        changeShowEnCn,
        changeShowWordLevel,
        changeSingleRepeat,
        prev,
        next,
        repeat,
        adjustStart,
        adjustEnd,
        clearAdjust,
        nextRate,
    } = usePlayerController(
        useShallow((s) => ({
            space: s.space,
            changeShowEn: s.changeShowEn,
            changeShowCn: s.changeShowCn,
            changeShowEnCn: s.changeShowEnCn,
            changeShowWordLevel: s.changeShowWordLevel,
            changeSingleRepeat: s.changeSingleRepeat,
            prev: s.prev,
            next: s.next,
            repeat: s.repeat,
            adjustStart: s.adjustStart,
            adjustEnd: s.adjustEnd,
            clearAdjust: s.clearAdjust,
            nextRate: s.nextRate,
        }))
    );
    const { onUserFinishScrolling, scrollState } = useSubtitleScroll((s) => ({
        onUserFinishScrolling: s.onUserFinishScrolling,
        scrollState: s.scrollState,
    }));

    const setting = useSetting((s) => s.setting);
    const setSetting = useSetting((s) => s.setSetting);
    const events: { [key: string]: () => void } = {};
    events.onLeft = () => {
        prev();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    };
    events.onRight = () => {
        next();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    };
    events.onDown = () => {
        repeat();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    };
    events.onSpace = space;
    events.onUp = space;

    const registerKey = (values: string, action: () => void) => {
        const keyArr = values
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k !== '')
            .map((k) => k.toUpperCase());
        keyArr.forEach((k) => {
            events[`on${k}`] = action;
        });
    };

    registerKey(setting('shortcut.previousSentence'), () => {
        prev();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    registerKey(setting('shortcut.nextSentence'), () => {
        next();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    registerKey(setting('shortcut.repeatSentence'), () => {
        repeat();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    registerKey(setting('shortcut.playPause'), space);
    registerKey(setting('shortcut.repeatSingleSentence'), changeSingleRepeat);
    registerKey(setting('shortcut.toggleEnglishDisplay'), changeShowEn);
    registerKey(setting('shortcut.toggleChineseDisplay'), changeShowCn);
    registerKey(setting('shortcut.toggleBilingualDisplay'), changeShowEnCn);
    registerKey(
        setting('shortcut.adjustBeginMinus'),
        adjustStart.bind(null, -0.2)
    );
    registerKey(
        setting('shortcut.adjustBeginPlus'),
        adjustStart.bind(null, 0.2)
    );
    registerKey(setting('shortcut.adjustEndMinus'), adjustEnd.bind(null, -0.2));
    registerKey(setting('shortcut.adjustEndPlus'), adjustEnd.bind(null, 0.2));
    registerKey(setting('shortcut.clearAdjust'), clearAdjust);
    registerKey(
        setting('shortcut.toggleWordLevelDisplay'),
        changeShowWordLevel
    );
    registerKey(
        setting('shortcut.nextTheme'),
        setSetting.bind(
            null,
            'appearance.theme',
            setting('appearance.theme') === 'dark' ? 'light' : 'dark'
        )
    );
    registerKey(setting('shortcut.nextPlaybackRate'), nextRate);
    return (
        <Keyevent className="TopSide" events={events} needFocusing={false}>
            {children}
        </Keyevent>
    );
}

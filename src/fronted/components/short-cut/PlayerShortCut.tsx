import {useShallow} from 'zustand/react/shallow';
import useSetting from '../../hooks/useSetting';
import usePlayerController from '../../hooks/usePlayerController';
import useSubtitleScroll from '../../hooks/useSubtitleScroll';
import useChatPanel from "@/fronted/hooks/useChatPanel";
import {useHotkeys} from "react-hotkeys-hook";


const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
export default function PlayerShortCut() {
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
        pause
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
            pause: s.pause
        }))
    );
    const {onUserFinishScrolling, scrollState} = useSubtitleScroll((s) => ({
        onUserFinishScrolling: s.onUserFinishScrolling,
        scrollState: s.scrollState
    }));

    const setting = useSetting((s) => s.setting);
    const events: { [key: string]: () => void } = {};
    const {createFromCurrent} = useChatPanel(useShallow((s) => ({
        createFromCurrent: s.createFromCurrent
    })));
    useHotkeys('left', () => {
        prev();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys('right', () => {
        next();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys('down', () => {
        repeat();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys('space', space);
    useHotkeys('up', space);
    useHotkeys(process(setting('shortcut.previousSentence')), () => {
        prev();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys(process(setting('shortcut.nextSentence')), () => {
        next();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys(process(setting('shortcut.repeatSentence')), () => {
        repeat();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys(process(setting('shortcut.playPause')), space);
    useHotkeys(process(setting('shortcut.repeatSingleSentence')), changeSingleRepeat);
    useHotkeys(process(setting('shortcut.toggleEnglishDisplay')), changeShowEn);
    useHotkeys(process(setting('shortcut.toggleChineseDisplay')), changeShowCn);
    useHotkeys(process(setting('shortcut.toggleBilingualDisplay')), changeShowEnCn);
    useHotkeys(process(setting('shortcut.adjustBeginMinus')), () => {
        adjustStart(-0.2);
    });
    useHotkeys(process(setting('shortcut.adjustBeginPlus')), () => {
        adjustStart(0.2);
    });
    useHotkeys(process(setting('shortcut.adjustEndMinus')), () => {
        adjustEnd(-0.2);
    });
    useHotkeys(process(setting('shortcut.adjustEndPlus')), () => {
        adjustEnd(0.2);
    });
    useHotkeys(process(setting('shortcut.clearAdjust')), clearAdjust);
    useHotkeys(process(setting('shortcut.toggleWordLevelDisplay')), changeShowWordLevel);
    useHotkeys(process(setting('shortcut.nextPlaybackRate')), nextRate);
    useHotkeys('slash', () => {
        pause();
        createFromCurrent();
    });
    return <></>;
}

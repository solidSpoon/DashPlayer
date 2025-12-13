import { useShallow } from 'zustand/react/shallow';
import { useHotkeys } from 'react-hotkeys-hook';

import useSetting from '../../hooks/useSetting';
import { useSubtitleScrollState } from '../../hooks/useSubtitleScroll';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import useCopyModeController from '../../hooks/useCopyModeController';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { playerV2Actions } from '@/fronted/components/player-components';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import usePlayerUi from '@/fronted/hooks/usePlayerUi';

const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
    .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space');

export default function PlayerShortCut() {
    const {
        changeShowEn,
        changeShowCn,
        changeShowEnCn,
        changeShowWordLevel
    } = usePlayerUi(
        useShallow((s) => ({
            changeShowEn: s.changeShowEn,
            changeShowCn: s.changeShowCn,
            changeShowEnCn: s.changeShowEnCn,
            changeShowWordLevel: s.changeShowWordLevel
        }))
    );

    const { onUserFinishScrolling, scrollState } = useSubtitleScrollState(
        useShallow((s) => ({
            onUserFinishScrolling: s.onUserFinishScrolling,
            scrollState: s.scrollState,
        }))
    );

    const setting = useSetting((s) => s.setting);
    const { createFromCurrent } = useChatPanel(useShallow((s) => ({
        createFromCurrent: s.createFromCurrent
    })));

    const { enterCopyMode, exitCopyMode, isCopyMode } = useCopyModeController();
    const setSingleRepeat = usePlayerV2((s) => s.setSingleRepeat);
    const setAutoPause = usePlayerV2((s) => s.setAutoPause);
    const singleRepeat = usePlayerV2((s) => s.singleRepeat);
    const autoPause = usePlayerV2((s) => s.autoPause);

    const toggleSingleRepeat = () => {
        setSingleRepeat(!singleRepeat);
    };
    const toggleAutoPause = () => {
        setAutoPause(!autoPause);
    };

    useHotkeys('left', () => {
        playerV2Actions.prevSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys('right', () => {
        playerV2Actions.nextSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys('down', (e) => {
        e.preventDefault();
        playerV2Actions.repeatCurrent({ loop: false });
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys('space', (e) => {
        e.preventDefault();
        playerV2Actions.togglePlay();
    });
    useHotkeys('up', (e) => {
        e.preventDefault();
        playerV2Actions.togglePlay();
    });
    useHotkeys(process(setting('shortcut.previousSentence')), () => {
        playerV2Actions.prevSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys(process(setting('shortcut.nextSentence')), () => {
        playerV2Actions.nextSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys(process(setting('shortcut.repeatSentence')), () => {
        playerV2Actions.repeatCurrent({ loop: false });
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    });
    useHotkeys(process(setting('shortcut.playPause')), playerV2Actions.togglePlay.bind(playerV2Actions));
    useHotkeys(process(setting('shortcut.repeatSingleSentence')), toggleSingleRepeat);
    useHotkeys(process(setting('shortcut.autoPause')), toggleAutoPause);
    useHotkeys(process(setting('shortcut.toggleEnglishDisplay')), changeShowEn);
    useHotkeys(process(setting('shortcut.toggleChineseDisplay')), changeShowCn);
    useHotkeys(process(setting('shortcut.toggleBilingualDisplay')), changeShowEnCn);
    useHotkeys(process(setting('shortcut.adjustBeginMinus')), () => {
        playerV2Actions.adjustCurrentBegin(-0.2);
    });
    useHotkeys(process(setting('shortcut.adjustBeginPlus')), () => {
        playerV2Actions.adjustCurrentBegin(0.2);
    });
    useHotkeys(process(setting('shortcut.adjustEndMinus')), () => {
        playerV2Actions.adjustCurrentEnd(-0.2);
    });
    useHotkeys(process(setting('shortcut.adjustEndPlus')), () => {
        playerV2Actions.adjustCurrentEnd(0.2);
    });
    useHotkeys(process(setting('shortcut.clearAdjust')), () => {
        void playerV2Actions.clearAdjust();
    });
    useHotkeys(process(setting('shortcut.toggleWordLevelDisplay')), changeShowWordLevel);
    useHotkeys(process(setting('shortcut.nextPlaybackRate')), playerV2Actions.cyclePlaybackRate.bind(playerV2Actions));
    useHotkeys(process(setting('shortcut.aiChat')), () => {
        playerV2Actions.pause();
        createFromCurrent();
    });

    useHotkeys(process(setting('shortcut.toggleCopyMode')), (ke, he) => {
        if (ke.type === 'keydown' && !isCopyMode) {
            enterCopyMode();
        } else if (ke.type === 'keyup' && isCopyMode) {
            exitCopyMode();
        }
    }, { keyup: true, keydown: true });
    useHotkeys(process(setting('shortcut.addClip')), async () => {
        useFavouriteClip.getState().changeCurrentLineClip();
    });
    return <></>;
}

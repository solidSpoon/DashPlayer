import { useShallow } from 'zustand/react/shallow';
import { useHotkeys } from 'react-hotkeys-hook';

import useSetting from '@/fronted/features/settings/settingsStore';
import { useSubtitleScrollState } from '@/fronted/features/player/hooks/useSubtitleScroll';
import useChatPanel from '@/fronted/features/chat/chatStore';
import useFavouriteClip from '@/fronted/features/favourite/favouriteStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';

const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
    .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space');

/**
 * 注册播放器页快捷键，并在快捷键配置变化后即时重绑。
 */
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

    const shortcuts = useSetting(useShallow((s) => ({
        previousSentence: s.values.get('shortcut.previousSentence') ?? '',
        nextSentence: s.values.get('shortcut.nextSentence') ?? '',
        repeatSentence: s.values.get('shortcut.repeatSentence') ?? '',
        playPause: s.values.get('shortcut.playPause') ?? '',
        repeatSingleSentence: s.values.get('shortcut.repeatSingleSentence') ?? '',
        autoPause: s.values.get('shortcut.autoPause') ?? '',
        toggleEnglishDisplay: s.values.get('shortcut.toggleEnglishDisplay') ?? '',
        toggleChineseDisplay: s.values.get('shortcut.toggleChineseDisplay') ?? '',
        toggleBilingualDisplay: s.values.get('shortcut.toggleBilingualDisplay') ?? '',
        adjustBeginMinus: s.values.get('shortcut.adjustBeginMinus') ?? '',
        adjustBeginPlus: s.values.get('shortcut.adjustBeginPlus') ?? '',
        adjustEndMinus: s.values.get('shortcut.adjustEndMinus') ?? '',
        adjustEndPlus: s.values.get('shortcut.adjustEndPlus') ?? '',
        clearAdjust: s.values.get('shortcut.clearAdjust') ?? '',
        toggleWordLevelDisplay: s.values.get('shortcut.toggleWordLevelDisplay') ?? '',
        nextPlaybackRate: s.values.get('shortcut.nextPlaybackRate') ?? '',
        aiChat: s.values.get('shortcut.aiChat') ?? '',
        addClip: s.values.get('shortcut.addClip') ?? '',
    })));
    const { createFromCurrent } = useChatPanel(useShallow((s) => ({
        createFromCurrent: s.createFromCurrent
    })));

    // 模式开关的写入统一走 PlayerActions，此处只订阅展示用的值
    const singleRepeat = usePlayer((s) => s.singleRepeat);
    const autoPause = usePlayer((s) => s.autoPause);

    const toggleSingleRepeat = () => {
        playerActions.setSingleRepeat(!singleRepeat);
    };
    const toggleAutoPause = () => {
        playerActions.setAutoPause(!autoPause);
    };

    useHotkeys('left', () => {
        playerActions.prevSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, [onUserFinishScrolling, scrollState]);
    useHotkeys('right', () => {
        playerActions.nextSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, [onUserFinishScrolling, scrollState]);
    useHotkeys('down', (e) => {
        e.preventDefault();
        playerActions.repeatCurrent({ loop: false });
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, [onUserFinishScrolling, scrollState]);
    useHotkeys('space', (e) => {
        e.preventDefault();
        playerActions.togglePlay();
    });
    useHotkeys('up', (e) => {
        e.preventDefault();
        playerActions.togglePlay();
    });
    useHotkeys(process(shortcuts.previousSentence), () => {
        playerActions.prevSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, [onUserFinishScrolling, scrollState]);
    useHotkeys(process(shortcuts.nextSentence), () => {
        playerActions.nextSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, [onUserFinishScrolling, scrollState]);
    useHotkeys(process(shortcuts.repeatSentence), () => {
        playerActions.repeatCurrent({ loop: false });
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, [onUserFinishScrolling, scrollState]);
    useHotkeys(process(shortcuts.playPause), playerActions.togglePlay.bind(playerActions));
    useHotkeys(process(shortcuts.repeatSingleSentence), toggleSingleRepeat, [toggleSingleRepeat]);
    useHotkeys(process(shortcuts.autoPause), toggleAutoPause, [toggleAutoPause]);
    useHotkeys(process(shortcuts.toggleEnglishDisplay), changeShowEn);
    useHotkeys(process(shortcuts.toggleChineseDisplay), changeShowCn);
    useHotkeys(process(shortcuts.toggleBilingualDisplay), changeShowEnCn);
    useHotkeys(process(shortcuts.adjustBeginMinus), () => {
        playerActions.adjustCurrentBegin(-0.2);
    });
    useHotkeys(process(shortcuts.adjustBeginPlus), () => {
        playerActions.adjustCurrentBegin(0.2);
    });
    useHotkeys(process(shortcuts.adjustEndMinus), () => {
        playerActions.adjustCurrentEnd(-0.2);
    });
    useHotkeys(process(shortcuts.adjustEndPlus), () => {
        playerActions.adjustCurrentEnd(0.2);
    });
    useHotkeys(process(shortcuts.clearAdjust), () => {
        void playerActions.clearAdjust();
    });
    useHotkeys(process(shortcuts.toggleWordLevelDisplay), changeShowWordLevel);
    useHotkeys(process(shortcuts.nextPlaybackRate), playerActions.cyclePlaybackRate.bind(playerActions));
    useHotkeys(process(shortcuts.aiChat), () => {
        playerActions.pause();
        createFromCurrent();
    }, [createFromCurrent]);

    useHotkeys(process(shortcuts.addClip), async () => {
        useFavouriteClip.getState().changeCurrentLineClip();
    });
    return <></>;
}

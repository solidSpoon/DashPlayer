import { useShallow } from 'zustand/react/shallow';
import { useHotkeys } from 'react-hotkeys-hook';
import toast from 'react-hot-toast';

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
 *
 * 学习页打开期间全部播放类快捷键停用（enabled: false），避免学习时误触改变播放状态；
 * 只有开关学习页的快捷键保持可用，否则用户无法用键盘退出学习页。
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
    // 模式开关的写入统一走 PlayerActions，此处只订阅展示用的值
    const singleRepeat = usePlayer((s) => s.singleRepeat);
    const autoPause = usePlayer((s) => s.autoPause);
    const learningVisible = useChatPanel((s) => s.learningVisible);
    // 学习页打开期间停用播放类快捷键；开关学习页的快捷键除外
    const playbackKeysEnabled = !learningVisible;

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
    }, { enabled: playbackKeysEnabled }, [onUserFinishScrolling, scrollState]);
    useHotkeys('right', () => {
        playerActions.nextSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, { enabled: playbackKeysEnabled }, [onUserFinishScrolling, scrollState]);
    useHotkeys('down', (e) => {
        e.preventDefault();
        playerActions.repeatCurrent({ loop: false });
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, { enabled: playbackKeysEnabled }, [onUserFinishScrolling, scrollState]);
    useHotkeys('space', (e) => {
        e.preventDefault();
        playerActions.togglePlay();
    }, { enabled: playbackKeysEnabled });
    useHotkeys('up', (e) => {
        e.preventDefault();
        playerActions.togglePlay();
    }, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.previousSentence), () => {
        playerActions.prevSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, { enabled: playbackKeysEnabled }, [onUserFinishScrolling, scrollState]);
    useHotkeys(process(shortcuts.nextSentence), () => {
        playerActions.nextSentence();
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, { enabled: playbackKeysEnabled }, [onUserFinishScrolling, scrollState]);
    useHotkeys(process(shortcuts.repeatSentence), () => {
        playerActions.repeatCurrent({ loop: false });
        if (scrollState === 'USER_BROWSING') {
            onUserFinishScrolling();
        }
    }, { enabled: playbackKeysEnabled }, [onUserFinishScrolling, scrollState]);
    useHotkeys(process(shortcuts.playPause), playerActions.togglePlay.bind(playerActions), { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.repeatSingleSentence), toggleSingleRepeat, { enabled: playbackKeysEnabled }, [toggleSingleRepeat]);
    useHotkeys(process(shortcuts.autoPause), toggleAutoPause, { enabled: playbackKeysEnabled }, [toggleAutoPause]);
    useHotkeys(process(shortcuts.toggleEnglishDisplay), changeShowEn, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.toggleChineseDisplay), changeShowCn, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.toggleBilingualDisplay), changeShowEnCn, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.adjustBeginMinus), () => {
        playerActions.adjustCurrentBegin(-0.2);
    }, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.adjustBeginPlus), () => {
        playerActions.adjustCurrentBegin(0.2);
    }, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.adjustEndMinus), () => {
        playerActions.adjustCurrentEnd(-0.2);
    }, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.adjustEndPlus), () => {
        playerActions.adjustCurrentEnd(0.2);
    }, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.clearAdjust), () => {
        void playerActions.clearAdjust();
    }, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.toggleWordLevelDisplay), changeShowWordLevel, { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.nextPlaybackRate), playerActions.cyclePlaybackRate.bind(playerActions), { enabled: playbackKeysEnabled });
    useHotkeys(process(shortcuts.aiChat), () => {
        // 同一个快捷键开关学习页：进入时学习页会自行暂停播放，返回时不动播放状态
        useChatPanel.getState().toggleLearning().catch((error) => {
            toast.error(error instanceof Error ? error.message : String(error));
        });
    }, []);

    useHotkeys(process(shortcuts.addClip), async () => {
        useFavouriteClip.getState().changeCurrentLineClip();
    }, { enabled: playbackKeysEnabled });
    return <></>;
}

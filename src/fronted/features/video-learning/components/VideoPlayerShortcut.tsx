import React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useShallow } from 'zustand/react/shallow';
import useSetting from '@/fronted/features/settings/settingsStore';

type Props = {
    onPlayPause: () => void;
    onPrevSentence: () => void;
    onNextSentence: () => void;
    onRepeatSentence: () => void;
    onChangeSingleRepeat: () => void;
    onChangeAutoPause: () => void;
};

/**
 * 规范化快捷键配置，移除空白和由播放器占用的基础方向键。
 */
const processShortcutKeys = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
    .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space');

/**
 * 视频学习页快捷键注册器：监听设置变化后即时更新绑定。
 */
const VideoPlayerShortcut: React.FC<Props> = ({
    onPlayPause,
    onPrevSentence,
    onNextSentence,
    onRepeatSentence,
    onChangeSingleRepeat,
    onChangeAutoPause,
}) => {
    const shortcuts = useSetting(useShallow((s) => ({
        previousSentence: s.values.get('shortcut.previousSentence') ?? '',
        nextSentence: s.values.get('shortcut.nextSentence') ?? '',
        repeatSentence: s.values.get('shortcut.repeatSentence') ?? '',
        playPause: s.values.get('shortcut.playPause') ?? '',
        repeatSingleSentence: s.values.get('shortcut.repeatSingleSentence') ?? '',
        autoPause: s.values.get('shortcut.autoPause') ?? '',
    })));

    // 基础方向键导航（与主播放器保持一致）
    useHotkeys('left', (e) => {
        e.preventDefault();
        onPrevSentence();
    }, [onPrevSentence]);

    useHotkeys('right', (e) => {
        e.preventDefault();
        onNextSentence();
    }, [onNextSentence]);

    useHotkeys('down', (e) => {
        e.preventDefault();
        onRepeatSentence();
    }, [onRepeatSentence]);

    // 空格和上方向键播放/暂停（与主播放器保持一致）
    useHotkeys('space', (e) => {
        e.preventDefault();
        onPlayPause();
    }, [onPlayPause]);

    useHotkeys('up', (e) => {
        e.preventDefault();
        onPlayPause();
    }, [onPlayPause]);

    // 自定义快捷键配置（从设置中读取）
    useHotkeys(processShortcutKeys(shortcuts.previousSentence), (e) => {
        e.preventDefault();
        onPrevSentence();
    }, [onPrevSentence]);

    useHotkeys(processShortcutKeys(shortcuts.nextSentence), (e) => {
        e.preventDefault();
        onNextSentence();
    }, [onNextSentence]);

    useHotkeys(processShortcutKeys(shortcuts.repeatSentence), (e) => {
        e.preventDefault();
        onRepeatSentence();
    }, [onRepeatSentence]);

    useHotkeys(processShortcutKeys(shortcuts.playPause), (e) => {
        e.preventDefault();
        onPlayPause();
    }, [onPlayPause]);

    useHotkeys(processShortcutKeys(shortcuts.repeatSingleSentence), (e) => {
        e.preventDefault();
        onChangeSingleRepeat();
    }, [onChangeSingleRepeat]);

    useHotkeys(processShortcutKeys(shortcuts.autoPause), (e) => {
        e.preventDefault();
        onChangeAutoPause();
    }, [onChangeAutoPause]);

    // 返回空fragment，不渲染任何UI
    return <></>;
};

export default VideoPlayerShortcut;

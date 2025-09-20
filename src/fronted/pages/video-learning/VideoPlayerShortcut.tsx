import React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import useSetting from '@/fronted/hooks/useSetting';

type Props = {
    onPlayPause: () => void;
    onPrevSentence: () => void;
    onNextSentence: () => void;
    onRepeatSentence: () => void;
    onSeekToCurrentStart: () => void;
    onChangeSingleRepeat: () => void;
    onChangeAutoPause: () => void;
};

const VideoPlayerShortcut: React.FC<Props> = ({
    onPlayPause,
    onPrevSentence,
    onNextSentence,
    onRepeatSentence,
    onSeekToCurrentStart,
    onChangeSingleRepeat,
    onChangeAutoPause,
}) => {
    const setting = useSetting((s) => s.setting);

    // 处理快捷键配置，去除空格和无效按键
    const process = (values: string) => values
        .split(',')
        .map((k) => k.replaceAll(' ', ''))
        .filter((k) => k !== '')
        // remove left right up down space
        .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space');

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
    useHotkeys(process(setting('shortcut.previousSentence')), (e) => {
        e.preventDefault();
        onPrevSentence();
    }, [onPrevSentence]);

    useHotkeys(process(setting('shortcut.nextSentence')), (e) => {
        e.preventDefault();
        onNextSentence();
    }, [onNextSentence]);

    useHotkeys(process(setting('shortcut.repeatSentence')), (e) => {
        e.preventDefault();
        onRepeatSentence();
    }, [onRepeatSentence]);

    useHotkeys(process(setting('shortcut.playPause')), (e) => {
        e.preventDefault();
        onPlayPause();
    }, [onPlayPause]);

    useHotkeys(process(setting('shortcut.repeatSingleSentence')), (e) => {
        e.preventDefault();
        onChangeSingleRepeat();
    }, [onChangeSingleRepeat]);

    useHotkeys(process(setting('shortcut.autoPause')), (e) => {
        e.preventDefault();
        onChangeAutoPause();
    }, [onChangeAutoPause]);

    // 返回空fragment，不渲染任何UI
    return <></>;
};

export default VideoPlayerShortcut;

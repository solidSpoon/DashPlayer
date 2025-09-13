import React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import  useSetting from '@/fronted/hooks/useSetting';

type Props = {
    onPlayPause: () => void;
    onPrevSentence: () => void;
    onNextSentence: () => void;
    onRepeatSentence: () => void;
    onSeekToCurrentStart: () => void;
};

const VideoPlayerShortcut: React.FC<Props> = ({
    onPlayPause,
    onPrevSentence,
    onNextSentence,
    onRepeatSentence,
    onSeekToCurrentStart,
}) => {
    const setting = useSetting((s) => s.setting);

    // 处理快捷键配置，去除空格和无效按键
    const process = (values: string) => values
        .split(',')
        .map((k) => k.replaceAll(' ', ''))
        .filter((k) => k !== '')
        .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space');

    // 播放/暂停
    useHotkeys(process(setting('shortcut.playPause')), (e) => {
        e.preventDefault();
        onPlayPause();
    }, [onPlayPause]);

    // 上一句
    useHotkeys('left', (e) => {
        e.preventDefault();
        onPrevSentence();
    }, [onPrevSentence]);

    // 下一句
    useHotkeys('right', (e) => {
        e.preventDefault();
        onNextSentence();
    }, [onNextSentence]);

    // 空格键播放/暂停（特殊处理）
    useHotkeys('space', (e) => {
        e.preventDefault();
        onPlayPause();
    }, [onPlayPause]);

    // 上方向键暂停（特殊处理）
    useHotkeys('up', (e) => {
        e.preventDefault();
        onPlayPause();
    }, [onPlayPause]);

    // 下方向键跳到当前句开头（特殊处理）
    useHotkeys('down', (e) => {
        e.preventDefault();
        onSeekToCurrentStart();
    }, [onSeekToCurrentStart]);

    // 返回空fragment，不渲染任何UI
    return <></>;
};

export default VideoPlayerShortcut;

import React from 'react';
import { RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { t } from './lib';

interface PlaybackControlsProps {
    /** 是否有字幕可供跳句/重播。 */
    hasSubtitles: boolean;
    /** 上一句。 */
    onPrevious: () => void;
    /** 重播当前句。 */
    onCurrent: () => void;
    /** 下一句。 */
    onNext: () => void;
}

/**
 * 底部悬浮控制坞（Dock）：上一句、重播当前句、下一句。
 *
 * 采用类似 macOS Dock 的居中悬浮风格与 iOS 同心圆角设计，
 * 配合毛玻璃背景与细腻的触控按压反馈。
 */
const PlaybackControls = ({
    hasSubtitles,
    onPrevious,
    onCurrent,
    onNext,
}: PlaybackControlsProps) => {
    return (
        <div className="controls">
            <button
                type="button"
                className="ctrl"
                disabled={!hasSubtitles}
                aria-label={t('上一句', 'Previous line')}
                onClick={onPrevious}
            >
                <SkipBack size={30} strokeWidth={2} fill="currentColor" aria-hidden />
            </button>
            <button
                type="button"
                className="ctrl ctrl-accent"
                disabled={!hasSubtitles}
                aria-label={t('重播当前句', 'Replay current line')}
                onClick={onCurrent}
            >
                <RotateCcw size={30} strokeWidth={2.4} aria-hidden />
            </button>
            <button
                type="button"
                className="ctrl"
                disabled={!hasSubtitles}
                aria-label={t('下一句', 'Next line')}
                onClick={onNext}
            >
                <SkipForward size={30} strokeWidth={2} fill="currentColor" aria-hidden />
            </button>
        </div>
    );
};

export default PlaybackControls;

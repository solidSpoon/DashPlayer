import React from 'react';
import { t } from './lib';

interface PlaybackControlsProps {
    /** 是否有字幕可供跳句/重播。 */
    hasSubtitles: boolean;
    /** 中间按钮显示的文字。 */
    text: string;
    /** 上一句。 */
    onPrevious: () => void;
    /** 重播当前句。 */
    onCurrent: () => void;
    /** 下一句。 */
    onNext: () => void;
}

/**
 * 底部三个大按钮：上一句、当前句、下一句。
 *
 * 左右只放箭头，中间显示当前字幕；三个按钮都是 80px 高，位置固定，便于盲操。
 */
const PlaybackControls = ({
    hasSubtitles,
    text,
    onPrevious,
    onCurrent,
    onNext,
}: PlaybackControlsProps) => {
    return (
        <div className="controls">
            <button
                type="button"
                className="ctrl ctrl-step"
                disabled={!hasSubtitles}
                aria-label={t('上一句', 'Previous line')}
                onClick={onPrevious}
            >
                ‹
            </button>
            <button
                type="button"
                className="ctrl ctrl-main"
                disabled={!hasSubtitles}
                aria-label={t('重播当前句', 'Replay current line')}
                onClick={onCurrent}
            >
                <span className="ctrl-main-text">{text}</span>
            </button>
            <button
                type="button"
                className="ctrl ctrl-step"
                disabled={!hasSubtitles}
                aria-label={t('下一句', 'Next line')}
                onClick={onNext}
            >
                ›
            </button>
        </div>
    );
};

export default PlaybackControls;

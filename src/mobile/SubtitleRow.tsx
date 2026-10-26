import React from 'react';
import type { MobileSubtitleLine } from '@/common/contracts/mobile-web';

interface SubtitleRowProps {
    /** 字幕行。 */
    line: MobileSubtitleLine;
    /** 字幕下标。 */
    index: number;
    /** 是否为当前播放句。 */
    active: boolean;
    /** 点击整行跳转播放。 */
    onSeek: (index: number, play?: boolean) => void;
}

/**
 * 列表里的纯英文字幕行。
 *
 * 整行是一个按钮，点击就从这一句开始播放；不显示时间列和译文，也不做单词查词。
 * 用 memo 隔离，切句时只重渲染前后两行。
 */
const SubtitleRow = React.memo(({ line, index, active, onSeek }: SubtitleRowProps) => {
    return (
        <button
            type="button"
            className={`line${active ? ' current' : ''}`}
            data-index={index}
            onClick={() => onSeek(index, true)}
        >
            <span className="line-main">
                <span className="en">{line.en}</span>
            </span>
        </button>
    );
});

SubtitleRow.displayName = 'SubtitleRow';

export default SubtitleRow;

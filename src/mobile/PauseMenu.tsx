import React from 'react';
import { ChevronLeft, Settings } from 'lucide-react';
import { t } from './lib';

interface PauseMenuProps {
    /** 是否显示；视频暂停且没有播放错误时才展开。 */
    open: boolean;
    /** 打开播放设置面板（和长按字幕打开的是同一个）。 */
    onSettings: () => void;
    /** 回到最近播放列表。 */
    onHome: () => void;
}

/**
 * 暂停时压在视频上沿的两个圆形按钮：左边回最近播放、右边打开设置。
 *
 * 覆盖在视频上（不占布局），播放中整块不渲染。圆形底衬用半透明黑而不是
 * 毛玻璃——手机上任何 backdrop-filter 都会让 WebKit 把周围内容按更粗的层光栅化，
 * 视频周围会跟着发糊。
 */
const PauseMenu = ({ open, onSettings, onHome }: PauseMenuProps) => {
    if (!open) {
        return null;
    }

    return (
        <div className="pause-bar">
            <button
                type="button"
                className="pause-btn"
                aria-label={t('返回最近播放', 'Back to recent plays')}
                onClick={onHome}
            >
                <ChevronLeft size={24} strokeWidth={2.2} aria-hidden />
            </button>
            <button
                type="button"
                className="pause-btn"
                aria-label={t('播放设置', 'Playback settings')}
                onClick={onSettings}
            >
                <Settings size={22} strokeWidth={1.9} aria-hidden />
            </button>
        </div>
    );
};

export default PauseMenu;

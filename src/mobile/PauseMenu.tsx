import React from 'react';
import { House, Settings } from 'lucide-react';
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
 * 暂停时贴在底部三键上方的横条菜单。
 *
 * 绝对定位，不占布局；只有暂停时出现，播放中整块收起。样式贴着控制区
 * 走，像导航栏的一行按键，不做悬浮卡片。目前只有设置和返回最近播放两项。
 */
const PauseMenu = ({ open, onSettings, onHome }: PauseMenuProps) => {
    if (!open) {
        return null;
    }

    return (
        <div className="pause-menu">
            <button type="button" className="pause-menu-item" onClick={onHome}>
                <House size={20} strokeWidth={1.8} aria-hidden />
                <span>{t('返回最近播放', 'Back to recent plays')}</span>
            </button>
            <button type="button" className="pause-menu-item" onClick={onSettings}>
                <Settings size={20} strokeWidth={1.8} aria-hidden />
                <span>{t('设置', 'Settings')}</span>
            </button>
        </div>
    );
};

export default PauseMenu;

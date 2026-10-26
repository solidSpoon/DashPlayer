import React from 'react';
import type { AppTheme } from './theme';
import { SPEED_OPTIONS, t } from './lib';

interface SettingsSheetProps {
    /** 是否打开。 */
    open: boolean;
    /** 关闭面板。 */
    onClose: () => void;
    /** 是否显示英文字幕。 */
    showEnglish: boolean;
    /** 是否在英文下面显示翻译。 */
    showTranslation: boolean;
    /** 切换英文字幕。 */
    onToggleEnglish: () => void;
    /** 切换翻译显示。 */
    onToggleTranslation: () => void;
    /** 是否循环当前句。 */
    repeatOn: boolean;
    /** 切换循环当前句。 */
    onToggleRepeat: () => void;
    /** 是否每句自动暂停。 */
    autoPauseOn: boolean;
    /** 切换每句自动暂停。 */
    onToggleAutoPause: () => void;
    /** 当前倍速。 */
    speed: number;
    /** 切换倍速。 */
    onChangeSpeed: (rate: number) => void;
    /** 当前主题。 */
    theme: AppTheme;
    /** 切换主题。 */
    onChangeTheme: (theme: AppTheme) => void;
}

/**
 * 播放设置面板。
 *
 * 默认隐藏，从字幕区右上角的“设置”打开；不做入场动画。
 */
const SettingsSheet = ({
    open,
    onClose,
    showEnglish,
    showTranslation,
    onToggleEnglish,
    onToggleTranslation,
    repeatOn,
    onToggleRepeat,
    autoPauseOn,
    onToggleAutoPause,
    speed,
    onChangeSpeed,
    theme,
    onChangeTheme,
}: SettingsSheetProps) => {
    return (
        <div className="sheet-layer" hidden={!open}>
            <button type="button" className="sheet-backdrop" aria-label={t('关闭', 'Close')} onClick={onClose} />
            <div className="sheet">
                <div className="sheet-head">
                    <div className="sheet-title">{t('播放设置', 'Playback settings')}</div>
                    <button type="button" className="sheet-done" onClick={onClose}>
                        {t('完成', 'Done')}
                    </button>
                </div>

                <div className="sheet-row">
                    <div className="sheet-label">{t('主题', 'Theme')}</div>
                    <div className="pill-group">
                        <button
                            type="button"
                            className="pill"
                            aria-pressed={theme === 'light'}
                            onClick={() => onChangeTheme('light')}
                        >
                            {t('浅色', 'Light')}
                        </button>
                        <button
                            type="button"
                            className="pill"
                            aria-pressed={theme === 'dark'}
                            onClick={() => onChangeTheme('dark')}
                        >
                            {t('深色', 'Dark')}
                        </button>
                    </div>
                </div>

                <div className="sheet-row">
                    <div className="sheet-label">{t('字幕', 'Subtitles')}</div>
                    <div className="pill-group">
                        <button
                            type="button"
                            className="pill"
                            aria-pressed={showEnglish}
                            onClick={onToggleEnglish}
                        >
                            {t('英文', 'English')}
                        </button>
                    </div>
                </div>

                <div className="sheet-row">
                    <div className="sheet-label">{t('翻译', 'Translation')}</div>
                    <button
                        type="button"
                        className="pill"
                        aria-pressed={showTranslation}
                        onClick={onToggleTranslation}
                    >
                        {showTranslation ? t('开', 'On') : t('关', 'Off')}
                    </button>
                </div>

                <div className="sheet-row">
                    <div className="sheet-label">{t('循环当前句', 'Repeat current line')}</div>
                    <button
                        type="button"
                        className="pill"
                        aria-pressed={repeatOn}
                        onClick={onToggleRepeat}
                    >
                        {repeatOn ? t('开', 'On') : t('关', 'Off')}
                    </button>
                </div>

                <div className="sheet-row">
                    <div className="sheet-label">{t('每句自动暂停', 'Auto pause each line')}</div>
                    <button
                        type="button"
                        className="pill"
                        aria-pressed={autoPauseOn}
                        onClick={onToggleAutoPause}
                    >
                        {autoPauseOn ? t('开', 'On') : t('关', 'Off')}
                    </button>
                </div>

                <div className="sheet-row">
                    <div className="sheet-label">{t('倍速', 'Speed')}</div>
                    <div className="pill-group">
                        {SPEED_OPTIONS.map((rate) => (
                            <button
                                key={rate}
                                type="button"
                                className="pill pill-speed"
                                aria-pressed={speed === rate}
                                onClick={() => onChangeSpeed(rate)}
                            >
                                {rate}×
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsSheet;

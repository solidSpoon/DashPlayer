import React from 'react';
import type { DictionaryState } from './useWatchPlayer';
import { t } from './lib';

interface DictionaryBarProps {
    /** 当前查词状态；null 时整条隐藏。 */
    dict: DictionaryState | null;
}

/**
 * 查词详情面板（悬浮在视频区内的大气轻量卡片）。
 *
 * 高度严格控制在视频区内，不遮挡主字幕与字幕列表；
 * 极简排版无冗余线条与关闭按钮，点别处或滑动列表即刻收起；
 * 加载骨架屏对齐排版高度，杜绝释义返回时的页面抖动。
 */
const DictionaryBar = React.forwardRef<HTMLDivElement, DictionaryBarProps>(({ dict }, ref) => {
    if (!dict) {
        return null;
    }

    const phonetic = dict.data?.phonetic
        ? `/${dict.data.phonetic.trim().replace(/^\/+|\/+$/g, '')}/`
        : '';

    const definitions = dict.data?.definitions ?? [];

    return (
        <div
            className="dict-card"
            ref={ref}
            role="dialog"
            aria-modal="false"
            aria-label={dict.word}
        >
            <div className="dict-header">
                <div className="dict-title-wrap">
                    <span className="dict-word">{dict.word}</span>
                    {phonetic !== '' && (
                        <span className="dict-phonetic">{phonetic}</span>
                    )}
                </div>
            </div>

            <div className="dict-content">
                {dict.loading && (
                    <div className="dict-skeleton" aria-hidden>
                        <div className="dict-skeleton-row">
                            <span className="dict-skeleton-tag" />
                            <span className="dict-skeleton-text w-long" />
                        </div>
                        <div className="dict-skeleton-row">
                            <span className="dict-skeleton-tag" />
                            <span className="dict-skeleton-text w-short" />
                        </div>
                    </div>
                )}

                {!dict.loading && dict.error !== null && (
                    <div className="dict-state error">
                        <span className="dict-state-text">{t(`查询失败：${dict.error}`, `Lookup failed: ${dict.error}`)}</span>
                    </div>
                )}

                {!dict.loading && dict.error === null && definitions.length === 0 && (
                    <div className="dict-state empty">
                        <span className="dict-state-text">{t('未查到该词的本地释义', 'No definition found')}</span>
                    </div>
                )}

                {!dict.loading && dict.error === null && definitions.length > 0 && (
                    <div className="dict-def-list">
                        {definitions.map((def, idx) => {
                            const pos = def.partOfSpeech.trim().replace(/\.+$/, '');
                            const meaning = def.meaning.trim();
                            if (!meaning) {
                                return null;
                            }
                            return (
                                <div className="dict-def-item" key={idx}>
                                    {pos && <span className="dict-pos-tag">{pos}</span>}
                                    <span className="dict-meaning">{meaning}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
});

DictionaryBar.displayName = 'DictionaryBar';

export default DictionaryBar;

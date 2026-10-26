import React from 'react';
import type { DictionaryState } from './useWatchPlayer';
import { t } from './lib';

interface DictionaryBarProps {
    /** 当前查词状态；null 时整条隐藏。 */
    dict: DictionaryState | null;
}

/**
 * 顶部查词条。
 *
 * 直接出现/消失，不做动画；不提供关闭按钮，点别处或重播当前句都会收起。
 */
const DictionaryBar = React.forwardRef<HTMLDivElement, DictionaryBarProps>(({ dict }, ref) => {
    const phonetic = dict?.data?.phonetic
        ? `/${dict.data.phonetic.trim().replace(/^\/+|\/+$/g, '')}/`
        : '';
    let definitions = '';
    let muted = true;
    if (dict) {
        if (dict.loading) {
            definitions = t('查询中…', 'Looking up…');
        } else if (dict.error !== null) {
            definitions = t(`查询失败：${dict.error}`, `Lookup failed: ${dict.error}`);
        } else if (!dict.data || dict.data.definitions.length === 0) {
            definitions = t('没有查到释义', 'No definition found');
        } else {
            const parts = dict.data.definitions
                .slice(0, 2)
                .map((definition) => {
                    const pos = definition.partOfSpeech.trim().replace(/\.+$/, '');
                    const meaning = definition.meaning.trim();
                    if (meaning === '') {
                        return '';
                    }
                    return pos === '' ? meaning : `${pos}. ${meaning}`;
                })
                .filter((part) => part !== '');
            definitions = parts.length > 0 ? parts.join(t('；', '; ')) : t('没有查到释义', 'No definition found');
            muted = parts.length === 0;
        }
    }

    return (
        <div className="dict-bar" id="dict-bar" ref={ref} hidden={!dict}>
            <div className="dict-body">
                <div className="dict-head">
                    <span className="dict-word" id="dict-word">{dict?.word ?? ''}</span>
                    <span className="dict-phonetic" id="dict-phonetic" hidden={phonetic === ''}>
                        {phonetic}
                    </span>
                </div>
                <div className={`dict-defs${muted ? ' muted' : ''}`} id="dict-defs">
                    {definitions}
                </div>
            </div>
        </div>
    );
});

DictionaryBar.displayName = 'DictionaryBar';

export default DictionaryBar;

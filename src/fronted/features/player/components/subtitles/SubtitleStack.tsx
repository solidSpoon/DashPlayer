import React, { ReactElement, useMemo } from 'react';

import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayerState } from '@/fronted/features/player/playerState';
import FullscreenTranslatableLine from './FullscreenTranslatableLine';
import SubtitleLine from './SubtitleLine';
import StrUtil from '@/common/utils/str-util';
import useTranslation from '@/fronted/features/player/translationStore';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';

const SubtitleStack = () => {
    const sentence = usePlayerState((state) => state.currentSentence);
    const srtTender = usePlayerState((state) => state.srtTender);
    const adjusted = useMemo(() => (sentence && srtTender ? (srtTender.adjusted(sentence) ?? false) : false), [sentence, srtTender]);

    const translationKey = sentence?.translationKey || '';
    const newTranslation = useTranslation((state) => state.translations.get(translationKey)) || '';

    const showCn = usePlayerUi((state) => state.showCn);
    const showSourceZh = usePlayerUi((state) => state.showSourceZh);

    const renderLines = (): ReactElement[] => {
        if (!sentence) {
            return [];
        }

        const lines: ReactElement[] = [];

        // 1. 原文字幕 (英文)
        lines.push(
            <FullscreenTranslatableLine
                adjusted={adjusted}
                clearAdjust={() => {
                    void playerActions.clearAdjust();
                }}
                key={`first-${sentence.key}`}
                sentence={sentence}
            />
        );

        // 2. 机翻字幕
        if (showCn && StrUtil.isNotBlank(newTranslation)) {
            lines.push(
                <SubtitleLine
                    key={`translation-${sentence.key}`}
                    text={newTranslation}
                    order="second"
                />
            );
        }

        // 3. 字幕源自带中文
        if (showSourceZh && StrUtil.isNotBlank(sentence.textZH)) {
            lines.push(
                <SubtitleLine
                    key={`sourceZh-${sentence.key}`}
                    text={sentence.textZH!}
                    order={lines.length === 1 ? 'second' : 'third'}
                />
            );
        }

        return lines;
    };

    if (!sentence) {
        return <div className="w-full h-full" />;
    }

    return (
        <div
            key={`trans-sub:${sentence.key}`}
            className="flex flex-col w-full text-center text-textColor justify-center items-center gap-2"
        >
            {renderLines()}
        </div>
    );
};

export default SubtitleStack;

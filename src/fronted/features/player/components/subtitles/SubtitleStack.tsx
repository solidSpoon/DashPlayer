import React, { ReactElement, useMemo } from 'react';

import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayerState } from '@/fronted/features/player/playerState';
import FullscreenTranslatableLine from './FullscreenTranslatableLine';
import SubtitleLine from './SubtitleLine';
import StrUtil from '@/common/utils/str-util';
import useTranslation from '@/fronted/features/player/translationStore';

const SubtitleStack = () => {
    const sentence = usePlayerState((state) => state.currentSentence);
    const srtTender = usePlayerState((state) => state.srtTender);
    const adjusted = useMemo(() => (sentence && srtTender ? (srtTender.adjusted(sentence) ?? false) : false), [sentence, srtTender]);

    const translationKey = sentence?.translationKey || '';
    const newTranslation = useTranslation((state) => state.translations.get(translationKey)) || '';

    const renderLines = (): ReactElement[] => {
        if (!sentence) {
            return [];
        }
        const candidates: Array<string> = [
            sentence.text,
            newTranslation,
            sentence.textZH
        ]
            .filter((item) => StrUtil.isNotBlank(item))
            .map((item) => item ?? '');

        return candidates.map((item, index) => {
            if (index === 0) {
                return (
                        <FullscreenTranslatableLine
                            adjusted={adjusted}
                            clearAdjust={() => {
                                void playerActions.clearAdjust();
                            }}
                            key={`first-${sentence.key}`}
                            sentence={sentence}
                        />
                );
            }
            if (index === 1) {
                return (
                    <SubtitleLine
                        key={`second-${sentence.key}`}
                        text={item}
                        order="second"
                    />
                );
            }

            return (
                <SubtitleLine
                    key={`third-${sentence.key}`}
                    text={item}
                    order="third"
                />
            );
        });
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

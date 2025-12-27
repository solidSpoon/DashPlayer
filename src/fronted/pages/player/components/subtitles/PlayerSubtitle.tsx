import React, { ReactElement } from 'react';

import { playerV2Actions } from '@/fronted/components/feature/player/player-v2';
import { usePlayerV2State } from '@/fronted/hooks/usePlayerV2State';
import { useMemo } from 'react';
import FullscreenTranslatableLine from './fullscreen-translatable-line';
import PlayerNormalLine from './PlayerNormalLine';
import StrUtil from '@/common/utils/str-util';
import useTranslation from '@/fronted/hooks/useTranslation';

const PlayerSubtitle = () => {
    const sentence = usePlayerV2State((state) => state.currentSentence);
    const srtTender = usePlayerV2State((state) => state.srtTender);
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
                                void playerV2Actions.clearAdjust();
                            }}
                            key={`first-${sentence.key}`}
                            sentence={sentence}
                        />
                );
            }
            if (index === 1) {
                return (
                    <PlayerNormalLine
                        key={`second-${sentence.key}`}
                        text={item}
                        order="second"
                    />
                );
            }

            return (
                <PlayerNormalLine
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

export default PlayerSubtitle;

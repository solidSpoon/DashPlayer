import usePlayerController from '@/fronted/hooks/usePlayerController';
import React, { ReactElement } from 'react';
import FullscreenTranslatableLine from '@/fronted/pages/player/pa-srt-cops/fullscreen-translatable-line';
import PlayerNormalLine from '@/fronted/pages/player/playerSubtitle/PlayerNormalLine';
import StrUtil from '@/common/utils/str-util';
import useTranslation from '@/fronted/hooks/useTranslation';

const PlayerSubtitle = () => {
    const sentence = usePlayerController((state) => state.currentSentence);
    const clearAdjust = usePlayerController((state) => state.clearAdjust);
    const srtTender = usePlayerController((state) => state.srtTender);

    const translationKey = sentence?.translationKey || '';
    const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';
    const ele = (): ReactElement[] => {
        if (sentence === undefined) {
            return [];
        }
        const tempEle: Array<string> = [
            sentence.text,
            newTranslation,
            sentence.textZH
        ]
            .filter((item) => StrUtil.isNotBlank(item))
            .map((item) => item ?? '');
        return tempEle.map((item, index) => {
            if (index === 0) {
                return (
                    <FullscreenTranslatableLine
                        adjusted={srtTender?.adjusted(sentence) ?? false}
                        clearAdjust={clearAdjust}
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

    const render = () => {
        if (sentence === undefined) {
            return <div className="w-full h-full" />;
        }
        return (
            <div
                key={`trans-sub:${sentence?.key}`}
                className="flex flex-col w-full text-center text-textColor justify-center items-center gap-2"
            >
                {ele()}
            </div>
        );
    };

    return render();
};

export default PlayerSubtitle;

import React, { ReactElement, useEffect , useMemo } from 'react';
import TranslatableLine from '@/fronted/pages/player/components/subtitles/TranslatableLineWrapper';
import NormalLine from './NormalLine';
import useTranslation from '@/fronted/hooks/useTranslation';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerState } from '@/fronted/hooks/usePlayerState';
import { playerActions } from '@/fronted/components/feature/player/player';

export default function MainSubtitle() {
    const logger = getRendererLogger('MainSubtitle');
    const sentence = usePlayerState((s) => s.currentSentence);
    const subtitle = usePlayerState((s) => s.sentences);
    const srtTender = usePlayerState((s) => s.srtTender);
    const adjusted = useMemo(() => (sentence && srtTender ? (srtTender.adjusted(sentence) ?? false) : false), [sentence, srtTender]);

    const loadTranslationGroup = useTranslation(state => state.loadTranslationGroup);

    // 在组件顶层获取当前句子的翻译
    const translationKey = sentence?.translationKey || '';
    const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';
    // 当前句子改变时，触发懒加载翻译
    useEffect(() => {
        logger.debug('sentence changed', { sentence: sentence?.text, index: sentence?.index });
        if (sentence && subtitle.length > 0) {
            // 使用 transGroup 字段判断是否需要加载翻译
            loadTranslationGroup(subtitle, sentence.index);
        }
    }, [logger, sentence, subtitle, loadTranslationGroup]);

    const ele = (): ReactElement[] => {
        if (!sentence) {
            return [];
        }

        const tempEle: Array<string> = [
            sentence.text,
            newTranslation,
            sentence.textZH,
        ]
            .filter((item) => item !== undefined)
            .map((item) => item ?? '');

        return tempEle.map((item, index) => {
            if (index === 0) {
                return (
                    <TranslatableLine
                        adjusted={adjusted}
                        clearAdjust={() => { void playerActions.clearAdjust(); }}
                        key={`first-${sentence.key}`}
                        sentence={sentence}
                    />
                );
            }
            if (index === 1) {
                return (
                    <NormalLine
                        key={`second-${sentence.key}`}
                        text={item}
                        order="second"
                    />
                );
            }

            return (
                <NormalLine
                    key={`third-${sentence.key}`}
                    text={item}
                    order="third"
                />
            );
        });
    };

    const render = () => {
        if (!sentence) {
            return <div className="w-full h-full" />;
        }
        return (
            <div
                key={`trans-sub:${sentence?.key}`}
                className="flex flex-col w-full text-center text-textColor shadow-inner h-0"
            >
                {ele()}
            </div>
        );
    };

    return render();
}

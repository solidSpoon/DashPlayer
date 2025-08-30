import React, { ReactElement, useEffect } from 'react';
import TranslatableLine from './srt-cops/translatable-line';
import NormalLine from './NormalLine';
import usePlayerController from '../hooks/usePlayerController';
import useTranslation from '../hooks/useTranslation';

export default function MainSubtitle() {
    const sentence = usePlayerController((state) => state.currentSentence);
    const subtitle = usePlayerController((state) => state.subtitle);
    const clearAdjust = usePlayerController((state) => state.clearAdjust);
    const srtTender = usePlayerController((state) => state.srtTender);
    
    const { getTranslation, loadTranslationGroup } = useTranslation();

    // 当前句子改变时，触发懒加载翻译
    useEffect(() => {
        if (sentence && subtitle.length > 0) {
            // 使用 transGroup 字段判断是否需要加载翻译
            loadTranslationGroup(subtitle, sentence.index);
        }
    }, [sentence?.transGroup, subtitle, loadTranslationGroup]);

    const ele = (): ReactElement[] => {
        if (sentence === undefined) {
            return [];
        }

        // 获取新的翻译结果
        const newTranslation = subtitle.length > 0 ? getTranslation(subtitle, sentence.index) : '';
        
        // 优先使用新翻译，如果没有则使用原有的msTranslate
        const translation = newTranslation || sentence.msTranslate;

        const tempEle: Array<string> = [
            sentence.text,
            translation,
            sentence.textZH,
        ]
            .filter((item) => item !== undefined)
            .map((item) => item ?? '');
            
        return tempEle.map((item, index) => {
            if (index === 0) {
                return (
                    <TranslatableLine
                        adjusted={srtTender?.adjusted(sentence) ?? false}
                        clearAdjust={clearAdjust}
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
        if (sentence === undefined) {
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

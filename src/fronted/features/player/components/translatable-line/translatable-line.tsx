import React, { useState } from 'react';
import Word from './word';
import useSetting from '@/fronted/features/settings/settingsStore';
import { cn } from '@/fronted/lib/utils';
import { FONT_SIZE } from '@/fronted/styles/style';
import { Sentence } from '@/common/types/SentenceC';
import hash from 'object-hash';
import { useTransLineTheme } from './translatable-theme';

interface TranslatableSubtitleLineCoreParam {
    sentence: Sentence;
    show: boolean;
    hoverDark?: boolean;
    className?: string; // 新增：root class
    wordClassNames?: {
        word?: string;
        hover?: string;
        vocab?: string;
    }; // 新增：Word 的 classNames
}

const TranslatableLine = ({
    sentence,
    show,
    hoverDark,
    className,
    wordClassNames,
}: TranslatableSubtitleLineCoreParam) => {
    const theme = useTransLineTheme();

    const text = sentence.text;
    const fontSize = useSetting((state) =>
        state.values.get('appearance.fontSize'),
    );
    const [popELe, setPopEle] = useState<string | null>(null);
    const textHash = hash(text);

    /**
     * 记录当前应显示释义弹层的词项。
     */
    const handleRequestPop = (k: string) => {
        if (popELe !== k) {
            setPopEle(k);
        }
    };

    /**
     * 禁止双击默认选词，同时保留单击和拖拽选区。
     */
    const handleLineMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.detail > 1) {
            event.preventDefault();
        }
    };

    return text === undefined ? (
        <div />
    ) : (
        // 该容器只用于文本选择/拖拽，不承担交互语义
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
            className={cn(
                theme.core.root,
                'select-text',
                FONT_SIZE['ms1-large'],
                fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
                fontSize === 'fontSizeMedium' && FONT_SIZE['ms1-medium'],
                fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large'],
                className,
            )}
            onMouseDown={handleLineMouseDown}
        >
            {text.split(/(\s+|[.,!?;:"()])/).filter(Boolean).map((part, partIndex) => {
                const partId = `${textHash}:${partIndex}`;
                const isWord = /^[a-zA-Z]+(?:-[a-zA-Z]+)*$/.test(part);

                if (isWord) {
                    return (
                        <Word
                            key={partId}
                            word={part}
                            original={part}
                            pop={popELe === partId}
                            requestPop={() =>
                                handleRequestPop(partId)
                            }
                            show={show}
                            alwaysDark={hoverDark}
                            classNames={wordClassNames}
                        />
                    );
                }
                return (
                    <span
                        className={cn(
                            'whitespace-pre',
                            !show && 'text-transparent',
                        )}
                        key={partId}
                    >
                        {part}
                    </span>
                );
            })}
        </div>
    );
};

export default TranslatableLine;

TranslatableLine.defaultProps = {
    hoverDark: false
};

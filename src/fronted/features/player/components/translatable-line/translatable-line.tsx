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

/**
 * 按后端 wink token 结构渲染字幕，原文间隔由 source text 保持。
 * @param props 字幕句子和显示交互配置。
 */
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
            {(() => {
                let sourceCursor = 0;
                const parts = sentence.struct.blocks.flatMap((block) => block.blockParts);
                const rendered = parts.flatMap((part, partIndex) => {
                    const start = text.indexOf(part.content, sourceCursor);
                    const gap = start >= sourceCursor ? text.slice(sourceCursor, start) : '';
                    sourceCursor = start >= sourceCursor ? start + part.content.length : sourceCursor;
                    const partId = `${textHash}:${partIndex}`;
                    const gapElement = gap ? <span className={cn('whitespace-pre', !show && 'text-transparent')} key={`${partId}:gap`}>{gap}</span> : null;
                if (part.isWord) {
                    return [gapElement, <Word key={partId} word={part.content} original={part.content} lemma={part.lemma}
                        pop={popELe === partId} requestPop={() => handleRequestPop(partId)} show={show}
                        alwaysDark={hoverDark} classNames={wordClassNames} />];
                }
                return [gapElement, <span className={cn('whitespace-pre', !show && 'text-transparent')} key={partId}>{part.content}</span>];
                });
                if (sourceCursor < text.length) {
                    rendered.push(<span className={cn('whitespace-pre', !show && 'text-transparent')} key={`${textHash}:tail`}>{text.slice(sourceCursor)}</span>);
                }
                return rendered;
            })()}
        </div>
    );
};

export default TranslatableLine;

TranslatableLine.defaultProps = {
    hoverDark: false
};

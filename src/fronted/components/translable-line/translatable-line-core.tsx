import React, { useState } from 'react';
import Word from './word';
import useSetting from '../../hooks/useSetting';
import { cn } from '@/fronted/lib/utils';
import { FONT_SIZE } from '../../styles/style';
import { Sentence } from '@/common/types/SentenceC';
import hash from 'object-hash';
import useCopyModeController from '../../hooks/useCopyModeController';
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

const TranslatableLineCore = ({
                                  sentence,
                                  show,
                                  hoverDark,
                                  className,
                                  wordClassNames
                              }: TranslatableSubtitleLineCoreParam) => {
    const theme = useTransLineTheme();
    const text = sentence.text;
    const sentenceStruct = sentence.struct;
    const fontSize = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const [popELe, setPopEle] = useState<string | null>(null);
    const textHash = hash(text);
    const setCopyContent = useCopyModeController((s) => s.setCopyContent);
    const isCopyMode = useCopyModeController((s) => s.isCopyMode);
    const handleRequestPop = (k: string) => {
        if (popELe !== k) {
            setPopEle(k);
        }
    };
    const handleLineClick = async (e: React.MouseEvent) => {
        if (isCopyMode) {
            e.stopPropagation();
            setCopyContent(text);
        }
    };
    return text === undefined ? (
        <div />
    ) : (
        <div
            className={cn(
                theme.core.root,
                FONT_SIZE['ms1-large'],
                fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
                fontSize === 'fontSizeMedium' && FONT_SIZE['ms1-medium'],
                fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large'],
                className
            )}
            onClick={(e) => handleLineClick(e)}
        >
            {sentenceStruct?.blocks.map((block, blockIndex) => {
                const blockId = `${textHash}:${blockIndex}`;
                return (
                    <div key={blockId} className={cn('flex items-end')}>
                        {block.blockParts.map((part, partIndex) => {
                            const partId = `${textHash}:${blockIndex}:${partIndex}`;
                            if (part.isWord) {
                                return (
                                    <Word
                                        key={partId}
                                        word={part.content}
                                        original={part.implicit}
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
                            return <div
                                className={`select-none ${show ? '' : 'text-transparent'}`}
                                key={partId}
                            >
                                {part.content}
                            </div>;
                        })}
                    </div>
                );
            }) || []}
        </div>
    );
};

export default TranslatableLineCore;

TranslatableLineCore.defaultProps = {
    hoverDark: false
};

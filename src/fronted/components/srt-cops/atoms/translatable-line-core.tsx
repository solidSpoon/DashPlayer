import React, { useState } from 'react';
import Word from './word';
import useSetting from '../../../hooks/useSetting';
import { cn } from '@/fronted/lib/utils';
import { FONT_SIZE } from '../../../styles/style';
import { Sentence } from '@/common/types/SentenceC';
import hash from 'object-hash';
import useCopyModeController from '../../../hooks/useCopyModeController';

interface TranslatableSubtitleLineCoreParam {
    sentence: Sentence;
    show: boolean;
    hoverDark?: boolean;
}

const TranslatableLineCore = ({
                                  sentence,
                                  show,
                                  hoverDark
                              }: TranslatableSubtitleLineCoreParam) => {
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
                'flex flex-wrap justify-center items-end  px-10 pt-2.5 pb-2.5 gap-x-2 gap-y-1',
                FONT_SIZE['ms1-large'],
                fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
                fontSize === 'fontSizeMedium' && FONT_SIZE['ms1-medium'],
                fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large']
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

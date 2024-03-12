import React, { ReactElement, useState } from 'react';
import { AiOutlineFieldTime } from 'react-icons/ai';
import useSetting from "@/fronted/hooks/useSetting";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import {p} from "@/common/utils/Util";
import hash from "@/common/utils/hash";
import {FONT_SIZE} from "@/fronted/styles/style";
import IconButton from "@/fronted/components/toolTip/IconButton";
import {cn} from "@/fronted/lib/utils";
import Word from "@/fronted/components/Word";

interface PlayerTranslatableSubtitleLineParam {
    text: string;
    adjusted: boolean;
    clearAdjust: () => void;
}

const notWord = (str: string, key: string): ReactElement => {
    return (
        <div
            className={`select-none`}
            key={key}
        >
            {str}
        </div>
    );
};
const PlayerTranslatableLine = ({
    text,
    adjusted,
    clearAdjust,
}: PlayerTranslatableSubtitleLineParam) => {
    const fontSize = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const show = usePlayerController((state) => state.showEn);
    const sentenceStruct = usePlayerController((state) =>
        state.subTitlesStructure.get(p(text))
    );
    console.log('sentenceStruct', sentenceStruct);
    console.log('TranslatableLine', text, 'dd');
    const [popELe, setPopEle] = useState<string | null>(null);
    const [hovered, setHovered] = useState(false);
    const textHash = hash(text);
    const handleRequestPop = (k: string) => {
        if (popELe !== k) {
            setPopEle(k);
        }
    };

    return (!p(text) || !show) ? (
        <div />
    ) : (
        <div
            onMouseOver={() => {
                setHovered(true);
            }}
            onMouseLeave={() => {
                setHovered(false);
            }}
            className={cn(
                'flex justify-center items-center',
                // 'bg-background/50 text-foreground',
                FONT_SIZE["ms1-large"],
                fontSize === 'fontSizeSmall' && FONT_SIZE["ms1-small"],
                fontSize === 'fontSizeMedium' &&
                FONT_SIZE["ms1-medium"],
                fontSize === 'fontSizeLarge' && FONT_SIZE["ms1-large"]
            )}
        >
            <div
                className={cn(
                    'flex flex-wrap justify-center items-end p-2.5 gap-x-2 gap-y-1 bg-black/50 text-white rounded'
                )}
            >

                    {adjusted && (
                        <div className={cn('w-8 h-8')}>
                        <IconButton
                            onClick={clearAdjust}
                            tooltip="点击重置当前句子时间戳"
                        >
                            <AiOutlineFieldTime
                                className={cn('w-8 h-8 text-white')}
                            />
                        </IconButton>
                        </div>
                    )}
                {sentenceStruct?.blocks.map((block, blockIndex) => {
                    return (
                        <div className={cn('flex items-end')}>
                            {block.blockParts.map((part, partIndex) => {
                                const partId = `${textHash}:${blockIndex}:${partIndex}`;
                                if (part.isWord) {
                                    return (
                                        <Word
                                            alwaysDark
                                            key={partId}
                                            word={part.content}
                                            pop={popELe === partId}
                                            requestPop={() =>
                                                handleRequestPop(partId)
                                            }
                                            show
                                        />
                                    );
                                }
                                return notWord(
                                    part.content,
                                    partId
                                );
                            })}
                        </div>
                    );
                }) || []}

                {adjusted && (
                    <div className={cn('w-10 h-full flex-shrink-0')}/>
                )}
            </div>

        </div>
    );
};

export default PlayerTranslatableLine;

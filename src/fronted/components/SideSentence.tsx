import React, { forwardRef } from 'react';
import useSetting from '../hooks/useSetting';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from '@/fronted/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { motion } from 'framer-motion';
import useFavouriteClip, { mapClipKey } from '@/fronted/hooks/useFavouriteClip';
import useFile from '@/fronted/hooks/useFile';
import { Sentence } from '@/common/types/SentenceC';
import useTranslation from '@/fronted/hooks/useTranslation';
import useVocabulary from '../hooks/useVocabulary';

interface SideSentenceNewParam {
    sentence: Sentence;
    onClick: (sentence: Sentence) => void;
    isCurrent: boolean;
    isRepeat: boolean;
}

interface Part {
    content: string;
    isWord: boolean;
    id: string;
    isVocab?: boolean | "";
}

export const SPLIT_REGEX =
    /((?<=.)(?=[^A-Za-z0-9\u4e00-\u9fa5-]))|((?<=[^A-Za-z0-9\u4e00-\u9fa5-])(?=.))/;

const IconTip = ({ tip, children }: { tip: string; children: React.ReactNode }) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    {children}
                </TooltipTrigger>
                <TooltipContent align={'start'}>
                    {tip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

};

const PlayingIcon = () => {
    return (
        <IconTip tip={'Playing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="lucide lucide-circle-play">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
        </IconTip>
    );
};

const RepeatPlayingIcon = () => {
    return (
        <IconTip tip={'Repeat Playing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="lucide lucide-circle-percent">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6" />
                <path d="M9 9h.01" />
                <path d="M15 15h.01" />
            </svg>
        </IconTip>
    );
};

const NormalPausingIcon = () => {
    return (
        <IconTip tip={'Pausing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-pause">
                <circle cx="12" cy="12" r="10" />
                <line x1="10" x2="10" y1="15" y2="9" />
                <line x1="14" x2="14" y1="15" y2="9" />
            </svg>
        </IconTip>
    );
};

const AutoPausingIcon = () => {
    return (
        <IconTip tip={'Auto Pausing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                 strokeLinejoin="round"
                 className="lucide lucide-octagon-pause">
                <path d="M10 15V9" />
                <path d="M14 15V9" />
                <path d="M7.714 2h8.572L22 7.714v8.572L16.286 22H7.714L2 16.286V7.714z" />
            </svg>
        </IconTip>
    );
};

const SideSentence = forwardRef<HTMLDivElement, SideSentenceNewParam>(
    ({ sentence, onClick, isCurrent, isRepeat }: SideSentenceNewParam, ref) => {
        const playing = usePlayerController((state) => state.playing);
        const translationKey = sentence?.translationKey || '';
        const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';
        const s = [sentence.text, sentence.textZH, newTranslation].find(
            (i) => i !== undefined && i !== ''
        );
        const fontSize = useSetting((state) =>
            state.values.get('appearance.fontSize')
        );
        const ap = usePlayerController.getState().internal.onPlaySeekTime !== null;
        const isFavourite = useFavouriteClip((s) => s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false);
        const [hover, setHover] = React.useState(false);
        const show = usePlayerController(state => {
            if (!state.syncSide) {
                return true;
            } else {
                return state.showEn
            }
        });
        const vocabularyStore = useVocabulary();
        const isVocabularyWord = vocabularyStore.isVocabularyWord;
        
        const icon = () => {
            if (playing) {
                return isRepeat ? <RepeatPlayingIcon /> : <PlayingIcon />;
            } else {
                return ap ? <AutoPausingIcon /> : <NormalPausingIcon />;
            }
        };

        // 分割文本为单词和非单词部分
        const splitText = (text: string): Part[] => {
            const isWord = (str: string): boolean => {
                const noWordRegex = /[^A-Za-z0-9-\u4e00-\u9fa5]/;
                return !noWordRegex.test(str);
            };
            
            const textHash = Math.random().toString(36).substr(2, 9);
            return text
                .replace(/\s+/g, ' ')
                .split(SPLIT_REGEX)
                .filter((w) => w)
                .map((w, index) => {
                    const cleanWord = w.toLowerCase().replace(/[^\w]/g, '');
                    return {
                        content: w,
                        isWord: isWord(w),
                        id: `${textHash}:${index}`,
                        isVocab: cleanWord && isVocabularyWord(cleanWord)
                    };
                });
        };

        // 渲染带高亮的文本
        const renderHighlightedText = (text: string) => {
            const parts = splitText(text);
            return parts.map((part) => {
                if (part.isVocab) {
                    return (
                        <span
                            key={part.id}
                            className={cn(
                                '!text-blue-400 !underline !decoration-blue-400 !decoration-1 !bg-blue-500/10 px-0.5 rounded hover:!bg-blue-500/30'
                            )}
                        >
                            {part.content}
                        </span>
                    );
                }
                return <span key={part.id}>{part.content}</span>;
            });
        };

        return (
            // eslint-disable-next-linejsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
            <div
                className={cn(
                    'm-1.5 mr-0.5 px-1 py-2 border-0 flex gap-1 content-start rounded-lg',
                    'hover:drop-shadow-lg drop-shadow',
                    'bg-stone-200 dark:bg-neutral-700',
                    'hover:bg-stone-100 dark:hover:bg-neutral-600',
                    !show && 'transition-colors duration-500',
                    fontSize === 'fontSizeSmall' ? 'text-base' : 'text-lg',
                    isFavourite && 'text-yellow-500 dark:text-yellow-300'
                )}
                onClick={() => {
                    onClick(sentence);
                }}
                onMouseEnter={() => {
                    setHover(true);
                }}
                onMouseLeave={() => {
                    setHover(false);
                }}
                ref={ref}
            >
                <div
                    className={cn(
                        'flex flex-col items-center justify-center',
                        isCurrent ? 'visible' : 'invisible',
                        fontSize === 'fontSizeSmall' ? 'w-5 h-5' : 'w-7 h-7',
                        fontSize === 'fontSizeSmall' ? 'text-base' : 'text-lg',
                        `text-red-500 dark:text-red-600`
                    )}
                >
                    {icon()}
                </div>

                <motion.div
                    className={cn(
                        'w-full text-center',
                        hover || show ? 'text-opacity-100' : 'text-opacity-0'
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: hover || show ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {renderHighlightedText(s ?? '')}
                </motion.div>
            </div>
        );
    }
);

export default SideSentence;

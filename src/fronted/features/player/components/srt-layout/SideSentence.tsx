import React, { forwardRef } from 'react';
import useSetting from '@/fronted/features/settings/settingsStore';
import { usePlayerUiState } from '@/fronted/features/player/playerUiStore';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { cn } from '@/fronted/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { motion } from 'framer-motion';
import useFavouriteClip, { mapClipKey } from '@/fronted/features/favourite/favouriteStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import { Sentence } from '@/common/types/SentenceC';
import useTranslation from '@/fronted/features/player/translationStore';
import useVocabulary from '@/fronted/features/player/vocabularyStore';
import { shallow } from 'zustand/shallow';
import { Bookmark, Play, Pause, Repeat1 } from 'lucide-react';

interface SideSentenceNewParam {
    sentence: Sentence;
    onClick: (sentence: Sentence) => void;
    isCurrent: boolean;
    isRepeat: boolean;
    selectionState?: {
        isMember: boolean;
        isGroupStart: boolean;
        isGroupEnd: boolean;
    };
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
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                    {tip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// 精致跳动的音频声波小动效
const PlayingAudioWave = () => (
    <IconTip tip="正在播放">
        <div className="flex items-end justify-center gap-[2px] w-4 h-4 text-stone-900 dark:text-white">
            <span className="w-[2.5px] h-3.5 bg-current rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
            <span className="w-[2.5px] h-2 bg-current rounded-full animate-[pulse_0.6s_ease-in-out_0.2s_infinite]" />
            <span className="w-[2.5px] h-4 bg-current rounded-full animate-[pulse_0.9s_ease-in-out_0.4s_infinite]" />
        </div>
    </IconTip>
);

const RepeatAudioWave = () => (
    <IconTip tip="单句循环中">
        <div className="flex items-center justify-center w-4 h-4 text-stone-900 dark:text-white">
            <Repeat1 className="w-3.5 h-3.5" />
        </div>
    </IconTip>
);

const PausedIcon = () => (
    <IconTip tip="已暂停">
        <div className="flex items-center justify-center w-4 h-4 text-stone-400 dark:text-neutral-500">
            <Pause className="w-3 h-3 fill-current" />
        </div>
    </IconTip>
);

const CARD_SPACING_PX = 4;
const CARD_RADIUS_PX = 10;

/**
 * 渲染侧边字幕条目（极简现代列表项）。
 */
const SideSentence = forwardRef<HTMLDivElement, SideSentenceNewParam>(
    ({ sentence, onClick, isCurrent, isRepeat, selectionState }: SideSentenceNewParam, ref) => {
        const playing = usePlayerState((state) => state.playing);
        const translationKey = sentence?.translationKey || '';
        const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';
        
        const primaryText = sentence.text || '';
        const secondaryText = sentence.textZH || newTranslation || '';

        const fontSize = useSetting((state) =>
            state.values.get('appearance.fontSize')
        );
        const isFavourite = useFavouriteClip((s) => s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false);
        const [hover, setHover] = React.useState(false);
        const { showEn, syncSide } = usePlayerUiState(
            (s) => ({ showEn: s.showEn, syncSide: s.syncSide }),
            shallow
        );
        const show = !syncSide ? true : showEn;
        const vocabularyStore = useVocabulary();
        const isVocabularyWord = vocabularyStore.isVocabularyWord;

        const renderStatusIcon = () => {
            if (!isCurrent) return null;
            if (playing) {
                return isRepeat ? <RepeatAudioWave /> : <PlayingAudioWave />;
            }
            return <PausedIcon />;
        };

        // 分割文本为单词和非单词部分
        const splitText = (text: string): Part[] => {
            const isWord = (str: string): boolean => {
                const noWordRegex = /[^A-Za-z0-9-\u4e00-\u9fa5]/;
                return !noWordRegex.test(str);
            };

            const textHash = text;
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

        const renderHighlightedText = (text: string) => {
            const parts = splitText(text);
            return parts.map((part) => {
                if (part.isVocab) {
                    return (
                        <span
                            key={part.id}
                            className="font-medium underline decoration-dotted underline-offset-[0.18em] decoration-current/40"
                        >
                            {part.content}
                        </span>
                    );
                }
                return <span key={part.id}>{part.content}</span>;
            });
        };

        const overlayStyle = React.useMemo(() => {
            if (!selectionState?.isMember) {
                return null;
            }
            const top = selectionState.isGroupStart ? 0 : -CARD_SPACING_PX;
            const bottom = selectionState.isGroupEnd ? 0 : -CARD_SPACING_PX;
            return {
                top: `${top}px`,
                bottom: `${bottom}px`,
                borderTopLeftRadius: selectionState.isGroupStart ? `${CARD_RADIUS_PX}px` : '0px',
                borderTopRightRadius: selectionState.isGroupStart ? `${CARD_RADIUS_PX}px` : '0px',
                borderBottomLeftRadius: selectionState.isGroupEnd ? `${CARD_RADIUS_PX}px` : '0px',
                borderBottomRightRadius: selectionState.isGroupEnd ? `${CARD_RADIUS_PX}px` : '0px',
            } satisfies React.CSSProperties;
        }, [selectionState]);

        const overlayClass = React.useMemo(() => {
            if (!selectionState?.isMember) {
                return 'pointer-events-none absolute left-0 right-0';
            }
            const base = [
                'pointer-events-none absolute left-0 right-0',
                'bg-stone-300/60 dark:bg-neutral-700/60 backdrop-blur-xs',
                'transition-all duration-150 ease-out',
            ];
            if (selectionState.isGroupStart) {
                base.push('border-t border-x border-black/10 dark:border-white/10 shadow-xs');
            } else if (selectionState.isMember) {
                base.push('border-x border-black/10 dark:border-white/10');
            }
            if (selectionState.isGroupEnd) {
                base.push('border-b border-black/10 dark:border-white/10');
            }
            return base.join(' ');
        }, [selectionState]);

        return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
            <div
                className={cn(
                    'group relative mx-2 my-1 px-3 py-2.5 flex items-start gap-2.5 rounded-xl cursor-pointer border transition-all duration-150 select-none overflow-visible',
                    // 默认状态纯净透明，当前句微升且温润衬底，悬浮平滑浅色反馈
                    isCurrent
                        ? 'bg-stone-200/90 dark:bg-neutral-800/90 shadow-xs border-black/5 dark:border-white/10 text-stone-950 dark:text-neutral-50'
                        : 'border-transparent text-stone-600 dark:text-neutral-400 hover:bg-stone-200/50 dark:hover:bg-neutral-800/50 hover:text-stone-900 dark:hover:text-neutral-200',
                    selectionState?.isMember && 'bg-transparent hover:bg-transparent shadow-none border-transparent'
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
                {selectionState?.isMember && overlayStyle && (
                    <div aria-hidden className={overlayClass} style={overlayStyle} />
                )}

                {/* 收藏句右上角精致书签标记 */}
                {isFavourite && (
                    <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                        <Bookmark className="w-3 h-3 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400 opacity-90" />
                    </div>
                )}

                {/* 左侧状态指示器：固定宽度并占位，避免由于显示/隐藏引起后续所有文本横向抖动与不对齐 */}
                <div
                    className={cn(
                        'relative z-10 flex items-center justify-center w-4 h-4 shrink-0 mt-0.5 transition-opacity duration-200',
                        isCurrent ? 'opacity-100' : 'opacity-0'
                    )}
                >
                    {renderStatusIcon()}
                </div>

                {/* 文本内容区：固定对齐、层级清晰 */}
                <motion.div
                    className={cn(
                        'relative z-10 flex-1 min-w-0 flex flex-col text-left transition-opacity duration-300',
                        isFavourite && 'pr-4',
                        hover || show ? 'opacity-100' : 'opacity-0'
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: hover || show ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* 英文主句 */}
                    <div className={cn(
                        'leading-snug transition-colors',
                        fontSize === 'fontSizeSmall' ? 'text-sm' : 'text-base',
                        isCurrent ? 'text-stone-950 dark:text-white font-medium' : 'text-stone-800 dark:text-neutral-300 group-hover:text-stone-950 dark:group-hover:text-white'
                    )}>
                        {renderHighlightedText(primaryText)}
                    </div>

                    {/* 中文译文 */}
                    {secondaryText && (
                        <div className="mt-1 text-xs leading-normal text-stone-500 dark:text-neutral-400 font-normal">
                            {secondaryText}
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }
);

SideSentence.displayName = 'SideSentence';

export default SideSentence;

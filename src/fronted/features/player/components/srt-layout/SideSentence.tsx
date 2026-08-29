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

const CARD_SPACING_PX = 6;
const CARD_RADIUS_PX = 12;

/**
 * 渲染侧边字幕条目（实体卡片流设计：实色卡片、清晰层次与高亮聚焦）。
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
                            className={cn(
                                'underline decoration-dotted underline-offset-[0.2em] transition-colors',
                                isCurrent
                                    ? 'font-medium decoration-stone-900/60 dark:decoration-white/70'
                                    : 'decoration-stone-400/50 dark:decoration-neutral-500/50'
                            )}
                        >
                            {part.content}
                        </span>
                    );
                }
                return <span key={part.id}>{part.content}</span>;
            });
        };

        // 计算选区形态：自然合并卡片（顶部卡片保留上圆角、底部保留下圆角，中间无圆角无缝连接）
        const selectionClass = React.useMemo(() => {
            if (!selectionState?.isMember) {
                return '';
            }
            const classes: string[] = [
                'bg-stone-50 dark:bg-neutral-800',
                'border-stone-400/80 dark:border-neutral-600',
                'shadow-sm text-stone-900 dark:text-neutral-100',
            ];

            if (selectionState.isGroupStart && selectionState.isGroupEnd) {
                // 单个选中（完整卡片）
                classes.push('rounded-xl border');
            } else if (selectionState.isGroupStart) {
                // 选区头部：保留上圆角，下边距贴合，移除下边框和下圆角
                classes.push('rounded-t-xl rounded-b-none border-t border-x border-b-0 mb-0 shadow-none');
            } else if (selectionState.isGroupEnd) {
                // 选区尾部：保留下圆角，上边距贴合，移除上边框和上圆角
                classes.push('rounded-b-xl rounded-t-none border-b border-x border-t-0 mt-0');
            } else {
                // 选区中间成员：完全无缝，直角，移除上下边框与上下外边距
                classes.push('rounded-none border-x border-t-0 border-b-0 my-0 shadow-none');
            }
            return classes.join(' ');
        }, [selectionState]);

        return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
            <div
                className={cn(
                    // 外边距：上下与左侧保持一致(1.5 = 6px)，右侧完全去除外边距(mr-0)
                    'group relative my-1.5 ml-1.5 mr-0 px-3.5 py-3 flex items-start gap-3 cursor-pointer select-none border transition-colors duration-150',
                    !selectionState?.isMember && 'rounded-xl',
                    // 卡片色调：
                    // 默认卡片：微暗石色，极淡边框
                    // 激活卡片：平稳温润白色，边框微亮，不改变任何内边距或文本大小
                    !selectionState?.isMember && (
                        isCurrent
                            ? 'bg-white dark:bg-neutral-800 border-stone-400/60 dark:border-neutral-650 shadow-sm text-stone-900 dark:text-neutral-100'
                            : 'bg-stone-100/90 dark:bg-neutral-900/90 border-stone-300/50 dark:border-neutral-800/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-stone-50 dark:hover:bg-neutral-850 hover:border-stone-400/50 dark:hover:border-neutral-700 text-stone-700 dark:text-neutral-300'
                    ),
                    selectionClass
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
                {/* 选区内分割线（非末尾句提供细腻的内部分割线，呈现合并卡片的自然分行） */}
                {selectionState?.isMember && !selectionState.isGroupEnd && (
                    <div aria-hidden className="absolute bottom-0 left-3 right-3 h-[1px] bg-stone-200/80 dark:bg-neutral-700/80 pointer-events-none" />
                )}

                {/* 收藏句右上角精致书签标记 */}
                {isFavourite && (
                    <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                        <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400 opacity-90 drop-shadow-xs" />
                    </div>
                )}

                {/* 左侧状态指示器：固定尺寸与位置 */}
                <div
                    className={cn(
                        'relative z-10 flex items-center justify-center w-4 h-4 shrink-0 mt-0.5 transition-opacity duration-200',
                        isCurrent ? 'opacity-100' : 'opacity-0'
                    )}
                >
                    {renderStatusIcon()}
                </div>

                {/* 文本内容区：固定对齐、层级主次清晰 */}
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
                    {/* 英文主句：更显眼清晰，适度放大，激活与非激活字体大小严格一致 */}
                    <div className={cn(
                        'leading-snug transition-colors tracking-normal',
                        fontSize === 'fontSizeSmall' ? 'text-sm' : 'text-[15.5px]',
                        isCurrent
                            ? 'text-stone-950 dark:text-white font-medium'
                            : 'text-stone-800 dark:text-neutral-200 group-hover:text-stone-950 dark:group-hover:text-white font-normal'
                    )}>
                        {renderHighlightedText(primaryText)}
                    </div>

                    {/* 中文译文：弱化对比度，不抢占视觉中心 */}
                    {secondaryText && (
                        <div className={cn(
                            'mt-1.5 leading-normal transition-colors font-normal',
                            fontSize === 'fontSizeSmall' ? 'text-xs' : 'text-[12.5px]',
                            isCurrent
                                ? 'text-stone-400 dark:text-neutral-500'
                                : 'text-stone-400/80 dark:text-neutral-500/80 group-hover:text-stone-400 dark:group-hover:text-neutral-500'
                        )}>
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

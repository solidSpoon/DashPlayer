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
import { splitWords, isWordToken, cleanWord } from '@/common/utils/subtitle';
import { Bookmark, Pause, Repeat1 } from 'lucide-react';

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

const IconTip = ({ tip, children }: { tip: string; children: React.ReactNode }) => {
    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4} className="text-xs">
                    {tip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// 精致跳动的音频声波小动效
const PlayingAudioWave = () => (
    <IconTip tip="正在播放">
        <div className="flex items-end justify-center gap-[2px] w-4 h-4 text-rose-600 dark:text-rose-400">
            <span className="w-[2.5px] h-3.5 bg-current rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
            <span className="w-[2.5px] h-2 bg-current rounded-full animate-[pulse_0.6s_ease-in-out_0.2s_infinite]" />
            <span className="w-[2.5px] h-4 bg-current rounded-full animate-[pulse_0.9s_ease-in-out_0.4s_infinite]" />
        </div>
    </IconTip>
);

const RepeatAudioWave = () => (
    <IconTip tip="单句循环中">
        <div className="flex items-center justify-center w-4 h-4 text-rose-600 dark:text-rose-400">
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
            const textHash = text;
            return splitWords(text)
                .map((w, index) => {
                    const cleaned = cleanWord(w);
                    return {
                        content: w,
                        isWord: isWordToken(w),
                        id: `${textHash}:${index}`,
                        isVocab: cleaned && isVocabularyWord(cleaned)
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
                                    ? 'decoration-stone-900/60 dark:decoration-white/70'
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

        // 计算选区形态与合并卡片质感
        // 注意：四周 1px 边框必须永远保留（不可用 border-b-0 / border-t-0），否则 box-sizing 会让高度少 1~2px 造成内部文字跳动！
        const selectionClass = React.useMemo(() => {
            if (!selectionState?.isMember) {
                return '';
            }
            const classes: string[] = [
                'bg-stone-200/90 dark:bg-neutral-800/90',
                'border-stone-400/70 dark:border-neutral-600/80',
                'shadow-xs text-stone-900 dark:text-neutral-100',
            ];

            if (selectionState.isGroupStart && selectionState.isGroupEnd) {
                // 单个选中（完整圆角）
                classes.push('rounded-xl');
            } else if (selectionState.isGroupStart) {
                // 选区头部：保留上圆角，下方直角，下边框颜色融入底色（不改边框宽度）
                classes.push('rounded-t-xl rounded-b-none border-b-transparent');
            } else if (selectionState.isGroupEnd) {
                // 选区尾部：保留下圆角，上方直角，上边框颜色融入底色（不改边框宽度）
                classes.push('rounded-b-xl rounded-t-none border-t-transparent');
            } else {
                // 选区中间成员：上下直角，上下边框颜色融入底色（不改边框宽度）
                classes.push('rounded-none border-y-transparent');
            }
            return classes.join(' ');
        }, [selectionState]);

        return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
            <div
                className={cn(
                    // 外边距与内边距保持绝对恒定，四个方向 1px 边框始终存在，高度与定位 100% 绝对静止
                    'group relative my-1.5 ml-1.5 mr-0 pl-3.5 pr-2.5 py-3 rounded-xl flex items-start gap-2.5 cursor-pointer select-none border transition-colors duration-150',
                    // 卡片色调（激活与常规卡片底色非常接近、仅微调边框和文字，保持整体质感平滑统一）：
                    !selectionState?.isMember && (
                        isCurrent
                            ? 'bg-stone-200/90 dark:bg-neutral-800/85 border-stone-400/60 dark:border-neutral-600/70 shadow-xs text-stone-900 dark:text-neutral-100'
                            : 'bg-stone-200/70 dark:bg-neutral-800/60 border-stone-300/60 dark:border-neutral-700/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-stone-200/90 dark:hover:bg-neutral-800/80 hover:border-stone-400/50 dark:hover:border-neutral-600 text-stone-700 dark:text-neutral-300'
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
                {/* 选区卡片之间的向下无缝连接桥（my-1.5 为 6px，上下两张卡片间距刚好是 12px，高度填满 14px 覆盖上下接缝） */}
                {selectionState?.isMember && !selectionState.isGroupEnd && (
                    <div
                        aria-hidden="true"
                        className="absolute -bottom-[13px] -left-[1px] -right-[1px] h-[14px] bg-stone-200/90 dark:bg-neutral-800/90 border-l border-r border-stone-400/70 dark:border-neutral-600/80 z-0 pointer-events-none"
                    />
                )}

                {/* 选区内句间分割线 */}
                {selectionState?.isMember && !selectionState.isGroupEnd && (
                    <div
                        aria-hidden="true"
                        className="absolute -bottom-[6px] left-4 right-4 h-[1px] bg-stone-300/80 dark:bg-neutral-600/80 z-[1] pointer-events-none"
                    />
                )}

                {/* 收藏句右上角精致书签标记（绝对定位，不影响文本排版） */}
                {isFavourite && (
                    <div className="absolute top-2.5 right-2 z-20 pointer-events-none">
                        <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400 opacity-90 drop-shadow-xs" />
                    </div>
                )}

                {/* 左上角状态指示器：固定 4x4 占位布局，通过透明度显隐，绝对不挤压文字 */}
                <div
                    className={cn(
                        'relative z-10 flex items-center justify-center w-4 h-4 shrink-0 mt-0.5 transition-opacity duration-200',
                        isCurrent ? 'opacity-100' : 'opacity-0'
                    )}
                >
                    {renderStatusIcon()}
                </div>

                {/* 文本内容区：水平居中对齐 */}
                <motion.div
                    className={cn(
                        'relative z-10 flex-1 min-w-0 flex flex-col items-center justify-center text-center transition-opacity duration-300',
                        hover || show ? 'opacity-100' : 'opacity-0'
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: hover || show ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* 英文主句：激活与非激活字体大小、字重严格恒定(font-normal)，仅通过颜色加深，字符宽度100%不变，绝无换行跳动 */}
                    <div className={cn(
                        'w-full leading-snug transition-colors tracking-normal text-center font-normal',
                        fontSize === 'fontSizeSmall' && 'text-[14.5px]',
                        (!fontSize || fontSize === 'fontSizeMedium') && 'text-[16px]',
                        fontSize === 'fontSizeLarge' && 'text-[18px]',
                        isCurrent
                            ? 'text-stone-950 dark:text-white'
                            : 'text-stone-700 dark:text-neutral-300 group-hover:text-stone-950 dark:group-hover:text-white'
                    )}>
                        {renderHighlightedText(primaryText)}
                    </div>

                    {/* 中文译文：水平居中，激活与非激活字体大小严格一致，加深文本颜色以确保高可读性 */}
                    {secondaryText && (
                        <div className={cn(
                            'w-full mt-1.5 leading-normal transition-colors font-normal text-center',
                            fontSize === 'fontSizeSmall' && 'text-[12.5px]',
                            (!fontSize || fontSize === 'fontSizeMedium') && 'text-[14px]',
                            fontSize === 'fontSizeLarge' && 'text-[15.5px]',
                            isCurrent
                                ? 'text-stone-600 dark:text-neutral-300'
                                : 'text-stone-500/90 dark:text-neutral-400/90 group-hover:text-stone-700 dark:group-hover:text-neutral-200'
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

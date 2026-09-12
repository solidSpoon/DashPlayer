'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, CornerDownLeft, Loader2, Pause, Search, Sparkles, Volume2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/fronted/lib/utils';
import Md from '@/fronted/components/shared/markdown/Markdown';
import Playable from '@/fronted/components/shared/common/Playable';
import { cleanWord, isWordToken, splitWords } from '@/common/utils/subtitle/tokenize';
import { formatPhonetic } from '@/fronted/lib/phonetic';
import { formatDictTag } from '@/fronted/lib/dict-tags';
import type { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import type { AnalysisStatus, LearningMessageView } from '@/fronted/features/chat/types';

/** 学习页顶部展示的学习句信息。 */
export type LearningSentence = {
    /** 原句（英文）。 */
    en: string;
    /** 整句中文意译。 */
    zh: string;
    /** 视频内位置标签，如 S01E03 · 12:41 – 12:46。 */
    position: string;
};

/**
 * 本句生词。
 *
 * 说明：由本地词典选词产生，不依赖模型解析，因此不参与懒加载。
 */
export type LearningWord = {
    /** 单词原形。 */
    word: string;
    /** 音标。 */
    phonetic: string;
    /** 中文释义。 */
    meaning: string;
    /** 命中的考试档位标签；空数组表示不在任何考纲内（即超纲词）。 */
    tags: string[];
    /** 该词在句中实际出现的词形（小写），用于在主舞台字幕上高亮。 */
    surfaces: string[];
};

/** 悬停取词的释义结果。 */
export type LearningWordDetail = {
    /** 音标。 */
    phonetic: string;
    /** 中文释义。 */
    meaning: string;
    /** 命中的考试档位标签；空数组表示超纲词。 */
    tags: string[];
    /** 该词在句中实际出现的词形（小写）。 */
    surfaces: string[];
};

export type LearningWorkspaceProps = {
    sentence: LearningSentence;
    analysis: Partial<AiUnifiedAnalysisRes> | null;
    analysisStatus: AnalysisStatus;
    analysisError: string | null;
    onRequestAnalysis: () => void;
    /** 本句生词；本地选词立即给结果，不参与解析懒加载。 */
    vocabWords: LearningWord[];
    /**
     * 悬停主舞台单词时的取词：返回音标与释义，未收录返回 null。
     * 真实链路应查本地词典（与生词选词同一数据源），保证悬停是同步命中。
     */
    resolveWordDetail: (word: string) => LearningWordDetail | null;
    messages: LearningMessageView[];
    /** 是否正在生成回答。 */
    isBusy: boolean;
    input: string;
    onInputChange: (value: string) => void;
    onSubmit: (text: string) => void;
    onStop: () => void;
    /** 朗读指定文本（整句或某个意群）。 */
    onSpeak: (text: string) => void;
    /** 跳转到指定字幕行。 */
    onJumpToLine: (index: number) => void;
    /** 某个生词是否已在词汇工坊中。 */
    isFavorite: (word: string) => boolean;
    /** 收藏 / 取消收藏某个生词。 */
    onToggleFavorite: (word: string, meaning: string) => void;
    /** 返回播放画面（保留当前学习会话）。 */
    onBackToPlayer: () => void;
};

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

/**
 * 按意群把原句切分成片段，用于顶部的分组展示。
 *
 * 说明：意群由模型按原文顺序给出，这里只在原句里顺序查找，找不到的按剩余文本处理，
 * 因此即使模型给的片段与原文有细微差异，也只影响分组着色，不会丢字。
 *
 * @param text 原句。
 * @param groups 意群片段。
 * @returns 按原文顺序排列的文本片段及其是否属于意群。
 */
const splitSentenceByGroups = (text: string, groups: string[]): { text: string; isGroup: boolean }[] => {
    if (groups.length === 0 || text.trim().length === 0) {
        return [{ text, isGroup: false }];
    }
    const segments: { text: string; isGroup: boolean }[] = [];
    let remaining = text;
    groups.forEach((group) => {
        const target = group.trim();
        if (!target || remaining.trim().length === 0) {
            return;
        }
        const index = remaining.toLowerCase().indexOf(target.toLowerCase());
        if (index < 0) {
            return;
        }
        const before = remaining.slice(0, index);
        if (before) {
            segments.push({ text: before, isGroup: false });
        }
        segments.push({ text: remaining.slice(index, index + target.length), isGroup: true });
        remaining = remaining.slice(index + target.length);
    });
    if (remaining) {
        segments.push({ text: remaining, isGroup: false });
    }
    return segments;
};

/**
 * 学习句主舞台：默认坐在对话输入框上方，让用户对照着句子提问。
 *
 * 说明：作为通栏字幕带呈现，宽度不跟输入框对齐（句子是主角，不限宽更好读）；
 * 默认位置下对话列还没有内容，因此留足纵向呼吸空间，不按紧凑排版；
 * 后期顶到对话列顶部时才需要换成紧凑密度（届时再加 dense 变体）。
 * 原句按意群分组高亮，点任意片段可直接听那一段；
 * 悬停到具体单词时，会在句子上方的小区域里显示该词的音标与释义。
 * 右侧胶囊与播放器主字幕的控制胶囊同形，承载“朗读整句”与“返回播放画面”。
 * 学习页不承载播放控制，进入即为暂停状态。
 */
const SentenceStrip = ({
    sentence,
    segments,
    activeSegment,
    onActivateSegment,
    onSpeak,
    onBackToPlayer,
    resolveWordDetail,
    pickedForms,
}: {
    sentence: LearningSentence;
    segments: { text: string; isGroup: boolean }[];
    activeSegment: number | null;
    onActivateSegment: (index: number | null) => void;
    onSpeak: (text: string) => void;
    onBackToPlayer: () => void;
    resolveWordDetail: (word: string) => LearningWordDetail | null;
    /** 被选进生词卡的词形集合（小写），这些词在句子里要高亮。 */
    pickedForms: Set<string>;
}) => {
    const { t } = useTranslation('common');
    const [hoveredWord, setHoveredWord] = useState<string | null>(null);
    const hoveredDetail = hoveredWord ? resolveWordDetail(hoveredWord) : null;

    /** 意群在整句中的序号（非意群片段不占号）。 */
    let groupIndex = -1;

    /**
     * 把一个片段渲染成可悬停的单词序列。
     * @param text 片段原文（意群或普通文本）。
     * @returns 单词逐个可悬停的节点列表。
     */
    const renderWords = (text: string) => splitWords(text).map((token, index) => {
        if (!isWordToken(token)) {
            return <span key={`gap-${index}`}>{token}</span>;
        }
        const cleaned = cleanWord(token);
        const isPicked = pickedForms.has(cleaned);
        return (
            <span
                key={`word-${index}`}
                onMouseEnter={() => setHoveredWord(cleaned)}
                className={cn(
                    'rounded transition-colors hover:bg-primary/15',
                    // 生词卡里的词在句中标出来：虚线下划线，与播放器字幕的生词提示同一套语言
                    isPicked && 'underline decoration-dotted decoration-primary/60 decoration-2 underline-offset-[0.22em]'
                )}
            >
                {token}
            </span>
        );
    });

    return (
        <div className="shrink-0" onMouseLeave={() => setHoveredWord(null)}>
            {/* 悬停取词区：高度固定，无悬停时留白，避免布局跳动 */}
            <div className="flex h-14 items-center justify-center gap-2.5 px-6 text-center">
                {hoveredDetail && (
                    <>
                        <span className="font-mono text-[11px] text-muted-foreground">
                            {formatPhonetic(hoveredDetail.phonetic)}
                        </span>
                        <span className="text-sm leading-relaxed text-foreground/85">{hoveredDetail.meaning}</span>
                    </>
                )}
            </div>

            <section className="relative flex shrink-0 flex-col items-center justify-center border-t border-border/60 bg-muted/25 px-16 py-8 text-center">
                <p className="mx-auto max-w-4xl text-2xl font-medium leading-relaxed tracking-tight text-foreground">
                    {segments.map((segment, index) => {
                        if (!segment.isGroup) {
                            return (
                                <span key={`plain-${index}`}>{renderWords(segment.text)}</span>
                            );
                        }
                        groupIndex += 1;
                        const currentGroup = groupIndex;
                        return (
                            <span
                                key={`group-${index}`}
                                role="button"
                                tabIndex={0}
                                onMouseEnter={() => onActivateSegment(currentGroup)}
                                onMouseLeave={() => onActivateSegment(null)}
                                onClick={() => onSpeak(segment.text)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        onSpeak(segment.text);
                                    }
                                }}
                                className={cn(
                                    'cursor-pointer rounded-md px-[3px] transition-colors',
                                    'bg-primary/[0.07] hover:bg-primary/15',
                                    activeSegment === currentGroup && 'bg-primary/20'
                                )}
                            >
                                {renderWords(segment.text)}
                            </span>
                        );
                    })}
                </p>

                {!!sentence.zh && (
                    <p className="mx-auto mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground">
                        {sentence.zh}
                    </p>
                )}

                <div className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-full border border-border/50 bg-background/75 px-1 py-0.5 backdrop-blur-sm">
                <button
                    type="button"
                    onClick={() => onSpeak(sentence.en)}
                    title={t('learning.readSentence')}
                    aria-label={t('learning.readSentence')}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                    <Volume2 className="h-3.5 w-3.5" />
                </button>
                <div className="h-3 w-px bg-border" />
                <button
                    type="button"
                    onClick={onBackToPlayer}
                    title={t('learning.backToPlayer')}
                    aria-label={t('learning.backToPlayer')}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
                </div>
            </section>
        </div>
    );
};

/**
 * 对话为空时的「预习」块：本句生词以卡片列表呈现。
 *
 * 说明：
 * - 生词是本地选词结果，不需要模型解析就能展示；
 * - 卡片里的单词可点读，收藏状态与词汇工坊词表联动；
 * - 它同时是“句子悬停取词”的兜底：列表里没有的词，悬停主舞台的句子也能查；
 * - 只承载“看”的内容，提问引导放在输入框上方，避免两件事混在一块。
 */
const VocabPreview = ({
    words,
    isFavorite,
    onToggleFavorite,
}: {
    words: LearningWord[];
    isFavorite: (word: string) => boolean;
    onToggleFavorite: (word: string, meaning: string) => void;
}) => {
    const { t } = useTranslation('common');

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-4">
            <div className="flex flex-col items-center gap-1.5">
                <span className={SECTION_TITLE}>{t('learning.vocab')}</span>
                <span className="text-[11px] text-muted-foreground/80">{t('learning.vocabPreviewHint')}</span>
            </div>

            <div className="flex w-full flex-wrap justify-center gap-3">
                {words.map((word) => (
                    <div
                        key={word.word}
                        className="flex w-[210px] flex-col gap-1 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left shadow-xs"
                    >
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            <Playable className="text-lg font-semibold tracking-tight text-foreground">
                                {word.word}
                            </Playable>
                            {!!word.phonetic && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                    {formatPhonetic(word.phonetic)}
                                </span>
                            )}
                        </div>
                        <div className="text-xs leading-snug text-foreground/80">{word.meaning}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <ExamTagBadges tags={word.tags} />
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleFavorite(word.word, word.meaning)}
                            className={cn(
                                'mt-1 self-end rounded-md px-1.5 py-0.5 text-[11px] transition-colors',
                                isFavorite(word.word)
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            )}
                        >
                            {isFavorite(word.word) ? t('learning.favorited') : t('learning.favorite')}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * 考试档位徽章：标出这个词属于哪几级考纲；不在任何考纲内时标「超纲」。
 *
 * 说明：卡片太少时末尾会补上考纲内但常用的词占位，徽章让用户看得出它为什么在这里，
 * 也能一眼判断本句词汇的难度分布。
 */
const ExamTagBadges = ({ tags }: { tags: string[] }) => {
    const { t } = useTranslation('common');
    const labels = tags
        .map((tag) => formatDictTag(tag, t))
        .filter((label): label is string => !!label);

    if (labels.length === 0) {
        return (
            <span className="rounded border border-primary/30 px-1 py-px text-[10px] leading-none text-primary/80">
                {t('learning.beyondSyllabus')}
            </span>
        );
    }
    return (
        <>
            {labels.map((label) => (
                <span
                    key={label}
                    className="rounded bg-muted/70 px-1 py-px text-[10px] leading-none text-muted-foreground"
                >
                    {label}
                </span>
            ))}
        </>
    );
};

/**
 * 本句生词列表：内容来自本地词典选词，因此与解析懒加载无关，可独立渲染。
 */
const VocabList = ({
    words,
    isFavorite,
    onToggleFavorite,
    className,
}: {
    words: LearningWord[];
    isFavorite: (word: string) => boolean;
    onToggleFavorite: (word: string, meaning: string) => void;
    className?: string;
}) => {
    const { t } = useTranslation('common');

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <span className={SECTION_TITLE}>{t('learning.vocab')}</span>
            <div className="flex flex-col gap-1.5">
                {words.map((word, index) => (
                    <div
                        key={`${word.word}-${index}`}
                        className="flex items-start gap-3 rounded-xl bg-muted/35 px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-semibold text-foreground">{word.word}</span>
                                {!!word.phonetic && (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        {formatPhonetic(word.phonetic)}
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 text-[11px] leading-snug text-foreground/80">{word.meaning}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleFavorite(word.word, word.meaning)}
                            className={cn(
                                'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] transition-colors',
                                isFavorite(word.word)
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                            )}
                        >
                            {isFavorite(word.word) ? t('learning.favorited') : t('learning.favorite')}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * 解析列的懒加载空状态：整个内容区可点击，点一下才开始生成解析。
 *
 * 说明：默认不预生成，避免用户只是看一眼句子就消耗一次模型调用；
 * 空状态里直接列出会得到什么，用户知道点下去会发生什么。
 */
const AnalysisPlaceholder = ({ onLoad }: { onLoad: () => void }) => {
    const { t } = useTranslation('common');
    const items = [
        t('learning.phraseGroups'),
        t('learning.vocab'),
        t('learning.phrases'),
        t('learning.grammar'),
    ];

    return (
        <button
            type="button"
            onClick={onLoad}
            className={cn(
                'group mx-4 mb-4 flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-border/70 px-6 text-center transition-colors',
                'hover:border-primary/40 hover:bg-muted/30'
            )}
        >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-foreground">{t('learning.loadAnalysis')}</span>
            <span className="text-[11px] leading-relaxed text-muted-foreground">{t('learning.loadAnalysisHint')}</span>
            <span className="mt-1 flex flex-wrap justify-center gap-1.5">
                {items.map((item) => (
                    <span
                        key={item}
                        className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                        {item}
                    </span>
                ))}
            </span>
        </button>
    );
};

/**
 * 解析列：开场导学 + 意群 + 生词 + 词组 + 语法。
 * 未开始生成时（idle）只展示懒加载入口，不展示任何解析内容。
 */
const AnalysisPane = ({
    analysis,
    status,
    error,
    onRequestAnalysis,
    activeSegment,
    onActivateSegment,
    isFavorite,
    onToggleFavorite,
    showVocab,
    vocabWords,
    className,
}: {
    analysis: Partial<AiUnifiedAnalysisRes> | null;
    status: AnalysisStatus;
    error: string | null;
    onRequestAnalysis: () => void;
    activeSegment: number | null;
    onActivateSegment: (index: number | null) => void;
    isFavorite: (word: string) => boolean;
    onToggleFavorite: (word: string, meaning: string) => void;
    /** 是否在左栏展示生词；对话为空时生词由对话列的预习块承担，此处不重复。 */
    showVocab: boolean;
    /** 本句生词；由本地选词提供，不参与模型解析的懒加载。 */
    vocabWords: LearningWord[];
    className?: string;
}) => {
    const { t } = useTranslation('common');
    const [grammarOpen, setGrammarOpen] = useState(false);
    const phraseGroups = analysis?.structure?.phraseGroups ?? [];
    const phrases = analysis?.phrases;
    const grammarMd = analysis?.grammar?.grammarsMd ?? '';
    const isLoading = status === 'streaming' && !analysis?.opening && !phrases;

    return (
        <section className={cn('flex min-h-0 flex-col', className)}>
            <div className="flex h-11 shrink-0 items-center gap-2 px-5">
                <span className={SECTION_TITLE}>{t('learning.analysisTitle')}</span>
                {status === 'streaming' && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('learning.analysisRunning')}
                    </span>
                )}
            </div>

            {/* 本地生词与解析懒加载无关：尚未生成解析时它也已经就绪 */}
            {status === 'idle' && showVocab && vocabWords.length > 0 && (
                <VocabList
                    words={vocabWords}
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    className="shrink-0 px-5 pb-4"
                />
            )}

            {status === 'idle' && <AnalysisPlaceholder onLoad={onRequestAnalysis} />}

            <div className={cn(
                'space-y-5 px-5 pb-6',
                status === 'idle' ? 'shrink-0' : 'min-h-0 flex-1 overflow-y-auto scrollbar-thin'
            )}>
                {status === 'error' && (
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5">
                        <span className="min-w-0 flex-1 break-words text-[11px] leading-snug text-destructive">
                            {error ?? t('learning.analysisFailed')}
                        </span>
                        <button
                            type="button"
                            onClick={onRequestAnalysis}
                            className="shrink-0 rounded-md border border-destructive/40 px-2 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
                        >
                            {t('learning.retry')}
                        </button>
                    </div>
                )}

                {isLoading && (
                    <div className="space-y-2.5">
                        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/70" />
                        <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
                    </div>
                )}

                {!isLoading && !!analysis?.opening && (
                    <div className="text-xs leading-relaxed text-foreground/90 [&_li]:my-1 [&_p]:my-2 [&_ul]:my-2">
                        <Md>{analysis.opening}</Md>
                    </div>
                )}

                {phraseGroups.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <span className={SECTION_TITLE}>{t('learning.phraseGroups')}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {phraseGroups.map((group, index) => (
                                <React.Fragment key={`${group}-${index}`}>
                                    {index > 0 && <span className="text-muted-foreground/50">›</span>}
                                    <button
                                        type="button"
                                        onMouseEnter={() => onActivateSegment(index)}
                                        onMouseLeave={() => onActivateSegment(null)}
                                        className={cn(
                                            'rounded-md bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground/90 transition-colors',
                                            activeSegment === index && 'bg-primary/20 text-foreground'
                                        )}
                                    >
                                        {group}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}

                {showVocab && status !== 'idle' && vocabWords.length > 0 && (
                    <VocabList
                        words={vocabWords}
                        isFavorite={isFavorite}
                        onToggleFavorite={onToggleFavorite}
                    />
                )}

                {phrases?.hasPhrase && (phrases.phrases?.length ?? 0) > 0 && (
                    <div className="flex flex-col gap-2">
                        <span className={SECTION_TITLE}>{t('learning.phrases')}</span>
                        <div className="flex flex-col gap-1.5">
                            {phrases.phrases?.map((phrase, index) => (
                                <div key={`${phrase.phrase}-${index}`} className="rounded-xl bg-muted/35 px-3 py-2">
                                    <div className="text-sm font-medium text-foreground/90">{phrase.phrase}</div>
                                    <div className="mt-0.5 text-[11px] leading-snug text-foreground/80">
                                        {phrase.meaning}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {grammarMd.trim().length > 0 && (
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => setGrammarOpen((value) => !value)}
                            aria-expanded={grammarOpen}
                            className="flex items-center gap-1.5 self-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ChevronRight className={cn('h-3 w-3 transition-transform', grammarOpen && 'rotate-90')} />
                            {t('learning.grammar')}
                        </button>
                        {grammarOpen && (
                            <div className="rounded-xl bg-muted/25 p-3 text-xs leading-relaxed text-foreground/85 [&_li]:my-1 [&_p]:my-1.5 [&_ul]:my-1.5">
                                <Md>{grammarMd}</Md>
                            </div>
                        )}
                    </div>
                )}

                {status === 'done' && !isLoading && !analysis?.opening && phraseGroups.length === 0
                    && !phrases?.hasPhrase && grammarMd.trim().length === 0 && (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                            {t('learning.noAnalysisPoints')}
                        </div>
                    )}
            </div>
        </section>
    );
};

/** 一条检索依据：摘要一行 + 可点击跳转的命中字幕行。 */
const SearchEvidence = ({
    queries,
    hits,
    total,
    running,
    onJumpToLine,
}: {
    queries: string[];
    hits: { index: number; text: string }[];
    total: number;
    running: boolean;
    onJumpToLine: (index: number) => void;
}) => {
    const { t } = useTranslation('common');
    const [open, setOpen] = useState(true);

    return (
        <div className="mt-2 rounded-xl border border-border/60 bg-muted/25 px-3 py-2">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
                {running
                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    : <Search className="h-3.5 w-3.5 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">
                    {t('learning.searchLabel', { query: queries.join(' · ') })}
                </span>
                {!running && (
                    <span className="shrink-0 tabular-nums">{t('learning.searchHits', { count: total })}</span>
                )}
            </button>
            {open && hits.length > 0 && (
                <div className="mt-2 flex flex-col gap-0.5 border-t border-border/50 pt-2">
                    {hits.map((hit) => (
                        <button
                            key={`${hit.index}-${hit.text}`}
                            type="button"
                            title={t('learning.jump')}
                            onClick={() => onJumpToLine(hit.index)}
                            className="flex items-start gap-2 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug text-foreground/85 transition-colors hover:bg-background"
                        >
                            <span className="w-8 shrink-0 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                                {hit.index}
                            </span>
                            <span className="min-w-0 flex-1">{hit.text}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/** 对话列：消息流 + 学习句主舞台 + 输入框。 */
const ConversationPane = ({
    messages,
    isBusy,
    input,
    onInputChange,
    onSubmit,
    onStop,
    onJumpToLine,
    empty,
    stage,
    className,
}: {
    messages: LearningMessageView[];
    isBusy: boolean;
    input: string;
    onInputChange: (value: string) => void;
    onSubmit: (text: string) => void;
    onStop: () => void;
    onJumpToLine: (index: number) => void;
    /** 对话为空时占据消息区的“预习”内容；未提供时回退到示例问题。 */
    empty?: React.ReactNode;
    /** 学习句主舞台；默认坐在输入框上方，后期可换成顶到对话列顶部。 */
    stage?: React.ReactNode;
    className?: string;
}) => {
    const { t } = useTranslation('common');

    return (
        <section className={cn('flex min-h-0 flex-col', className)}>
            <div className="flex h-11 shrink-0 items-center px-5">
                <span className={SECTION_TITLE}>{t('learning.conversationTitle')}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 scrollbar-thin">
                {messages.length === 0 && (
                    <div className="flex min-h-full items-center justify-center">
                        {empty ?? (
                            <p className="text-xs text-muted-foreground">{t('learning.noVocabWords')}</p>
                        )}
                    </div>
                )}

                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn(
                                'flex flex-col',
                                message.role === 'user' ? 'items-end' : 'items-start'
                            )}
                        >
                            {message.role === 'user'
                                ? message.blocks.map((block, index) => (
                                    block.kind === 'text' ? (
                                        <div
                                            key={`${message.id}-${index}`}
                                            className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground"
                                        >
                                            {block.text}
                                        </div>
                                    ) : null
                                ))
                                : (
                                    <div className="w-full">
                                        {message.blocks.map((block, index) => {
                                            if (block.kind === 'text') {
                                                return (
                                                    <div
                                                        key={`${message.id}-${index}`}
                                                        className="text-sm leading-relaxed text-foreground/90 [&_p]:my-2 [&_ul]:my-2"
                                                    >
                                                        <Md>{block.text}</Md>
                                                    </div>
                                                );
                                            }
                                            if (block.kind === 'search') {
                                                return (
                                                    <SearchEvidence
                                                        key={`${message.id}-${index}`}
                                                        queries={block.queries}
                                                        hits={block.hits}
                                                        total={block.total}
                                                        running={block.running}
                                                        onJumpToLine={onJumpToLine}
                                                    />
                                                );
                                            }
                                            if (block.kind === 'context') {
                                                return (
                                                    <div
                                                        key={`${message.id}-${index}`}
                                                        className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"
                                                    >
                                                        {block.running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                                        <span>
                                                            {block.range
                                                                ? t('learning.contextRange', {
                                                                    start: block.range.start,
                                                                    end: block.range.end,
                                                                })
                                                                : t('learning.contextReading')}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div
                                                    key={`${message.id}-${index}`}
                                                    className="mt-2 text-[11px] leading-snug text-destructive"
                                                >
                                                    {block.text}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                        </div>
                    ))}

                    {isBusy && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {t('learning.thinking')}
                        </div>
                    )}
                </div>
            </div>

            {/* 学习句主舞台：通栏字幕带，贴着输入框，方便对照句子提问 */}
            {stage && <div className="shrink-0">{stage}</div>}

            <div className="shrink-0 px-6 pb-5 pt-2">
                <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-xs transition-colors focus-within:border-primary/50">
                    <textarea
                        value={input}
                        onChange={(event) => onInputChange(event.currentTarget.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                onSubmit(input);
                            }
                        }}
                        rows={1}
                        placeholder={t('learning.inputPlaceholder')}
                        className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70"
                    />
                    <button
                        type="button"
                        onClick={isBusy ? onStop : () => onSubmit(input)}
                        aria-label={isBusy ? t('learning.stop') : t('learning.send')}
                        title={isBusy ? t('learning.stop') : t('learning.send')}
                        disabled={!isBusy && input.trim().length === 0}
                        className={cn(
                            'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
                            'bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground'
                        )}
                    >
                        {isBusy
                            ? <Pause className="h-3.5 w-3.5 fill-current" />
                            : <CornerDownLeft className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>
        </section>
    );
};

/**
 * 整句学习页。
 *
 * 说明：本组件替换播放器的视频与主字幕区域，是纯展示层：
 * 所有数据与动作由外部注入，便于单独预览版式，也便于在播放页与原型页之间复用。
 *
 * @param props 学习句、解析结果、对话视图与各类动作。
 */
export default function LearningWorkspace({
    sentence,
    analysis,
    analysisStatus,
    analysisError,
    onRequestAnalysis,
    vocabWords,
    resolveWordDetail,
    messages,
    isBusy,
    input,
    onInputChange,
    onSubmit,
    onStop,
    onSpeak,
    onJumpToLine,
    isFavorite,
    onToggleFavorite,
    onBackToPlayer,
}: LearningWorkspaceProps) {
    const { t } = useTranslation('common');
    const [activeSegment, setActiveSegment] = useState<number | null>(null);
    const segments = useMemo(
        () => splitSentenceByGroups(sentence.en, analysis?.structure?.phraseGroups ?? []),
        [analysis, sentence.en]
    );
    // 对话为空时，生词改由对话列的预习块承担（见 VocabPreview），左栏不再重复
    const hasMessages = messages.length > 0;
    // 卡片上的词在句子里同样标出来（按句内实际词形匹配，watch 也能对应到 watching）
    const pickedForms = useMemo(
        () => new Set(vocabWords.flatMap((word) => word.surfaces)),
        [vocabWords]
    );

    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-background">
            {/* 顶部只留非交互的标题标签：最上方 40px 是窗口拖拽安全区，不能放可点元素。
                注：后期要试验“首条消息出现后把主舞台顶到对话列顶部”，改 stage 的传递位置即可。 */}
            <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-5 text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">{t('learning.title')}</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="tabular-nums">{sentence.position}</span>
            </header>

            <div
                className={cn(
                    'grid min-h-0 flex-1',
                    'grid-cols-1 grid-rows-[minmax(0,54%)_minmax(0,1fr)]',
                    'lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)] lg:grid-rows-1'
                )}
            >
                <AnalysisPane
                    analysis={analysis}
                    status={analysisStatus}
                    error={analysisError}
                    onRequestAnalysis={onRequestAnalysis}
                    activeSegment={activeSegment}
                    onActivateSegment={setActiveSegment}
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    showVocab={hasMessages}
                    vocabWords={vocabWords}
                    className="border-b border-border/60 lg:border-b-0 lg:border-r"
                />
                <ConversationPane
                    messages={messages}
                    isBusy={isBusy}
                    input={input}
                    onInputChange={onInputChange}
                    onSubmit={onSubmit}
                    onStop={onStop}
                    onJumpToLine={onJumpToLine}
                    empty={vocabWords.length > 0 ? (
                        <VocabPreview
                            words={vocabWords}
                            isFavorite={isFavorite}
                            onToggleFavorite={onToggleFavorite}
                        />
                    ) : undefined}
                    stage={(
                        <SentenceStrip
                            sentence={sentence}
                            segments={segments}
                            activeSegment={activeSegment}
                            onActivateSegment={setActiveSegment}
                            onSpeak={onSpeak}
                            onBackToPlayer={onBackToPlayer}
                            resolveWordDetail={resolveWordDetail}
                            pickedForms={pickedForms}
                        />
                    )}
                />
            </div>
        </div>
    );
}

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Loader2, Pause, Search, Sparkles, Volume2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/fronted/lib/utils';
import Md from '@/fronted/components/shared/markdown/Markdown';
import Playable from '@/fronted/components/shared/common/Playable';
import { cleanWord, isWordToken, splitWords } from '@/common/utils/subtitle/tokenize';
import { formatPhonetic } from '@/fronted/lib/phonetic';
import { formatDictTag } from '@/fronted/lib/dict-tags';
import useSystem from '@/fronted/hooks/useSystem';
import type { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import type { SentenceWordEntry } from '@/common/types/vo/SentenceVocabularyVO';
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

export type LearningWorkspaceProps = {
    sentence: LearningSentence;
    /** 结构化分析结果；懒加载，null 表示尚未生成。 */
    analysis: Partial<AiUnifiedAnalysisRes> | null;
    /** 分析生命周期状态。 */
    analysisStatus: AnalysisStatus;
    /** 分析失败信息。 */
    analysisError: string | null;
    /** 请求生成结构化分析（懒加载入口）。 */
    onRequestAnalysis: () => void;
    /**
     * 后端会话是否已就绪。
     *
     * 说明：进入学习页时当前字幕行会先乐观展示，云端补全与会话创建随后才返回；
     * 会话建立前没有主题快照可用，对话与解析入口先按住，避免发起注定失败的模型调用。
     */
    sessionReady: boolean;
    /**
     * 云端整句讲解当前是否可用（功能已启用且模型凭证齐备）。
     *
     * 说明：整句讲解只有云端这一条路，不可用时解析与对话入口一并置灰并说明原因，
     * 用户不需要点下去才发现用不了；句子与本地生词不受影响，照常展示。
     */
    cloudAvailable: boolean;
    /** 本句生词；本地选词立即给结果，不参与解析懒加载。 */
    vocabWords: SentenceWordEntry[];
    /**
     * 悬停主舞台单词时的取词：返回音标与释义，未收录返回 null。
     * 真实链路应查本地词典（与生词选词同一数据源），保证悬停是同步命中。
     */
    resolveWordDetail: (word: string) => SentenceWordEntry | null;
    messages: LearningMessageView[];
    /** 是否正在生成回答。 */
    isBusy: boolean;
    input: string;
    onInputChange: (value: string) => void;
    onSubmit: (text: string) => void;
    onStop: () => void;
    /** 朗读指定文本（整句）。 */
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
 * 意群标记用色：按意群顺序循环取。
 *
 * 说明：只要浅色，标记意群边界就够了，不抢句子正文；
 * 相邻意群取到不同颜色，边界一眼可辨。
 */
const PHRASE_GROUP_MARKS = [
    'decoration-sky-300',
    'decoration-amber-300',
    'decoration-emerald-300',
    'decoration-violet-300',
    'decoration-rose-300',
];

/**
 * 按意群把原句切分成片段，供主舞台逐段画下划线。
 *
 * 说明：意群由模型按原文顺序给出，这里只在原句里顺序查找，找不到的片段跳过、
 * 其余文本按普通片段处理，因此即使模型给的片段与原文有细微差异，也只影响下划线的位置，不会丢字。
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
 * 学习句主舞台：作为一段正文浮在页面上（不铺底板、不划线），让用户对照着句子提问。
 *
 * 说明：它是「一条特殊消息」而不是输入区的一部分——没有通栏底板与边框，
 * 只在与输入区之间留出距离，因此不会被读成聊天框的一组；
 * 宽度不跟输入框对齐（句子是主角，不限宽更好读）；
 * 悬停到具体单词时，会在句子上方的小区域里显示该词的音标与释义；
 * 原句进页面时就是当前字幕行，云端整句补全在后台把它换得更完整：
 * 补全期间在句子下方提示一句，用户知道自己在看的是待补全的版本。
 * 意群不在句子上做可点区域，只用浅色下划线分段标出（相邻意群换色），
 * 读整句用右侧的朗读按钮；学习页不承载播放控制，进入即为暂停状态。
 */
const SentenceStrip = ({
    sentence,
    phraseGroups,
    preparing,
    onSpeak,
    resolveWordDetail,
    pickedForms,
}: {
    sentence: LearningSentence;
    /** 意群片段；解析尚未生成时为空数组，此时整句按普通文本渲染。 */
    phraseGroups: string[];
    /** 云端整句补全进行中：此时展示的仍是字幕行原文。 */
    preparing: boolean;
    onSpeak: (text: string) => void;
    resolveWordDetail: (word: string) => SentenceWordEntry | null;
    /** 被选进生词卡的词形集合（小写），这些词在句子里要高亮。 */
    pickedForms: Set<string>;
}) => {
    const { t } = useTranslation('common');
    const [hoveredWord, setHoveredWord] = useState<string | null>(null);
    const hoveredDetail = hoveredWord ? resolveWordDetail(hoveredWord) : null;
    // 解析是流式回推的，这里跟着原句一起缓存，避免每个 chunk 都重切一次句子
    const segments = useMemo(
        () => splitSentenceByGroups(sentence.en, phraseGroups),
        [phraseGroups, sentence.en]
    );
    /** 意群在整句中的序号（非意群片段不占号），用于取标记色。 */
    let groupIndex = -1;

    /**
     * 把一段文本渲染成可悬停的单词序列。
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
                        <span className="text-sm font-semibold tracking-tight text-foreground">
                            {hoveredDetail.word}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                            {formatPhonetic(hoveredDetail.phonetic)}
                        </span>
                        <span className="text-sm leading-relaxed text-foreground/85">{hoveredDetail.meaning}</span>
                    </>
                )}
            </div>

            <section className="relative flex shrink-0 flex-col items-center justify-center px-16 py-8 text-center">
                <p className="mx-auto max-w-4xl text-2xl font-medium leading-relaxed tracking-tight text-foreground">
                    {segments.map((segment, index) => {
                        if (!segment.isGroup) {
                            return <span key={`plain-${index}`}>{renderWords(segment.text)}</span>;
                        }
                        groupIndex += 1;
                        return (
                            <span
                                key={`group-${index}`}
                                className={cn(
                                    'underline underline-offset-[0.28em] decoration-[3px]',
                                    PHRASE_GROUP_MARKS[groupIndex % PHRASE_GROUP_MARKS.length]
                                )}
                            >
                                {renderWords(segment.text)}
                            </span>
                        );
                    })}
                </p>

                {/* 云端补全进行中：句子已经能读，只是还会被换成更完整的版本 */}
                {preparing && (
                    <span className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('learning.preparingSession')}
                    </span>
                )}

                {!!sentence.zh && (
                    <p className="mx-auto mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground">
                        {sentence.zh}
                    </p>
                )}

                <button
                    type="button"
                    onClick={() => onSpeak(sentence.en)}
                    title={t('learning.readSentence')}
                    aria-label={t('learning.readSentence')}
                    className="absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/50 bg-background/75 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                    <Volume2 className="h-3.5 w-3.5" />
                </button>
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
 * - 卡片按行等高拉伸，收藏按钮钉在卡片底部，避免释义长短不一把按钮挤得参齐不齐。
 */
const VocabPreview = ({
    words,
    isFavorite,
    onToggleFavorite,
}: {
    words: SentenceWordEntry[];
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

            <div className="flex w-full flex-wrap items-stretch justify-center gap-3">
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
                                'mt-auto self-end rounded-md px-1.5 py-0.5 text-[11px] transition-colors',
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
    words: SentenceWordEntry[];
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
 * 空状态里直接列出会得到什么，用户知道点下去会发生什么；
 * 入口不可点时置灰：会话尚未就绪，或云端整句讲解根本不可用（后者给出原因）。
 */
const AnalysisPlaceholder = ({
    onLoad,
    disabled,
    disabledHint,
}: {
    onLoad: () => void;
    disabled: boolean;
    /** 持续不可用的原因；会话正在建立这类瞬时不可用传空，沿用原有提示。 */
    disabledHint: string | null;
}) => {
    const { t } = useTranslation('common');
    const items = [
        t('learning.phraseGroups'),
        t('learning.vocab'),
        t('learning.phrases'),
    ];

    return (
        <button
            type="button"
            onClick={onLoad}
            disabled={disabled}
            className={cn(
                'group mx-4 mb-4 flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-border/70 px-6 text-center transition-colors',
                'hover:border-primary/40 hover:bg-muted/30',
                // 置灰期间连悬停反馈一起去掉，免得看起来还能点
                disabled && 'pointer-events-none opacity-60'
            )}
        >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-foreground">{t('learning.loadAnalysis')}</span>
            <span className="text-[11px] leading-relaxed text-muted-foreground">
                {disabled && disabledHint ? disabledHint : t('learning.loadAnalysisHint')}
            </span>
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
 * 解析列：生词、词组、意群（意群排在最下面，主舞台句子不再做分组着色）。
 * 未开始生成时（idle）只展示懒加载入口，不展示任何解析内容。
 * 语法不在这里出结构化结果：想讲语法点输入框上方的「本句语法」快捷提问，由对话流回答。
 */
const AnalysisPane = ({
    analysis,
    status,
    error,
    onRequestAnalysis,
    entriesReady,
    entriesDisabledHint,
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
    /** 懒加载入口是否可点：会话已就绪且云端整句讲解可用。 */
    entriesReady: boolean;
    /** 入口因云端不可用而置灰时的说明；瞬时不可用为 null。 */
    entriesDisabledHint: string | null;
    isFavorite: (word: string) => boolean;
    onToggleFavorite: (word: string, meaning: string) => void;
    /** 是否在左栏展示生词；对话为空时生词由对话列的预习块承担，此处不重复。 */
    showVocab: boolean;
    /** 本句生词；由本地选词提供，不参与模型解析的懒加载。 */
    vocabWords: SentenceWordEntry[];
    className?: string;
}) => {
    const { t } = useTranslation('common');
    const phraseGroups = analysis?.structure?.phraseGroups ?? [];
    const phrases = analysis?.phrases;
    const isLoading = status === 'streaming' && !analysis?.structure && !phrases;

    return (
        <section className={cn('flex min-h-0 flex-col', className)}>
            {/* 左栏不设标题：这一行留空只为与右栏的对话标题行等高，解析进行中时在行内提示 */}
            <div className="flex h-11 shrink-0 items-center px-5">
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

            {status === 'idle' && (
                <AnalysisPlaceholder
                    onLoad={onRequestAnalysis}
                    disabled={!entriesReady}
                    disabledHint={entriesDisabledHint}
                />
            )}

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

                {status === 'done' && !isLoading && phraseGroups.length === 0
                    && !phrases?.hasPhrase && (
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

/**
 * 对话列：消息流 + 学习句主舞台 + 快捷提问 + 输入框。
 *
 * 说明：主舞台（学习句）就是内容流的第一条，只是比普通消息宽——内容不满一屏时整块贴着
 * 输入区，所以空页时它落在最下面、生词卡片占满它上方；开始对话后新消息长在它下面把它顶上去，
 * 对话再长就随消息一起滚出屏幕。位置全靠普通的消息流布局，不需要额外的位移逻辑。
 *
 * 消息区跟随最新内容，用户手动往上翻时暂停跟随，翻回底部附近再恢复。
 */
const ConversationPane = ({
    messages,
    isBusy,
    entriesReady,
    entriesDisabledHint,
    input,
    onInputChange,
    onSubmit,
    onStop,
    onJumpToLine,
    onBackToPlayer,
    quickPrompts,
    empty,
    stage,
    className,
}: {
    messages: LearningMessageView[];
    isBusy: boolean;
    /**
     * 对话入口是否可用：会话已就绪且云端整句讲解可用。
     *
     * 说明：会话只是还没建立时，输入框仍可打字，只是发不出去；
     * 云端整句讲解整体不可用时连输入框一起按住，此时 entriesDisabledHint 说明原因。
     */
    entriesReady: boolean;
    /** 云端整句讲解不可用的说明；可用时为 null。 */
    entriesDisabledHint: string | null;
    input: string;
    onInputChange: (value: string) => void;
    onSubmit: (text: string) => void;
    onStop: () => void;
    onJumpToLine: (index: number) => void;
    /** 返回播放画面（保留当前学习会话）。 */
    onBackToPlayer: () => void;
    /** 输入框上方的快捷提问：点一下直接把问题发进对话。 */
    quickPrompts: { label: string; prompt: string }[];
    /** 对话为空时占据消息区的“预习”内容；未提供时回退到默认提示。 */
    empty?: React.ReactNode;
    /** 学习句主舞台：内容流的第一条，比普通消息宽；不满一屏时贴在输入区上方。 */
    stage?: React.ReactNode;
    className?: string;
}) => {
    const { t } = useTranslation('common');
    const hasMessages = messages.length > 0;
    const scrollRef = useRef<HTMLDivElement | null>(null);
    // 是否跟随最新内容：用户自己往上翻看旧内容时暂停跟随，滚回底部附近再恢复
    const followBottomRef = useRef(true);

    /** 记录用户是否停在底部附近，决定新内容到来时要不要跟着滚。 */
    const handleScroll = () => {
        const el = scrollRef.current;
        if (el) {
            followBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
        }
    };

    // 新消息与流式片段到来自动跟到底部：学习句因此被顶上去、随对话滚出屏幕
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !followBottomRef.current) {
            return;
        }
        el.scrollTop = el.scrollHeight;
    }, [isBusy, messages]);

    return (
        <section className={cn('flex min-h-0 flex-col', className)}>
            <div className="flex h-11 shrink-0 items-center px-5">
                <span className={SECTION_TITLE}>{t('learning.conversationTitle')}</span>
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4 scrollbar-thin"
            >
                {!hasMessages && (
                    <div className="flex flex-1 items-center justify-center">
                        {empty ?? (
                            <p className="text-xs text-muted-foreground">{t('learning.noVocabWords')}</p>
                        )}
                    </div>
                )}

                {/* 学习句就是内容流的第一条（只是比普通消息宽）：mt-auto 让内容不满一屏时
                    整块贴着输入区，空页时它因此落在最下面、上面留给生词卡片；
                    发消息后新消息长在它下面把它顶上去，对话长了就随消息一起滚出屏幕。
                    -mx-6 抵消滚动容器的左右内边距，让它保持通栏 */}
                {stage && <div className="-mx-6 mt-auto shrink-0">{stage}</div>}

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

            {/* 快捷提问：点一下直接把问题发进对话，省得手动打字；云端整句讲解不可用时这里换成原因说明，别摆一排点不动的按钮 */}
            <div className="shrink-0 px-6 pt-2">
                {entriesDisabledHint ? (
                    <p className="mx-auto w-full max-w-3xl text-[11px] leading-snug text-muted-foreground">
                        {entriesDisabledHint}
                    </p>
                ) : (
                    <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-1.5">
                        {quickPrompts.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                disabled={isBusy || !entriesReady}
                                onClick={() => onSubmit(item.prompt)}
                                className={cn(
                                    'rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors',
                                    'hover:border-primary/40 hover:text-foreground',
                                    'disabled:cursor-not-allowed disabled:opacity-50'
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="shrink-0 px-6 pb-2 pt-2">
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
                        disabled={!!entriesDisabledHint}
                        placeholder={entriesDisabledHint ?? t('learning.inputPlaceholder')}
                        className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
                    />
                    <button
                        type="button"
                        onClick={isBusy ? onStop : () => onSubmit(input)}
                        aria-label={isBusy ? t('learning.stop') : t('learning.send')}
                        title={isBusy ? t('learning.stop') : t('learning.send')}
                        disabled={!isBusy && (!entriesReady || input.trim().length === 0)}
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

            {/* 返回播放画面的出口钉在页面右下角：句子上只留朗读，两个按钮挨在一起容易误点 */}
            <div className="flex shrink-0 justify-end px-6 pb-3">
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
    );
};

/**
 * 整句学习页。
 *
 * 说明：本组件替换播放器的视频与主字幕区域，是纯展示层：
 * 所有数据与动作由外部注入，便于单独预览版式，也便于在播放页与原型页之间复用。
 * 左栏按需生成结构化解析（生词、词组、意群），语法讲解走输入框上方的
 * 快捷提问，由对话流统一作答。会话尚未就绪、或云端整句讲解不可用时，
 * 对话与解析入口先按住并说明原因，句子与本地生词照常展示。
 *
 * @param props 学习句、解析结果、对话视图与各类动作。
 */
export default function LearningWorkspace({
    sentence,
    analysis,
    analysisStatus,
    analysisError,
    onRequestAnalysis,
    sessionReady,
    cloudAvailable,
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
    const isMac = useSystem((s) => s.isMac);
    // 云端整体不可用时入口持续置灰，说明写进入口本身；只是会话还没建好则沿用原有提示
    const entriesReady = sessionReady && cloudAvailable;
    const entriesDisabledHint = cloudAvailable ? null : t('learning.cloudRequired');
    // 对话为空时，生词改由对话列的预习块承担（见 VocabPreview），左栏不再重复
    const hasMessages = messages.length > 0;
    // 卡片上的词在句子里同样标出来（按句内实际词形匹配，watch 也能对应到 watching）
    const pickedForms = useMemo(
        () => new Set(vocabWords.flatMap((word) => word.surfaces)),
        [vocabWords]
    );
    // 意群由主舞台的句子下划线承担，左栏不再单列一份；数组身份要稳，避免流式回推时重切句子
    const phraseGroups = useMemo(() => analysis?.structure?.phraseGroups ?? [], [analysis]);
    // 输入框上方的快捷提问：label 是按钮文案，prompt 是点击后发进对话的问题
    const quickPrompts = useMemo(() => ([
        { label: t('learning.phraseGroups'), prompt: t('learning.askPhraseGroups') },
        { label: t('learning.vocab'), prompt: t('learning.askVocab') },
        { label: t('learning.phrases'), prompt: t('learning.askPhrases') },
        { label: t('learning.grammar'), prompt: t('learning.askGrammar') },
    ]), [t]);

    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-background">
            {/* 顶部只留非交互的标题标签：最上方 40px 是窗口拖拽安全区，不能放可点元素。
                Mac 下标题栏左侧是红绿灯，按全局 TitleBarMac 的约定再让出 w-20 空白。 */}
            <header className={cn(
                'flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-5 text-[11px] text-muted-foreground',
                isMac && 'pl-20'
            )}>
                <span className="font-semibold uppercase tracking-wider">{t('learning.title')}</span>
                {!!sentence.position && (
                    <>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="tabular-nums">{sentence.position}</span>
                    </>
                )}
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
                    entriesReady={entriesReady}
                    entriesDisabledHint={entriesDisabledHint}
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    showVocab={hasMessages}
                    vocabWords={vocabWords}
                    className="border-b border-border/60 lg:border-b-0 lg:border-r"
                />
                <ConversationPane
                    messages={messages}
                    isBusy={isBusy}
                    entriesReady={entriesReady}
                    entriesDisabledHint={entriesDisabledHint}
                    input={input}
                    onInputChange={onInputChange}
                    onSubmit={onSubmit}
                    onStop={onStop}
                    onJumpToLine={onJumpToLine}
                    onBackToPlayer={onBackToPlayer}
                    quickPrompts={quickPrompts}
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
                            phraseGroups={phraseGroups}
                            preparing={!sessionReady}
                            onSpeak={onSpeak}
                            resolveWordDetail={resolveWordDetail}
                            pickedForms={pickedForms}
                        />
                    )}
                />
            </div>
        </div>
    );
}

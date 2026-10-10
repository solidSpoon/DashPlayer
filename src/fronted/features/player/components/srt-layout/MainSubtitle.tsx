import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import TranslatableLine from '@/fronted/features/player/components/subtitles/TranslatableLineWrapper';
import NormalLine from './NormalLine';
import useTranslation from '@/fronted/features/player/translationStore';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useFavouriteClip, { mapClipKey } from '@/fronted/features/favourite/favouriteStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import { Bookmark, History, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/fronted/components/ui/popover';
import { Input } from '@/fronted/components/ui/input';
import LearningModeButton, { CAPTION_CAPSULE_CLASS } from './LearningModeButton';
import DubbingRecordButton from '@/fronted/features/player/dubbing/components/DubbingRecordButton';
import DubbingTakesRow from '@/fronted/features/player/dubbing/components/DubbingTakesRow';

export default function MainSubtitle() {
    const logger = getRendererLogger('MainSubtitle');
    const sentence = usePlayerState((s) => s.currentSentence);
    const srtTender = usePlayerState((s) => s.srtTender);
    const adjusted = useMemo(() => (sentence && srtTender ? (srtTender.adjusted(sentence) ?? false) : false), [sentence, srtTender]);

    // 当前句时间戳偏移（秒）：仅在存在调整时计算，用于胶囊控制栏的常显偏移 Badge
    const adjustDiff = useMemo(() => {
        if (!sentence || !srtTender || !adjusted) return null;
        return srtTender.timeDiff(sentence);
    }, [sentence, srtTender, adjusted]);

    // 时间戳调整配置弹层：打开时以当前偏移初始化草稿输入
    const [adjustPopoverOpen, setAdjustPopoverOpen] = useState(false);
    const [adjustDraft, setAdjustDraft] = useState<{ start: string; end: string }>({ start: '0', end: '0' });

    /**
     * Popover 打开状态变化：打开瞬间把当前句的起/终偏移写入草稿。
     */
    const handleAdjustPopoverChange = (open: boolean) => {
        if (open) {
            const diff = srtTender && sentence && adjusted ? srtTender.timeDiff(sentence) : { start: 0, end: 0 };
            setAdjustDraft({ start: diff.start.toFixed(2), end: diff.end.toFixed(2) });
        }
        setAdjustPopoverOpen(open);
    };

    /**
     * 应用草稿中的绝对偏移：与当前偏移求差后走增量调整动作（保留虚拟组归属与重播语义）。
     * 当前偏移从 store 实时读取，避免连续应用起点/终点时用到过期闭包值。
     *
     * @param field 要应用的偏移字段
     * @param raw 输入框原始文本
     */
    const applyAdjustDraft = (field: 'start' | 'end', raw: string) => {
        const next = Number(raw);
        if (!Number.isFinite(next)) return;
        const { srtTender: tender, currentSentence } = usePlayer.getState();
        const current = tender && currentSentence && tender.adjusted(currentSentence)
            ? tender.timeDiff(currentSentence)[field]
            : 0;
        const delta = next - current;
        if (Math.abs(delta) < 0.005) return;
        if (field === 'start') {
            playerActions.adjustCurrentBegin(delta);
        } else {
            playerActions.adjustCurrentEnd(delta);
        }
    };

    const isFavourite = useFavouriteClip(
        (s) => sentence ? (s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false) : false
    );
    const changeCurrentLineClip = useFavouriteClip((s) => s.changeCurrentLineClip);

    const favShortcut = useSetting((s) => s.setting('shortcut.addClip'));
    const adjustBeginMinusShortcut = useSetting((s) => s.setting('shortcut.adjustBeginMinus'));
    const adjustBeginPlusShortcut = useSetting((s) => s.setting('shortcut.adjustBeginPlus'));
    const adjustEndMinusShortcut = useSetting((s) => s.setting('shortcut.adjustEndMinus'));
    const adjustEndPlusShortcut = useSetting((s) => s.setting('shortcut.adjustEndPlus'));
    const clearAdjustShortcut = useSetting((s) => s.setting('shortcut.clearAdjust'));

    const formatShortcut = (k?: string) => (k ? ` (${k})` : '');

    const requestTranslation = useTranslation(state => state.requestTranslation);
    const engine = useTranslation(state => state.engine);
    const openAiMode = useTranslation(state => state.openAiMode);
    const activeFileHash = useTranslation(state => state.activeFileHash);

    // 在组件顶层获取当前句子的翻译
    const translationKey = sentence?.translationKey || '';
    const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';

    useEffect(() => {
        if (sentence && engine !== 'none' && activeFileHash === sentence.fileHash) {
            requestTranslation(sentence.fileHash, sentence.index);
        }
    }, [logger, sentence, engine, openAiMode, activeFileHash, requestTranslation]);

    // 两种不会触发胶囊区 mouseleave 的情况兜底关闭悬停临时循环：当前句清空（切视频，胶囊区随早退分支卸载）、组件卸载（离开播放页）
    useEffect(() => {
        if (!sentence) {
            playerActions.setHoverRepeat(false);
        }
    }, [sentence]);
    useEffect(() => () => { playerActions.setHoverRepeat(false); }, []);

    // 字幕轨道显隐：只在这里订阅展示值，切换入口在视频底部控制条
    const showCn = usePlayerUi((state) => state.showCn);
    const showSourceZh = usePlayerUi((state) => state.showSourceZh);

    const ele = (): ReactElement[] => {
        if (!sentence) {
            return [];
        }

        const lines: ReactElement[] = [];

        // 1. 原文字幕 (最高优先级，不被压缩，保持顶部与呼吸空间)
        if (StrUtil.isNotBlank(sentence.text)) {
            lines.push(
                <div
                    key={`first-${sentence.key}`}
                    className="w-full shrink-0"
                >
                    <TranslatableLine
                        variant="plain"
                        adjusted={adjusted}
                        clearAdjust={() => { void playerActions.clearAdjust(); }}
                        sentence={sentence}
                    />
                </div>
            );
        }

        const hasMultipleZh = (showCn && StrUtil.isNotBlank(newTranslation)) && (showSourceZh && StrUtil.isNotBlank(sentence.textZH));

        // 2. 机器翻译 (次级，空间不足时优先被挤出/裁切)
        if (showCn && StrUtil.isNotBlank(newTranslation)) {
            lines.push(
                <div
                    key={`translation-${sentence.key}`}
                    className="w-full min-h-0"
                >
                    <NormalLine
                        text={newTranslation}
                        order="second"
                        source={hasMultipleZh ? 'ai' : undefined}
                    />
                </div>
            );
        }

        // 3. 字幕自带中文 (次级)
        if (showSourceZh && StrUtil.isNotBlank(sentence.textZH)) {
            lines.push(
                <div
                    key={`sourceZh-${sentence.key}`}
                    className="w-full min-h-0"
                >
                    <NormalLine
                        text={sentence.textZH!}
                        order={lines.length === 1 ? 'second' : 'third'}
                        source={hasMultipleZh ? 'source' : undefined}
                    />
                </div>
            );
        }

        return lines;
    };

    const render = () => {
        if (!sentence) {
            return <div className="w-full h-full" />;
        }
        return (
            <div
                className="relative flex flex-col w-full h-full items-center px-12 pt-3 pb-2 text-center text-textColor select-none overflow-hidden"
            >
                {/* 顶部弹性占位：比底部占位少，让文字动态停留在“中上”黄金位置（约 40% 高度） */}
                <div className="w-full flex-[2] min-h-0 pointer-events-none" />

                {/* 字幕内容区：永远受到外层 pt-3 顶距保护，绝不削顶。
                    各字幕行会被逐行量测，只有真会被右下角浮层压住的行才在 wrapper 上加右侧内缩，
                    让那一行单独重新折行；其余行保持满宽居中 */}
                <div className="flex flex-col justify-start items-center gap-1.5 w-full min-w-0 shrink-0">
                    {ele()}
                </div>

                {/* 底部弹性占位：比顶部占位更多 */}
                <div className="w-full flex-[3] min-h-0 pointer-events-none" />

                {/* 右下角悬浮控制栏：绝对定位、完全不占排版空间（浮层上方空白不被浪费）。
                    只承载绑定当前句的操作（配音/收藏/微调/整句学习）；
                    鼠标悬停胶囊期间临时切换为当前句循环，离开即还原。
                    全局控制（上一句/下一句/播放/训练模式/字幕轨道）在视频底部控制条里，不在这里 */}
                <div
                    className="absolute right-3 bottom-2 z-20 pointer-events-auto flex flex-col items-end gap-1"
                >
                    {/* 当前句多遍录音横排：叠在胶囊上方一行，点击卡片切换生效遍 */}
                    <DubbingTakesRow />

                    {/* 当前句操作胶囊：配音/收藏/微调/整句学习；悬停期间临时单句循环 */}
                    <div
                        className={CAPTION_CAPSULE_CLASS}
                        onMouseEnter={() => playerActions.setHoverRepeat(true)}
                        onMouseLeave={() => playerActions.setHoverRepeat(false)}
                    >
                        <TooltipProvider delayDuration={300}>
                            {/* 自配音：录制当前句；已配音句子在胶囊上方展示多遍横排 */}
                            <DubbingRecordButton />

                            {/* 收藏当前句 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => { void changeCurrentLineClip(); }}
                                        className={`p-1 rounded-full transition-colors ${
                                            isFavourite
                                                ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60'
                                                : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                                        }`}
                                    >
                                        <Bookmark className={`w-3.5 h-3.5 ${isFavourite ? 'fill-current' : ''}`} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">收藏当前句{formatShortcut(favShortcut)}</TooltipContent>
                            </Tooltip>

                            {/* 时间戳调整与重置（合并为一个触发器）：未调整时仅展示轻量图标，调整后展示高亮偏移 Badge */}
                            <Popover open={adjustPopoverOpen} onOpenChange={handleAdjustPopoverChange}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <PopoverTrigger asChild>
                                            <button
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all text-[10px] font-medium leading-none ${
                                                    adjusted
                                                        ? 'text-amber-700 dark:text-amber-300 bg-amber-200/70 dark:bg-amber-900/60 shadow-xs ring-1 ring-amber-500/30'
                                                        : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                                                }`}
                                            >
                                                <History className="w-3.5 h-3.5 stroke-[2]" />
                                                {adjusted && (
                                                    <span className="font-mono text-[10px] font-semibold leading-none tabular-nums">
                                                        {`${adjustDiff && adjustDiff.start >= 0 ? '+' : ''}${(adjustDiff?.start ?? 0).toFixed(2)}/${adjustDiff && adjustDiff.end >= 0 ? '+' : ''}${(adjustDiff?.end ?? 0).toFixed(2)}s`}
                                                    </span>
                                                )}
                                            </button>
                                        </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {adjusted
                                            ? `字幕微调已生效 (${(adjustDiff?.start ?? 0) >= 0 ? '+' : ''}${(adjustDiff?.start ?? 0).toFixed(2)}s / ${(adjustDiff?.end ?? 0) >= 0 ? '+' : ''}${(adjustDiff?.end ?? 0).toFixed(2)}s)`
                                            : '调整当前句字幕时间轴'}
                                    </TooltipContent>
                                </Tooltip>
                                <PopoverContent side="top" align="end" className="w-72 p-3.5 gap-3 shadow-xl border-border/80 bg-popover/95 backdrop-blur-md">
                                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                            <History className="w-3.5 h-3.5 text-amber-500" />
                                            <span>字幕时间微调</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (adjusted) {
                                                    void playerActions.clearAdjust();
                                                    setAdjustDraft({ start: '0.00', end: '0.00' });
                                                }
                                            }}
                                            disabled={!adjusted}
                                            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                                                adjusted
                                                    ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 font-medium cursor-pointer'
                                                    : 'text-muted-foreground/40 cursor-default'
                                            }`}
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            <span>重置</span>
                                        </button>
                                    </div>

                                    {/* 句首时间调整 */}
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground font-medium">句首 (开始)</span>
                                            <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                                                {`${(adjustDiff?.start ?? 0) >= 0 ? '+' : ''}${(adjustDiff?.start ?? 0).toFixed(2)}s`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => playerActions.adjustCurrentBegin(-0.2)}
                                                className="flex-1 h-7 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-[11px] font-mono font-medium text-foreground transition-colors flex items-center justify-center active:scale-95"
                                            >
                                                -0.2s
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => playerActions.adjustCurrentBegin(0.2)}
                                                className="flex-1 h-7 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-[11px] font-mono font-medium text-foreground transition-colors flex items-center justify-center active:scale-95"
                                            >
                                                +0.2s
                                            </button>
                                            <div className="flex items-center gap-1 w-20 shrink-0">
                                                <Input
                                                    type="number"
                                                    step={0.05}
                                                    className="h-7 text-[11px] font-mono px-1.5 text-center"
                                                    value={adjustDraft.start}
                                                    onChange={(e) => setAdjustDraft((d) => ({ ...d, start: e.target.value }))}
                                                    onBlur={() => applyAdjustDraft('start', adjustDraft.start)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') applyAdjustDraft('start', adjustDraft.start); }}
                                                />
                                                <span className="text-[10px] text-muted-foreground">s</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 句尾时间调整 */}
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground font-medium">句尾 (结束)</span>
                                            <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                                                {`${(adjustDiff?.end ?? 0) >= 0 ? '+' : ''}${(adjustDiff?.end ?? 0).toFixed(2)}s`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => playerActions.adjustCurrentEnd(-0.2)}
                                                className="flex-1 h-7 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-[11px] font-mono font-medium text-foreground transition-colors flex items-center justify-center active:scale-95"
                                            >
                                                -0.2s
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => playerActions.adjustCurrentEnd(0.2)}
                                                className="flex-1 h-7 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-[11px] font-mono font-medium text-foreground transition-colors flex items-center justify-center active:scale-95"
                                            >
                                                +0.2s
                                            </button>
                                            <div className="flex items-center gap-1 w-20 shrink-0">
                                                <Input
                                                    type="number"
                                                    step={0.05}
                                                    className="h-7 text-[11px] font-mono px-1.5 text-center"
                                                    value={adjustDraft.end}
                                                    onChange={(e) => setAdjustDraft((d) => ({ ...d, end: e.target.value }))}
                                                    onBlur={() => applyAdjustDraft('end', adjustDraft.end)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') applyAdjustDraft('end', adjustDraft.end); }}
                                                />
                                                <span className="text-[10px] text-muted-foreground">s</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 快捷键指引 */}
                                    <div className="border-t border-border/50 pt-2 text-[10px] text-muted-foreground/80 flex flex-col gap-1 leading-normal">
                                        <div className="flex items-center justify-between">
                                            <span>句首提前/延后:</span>
                                            <span className="font-mono text-[10px] text-foreground/80">
                                                {adjustBeginMinusShortcut || '['} / {adjustBeginPlusShortcut || ']'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>句尾提前/延后:</span>
                                            <span className="font-mono text-[10px] text-foreground/80">
                                                {adjustEndMinusShortcut || '{'} / {adjustEndPlusShortcut || '}'}
                                            </span>
                                        </div>
                                        {clearAdjustShortcut && (
                                            <div className="flex items-center justify-between">
                                                <span>重置本句微调:</span>
                                                <span className="font-mono text-[10px] text-foreground/80">{clearAdjustShortcut}</span>
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* 整句学习开关：挂在胶囊最右侧，与学习界面右下角那颗是同一颗，位置不随视图变化 */}
                            <LearningModeButton />
                        </TooltipProvider>
                    </div>
                </div>
            </div>
        );
    };

    return render();
}

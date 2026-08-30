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
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Repeat1,
    Bookmark,
    CirclePause,
    Languages,
    History,
    Dumbbell,
    Sparkles,
    Mic,
    FastForward,
    RotateCcw,
    Gauge,
    Repeat,
    Settings2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/fronted/components/ui/popover';
import { Input } from '@/fronted/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/fronted/components/ui/dropdown-menu';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTrainingModeStore } from '@/fronted/features/player/trainingStore';
import { TrainingSettingsDialog } from '@/fronted/features/player/components/TrainingSettingsDialog';

export default function MainSubtitle() {
    const logger = getRendererLogger('MainSubtitle');
    const { t } = useI18nTranslation('player');
    const sentence = usePlayerState((s) => s.currentSentence);
    const playing = usePlayerState((s) => s.playing);
    const playbackRate = usePlayerState((s) => s.playbackRate);
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

    const singleRepeat = usePlayer((s) => s.singleRepeat);
    const setSingleRepeat = usePlayer((s) => s.setSingleRepeat);
    const autoPause = usePlayer((s) => s.autoPause);
    const setAutoPause = usePlayer((s) => s.setAutoPause);

    // 训练模式（组合播放计划）
    const skipGap = usePlayer((s) => s.skipGap);
    const setSkipGap = usePlayer((s) => s.setSkipGap);
    const shadowing = usePlayer((s) => s.shadowing);
    const setShadowing = usePlayer((s) => s.setShadowing);
    const shadowingPause = usePlayer((s) => s.shadowingPause);
    const rewindOnResume = usePlayer((s) => s.rewindOnResume);
    const setRewindOnResume = usePlayer((s) => s.setRewindOnResume);
    const sentenceLoop = usePlayer((s) => s.sentenceLoop);
    const activePlan = usePlayer((s) => s.activePlan);
    // 训练模式持久化配置
    const trainingConfig = useTrainingModeStore((s) => s.config);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // 两种逐句循环配置互斥：×N 模式不带倍速表，精听模式带倍速表
    const loopTimesActive = sentenceLoop !== null && !sentenceLoop.rates;
    const loopRatesActive = sentenceLoop !== null && !!sentenceLoop.rates;
    const trainingActive = sentenceLoop !== null || skipGap || shadowing || rewindOnResume;

    // 影子跟读句末留白暂停的倒计时由 ShadowCountdown 子组件独立承担，避免高频刷新扩散到整个控制条

    const isFavourite = useFavouriteClip(
        (s) => sentence ? (s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false) : false
    );
    const changeCurrentLineClip = useFavouriteClip((s) => s.changeCurrentLineClip);

    const prevShortcut = useSetting((s) => s.setting('shortcut.previousSentence'));
    const nextShortcut = useSetting((s) => s.setting('shortcut.nextSentence'));
    const playPauseShortcut = useSetting((s) => s.setting('shortcut.playPause'));
    const repeatShortcut = useSetting((s) => s.setting('shortcut.repeatSingleSentence'));
    const autoPauseShortcut = useSetting((s) => s.setting('shortcut.autoPause'));
    const favShortcut = useSetting((s) => s.setting('shortcut.addClip'));

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

    const showEn = usePlayerUi((state) => state.showEn);
    const showCn = usePlayerUi((state) => state.showCn);
    const showSourceZh = usePlayerUi((state) => state.showSourceZh);
    const changeShowEn = usePlayerUi((state) => state.changeShowEn);
    const changeShowCn = usePlayerUi((state) => state.changeShowCn);
    const changeShowSourceZh = usePlayerUi((state) => state.changeShowSourceZh);

    const hasAnyTrack = showEn || showCn || showSourceZh;

    const ele = (): ReactElement[] => {
        if (!sentence) {
            return [];
        }

        const lines: ReactElement[] = [];

        // 1. 原文字幕 (最高优先级，不被压缩，保持顶部与呼吸空间)
        if (StrUtil.isNotBlank(sentence.text)) {
            lines.push(
                <div key={`first-${sentence.key}`} className="w-full shrink-0">
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
                <div key={`translation-${sentence.key}`} className="w-full min-h-0">
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
                <div key={`sourceZh-${sentence.key}`} className="w-full min-h-0">
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

                {/* 字幕内容区：永远受到外层 pt-3 顶距保护，绝不削顶 */}
                <div className="flex flex-col justify-start items-center gap-1.5 w-full min-w-0 shrink-0">
                    {ele()}
                </div>

                {/* 底部弹性占位：比顶部占位更多 */}
                <div className="w-full flex-[3] min-h-0 pointer-events-none" />

                {/* 右下角横向悬浮胶囊控制栏：与下方译文行同层右靠，完全不占垂直空间 */}
                <div className="absolute right-3 bottom-2 z-20 pointer-events-auto">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-300/60 dark:bg-neutral-700/60 border border-black/5 dark:border-white/5 backdrop-blur-sm shadow-xs">
                        <TooltipProvider delayDuration={300}>
                            {/* 上一句 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => { void playerActions.prevSentence(); }}
                                        className="p-1 rounded-full text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60 transition-colors"
                                    >
                                        <SkipBack className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">上一句{formatShortcut(prevShortcut)}</TooltipContent>
                            </Tooltip>

                            {/* 播放/暂停 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            if (playing) {
                                                void playerActions.pause();
                                            } else {
                                                void playerActions.play();
                                            }
                                        }}
                                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-stone-900/10 text-stone-700 dark:bg-white/15 dark:text-neutral-200 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white active:scale-95 transition-all shadow-xs"
                                    >
                                        {playing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">{playing ? `暂停${formatShortcut(playPauseShortcut)}` : `播放${formatShortcut(playPauseShortcut)}`}</TooltipContent>
                            </Tooltip>

                            {/* 下一句 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => { void playerActions.nextSentence(); }}
                                        className="p-1 rounded-full text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60 transition-colors"
                                    >
                                        <SkipForward className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">下一句{formatShortcut(nextShortcut)}</TooltipContent>
                            </Tooltip>

                            <div className="h-3 w-px bg-stone-400/30 dark:bg-neutral-600 mx-0.5" />

                            {/* 训练模式（复合按钮：左边展示当前激活的训练模式图标，右边展示实时状态/第N遍/当前倍速 Badge） */}
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all text-[11px] font-medium leading-none ${
                                                    trainingActive
                                                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200/70 dark:bg-emerald-900/60 shadow-xs ring-1 ring-emerald-500/30'
                                                        : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                                                }`}
                                            >
                                                {/* 复合模式主图标 */}
                                                {singleRepeat ? (
                                                    <Repeat1 className="w-3.5 h-3.5 text-red-600 dark:text-red-400 stroke-[2.2]" />
                                                ) : autoPause ? (
                                                    <CirclePause className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                                ) : shadowing ? (
                                                    <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                ) : loopTimesActive ? (
                                                    <Repeat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                                ) : loopRatesActive ? (
                                                    <Gauge className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                                ) : (
                                                    <Dumbbell className="w-3.5 h-3.5" />
                                                )}

                                                {/* 复合详细状态 Badge */}
                                                {loopTimesActive && activePlan ? (
                                                    <span className="font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.5 rounded-sm">
                                                        {activePlan.loopDone + 1}/{activePlan.loopTotal}
                                                    </span>
                                                ) : loopRatesActive && activePlan ? (
                                                    <div className="flex items-center gap-0.5">
                                                        <span className="font-mono text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-1 py-0.5 rounded-sm">
                                                            {playbackRate}x
                                                        </span>
                                                        <span className="text-[9px] text-purple-600/70 dark:text-purple-400/70 font-mono">
                                                            ({activePlan.loopDone + 1}/{activePlan.loopTotal})
                                                        </span>
                                                    </div>
                                                ) : shadowing && shadowingPause ? (
                                                    <ShadowCountdown key={shadowingPause.untilTs} untilTs={shadowingPause.untilTs} />
                                                ) : trainingActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                )}
                                            </button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {singleRepeat
                                            ? `训练模式：单句循环${formatShortcut(repeatShortcut)}`
                                            : autoPause
                                            ? `训练模式：句末自动暂停${formatShortcut(autoPauseShortcut)}`
                                            : shadowing
                                            ? `训练模式：影子跟读${shadowingPause ? ' (留白中)' : ''}`
                                            : loopTimesActive
                                            ? `训练模式：每句重复 ×3 (第 ${(activePlan?.loopDone ?? 0) + 1}/${activePlan?.loopTotal ?? 3} 遍)`
                                            : loopRatesActive
                                            ? `训练模式：递进倍速精听 (当前 ${playbackRate}x，第 ${(activePlan?.loopDone ?? 0) + 1}/${activePlan?.loopTotal ?? 3} 遍)`
                                            : trainingActive
                                            ? '训练模式（已启用辅助行为）'
                                            : '训练与精听模式'}
                                    </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent side="top" align="end" className="w-64">
                                    <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                                        精听与训练模式
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {/* 句末行为（引擎层互斥：开启任一自动关闭其他） */}
                                    <DropdownMenuCheckboxItem
                                        checked={singleRepeat}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setSingleRepeat(!singleRepeat)}
                                        className="text-xs cursor-pointer py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Repeat1 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">单句循环</span>
                                                {repeatShortcut && (
                                                    <span className="text-[10px] text-muted-foreground leading-tight">快捷键 {repeatShortcut}</span>
                                                )}
                                            </div>
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={autoPause}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setAutoPause(!autoPause)}
                                        className="text-xs cursor-pointer py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <CirclePause className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">句末自动暂停</span>
                                                {autoPauseShortcut && (
                                                    <span className="text-[10px] text-muted-foreground leading-tight">快捷键 {autoPauseShortcut}</span>
                                                )}
                                            </div>
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={shadowing}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setShadowing(!shadowing)}
                                        className="text-xs cursor-pointer py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Mic className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">影子跟读</span>
                                                <span className="text-[10px] text-muted-foreground leading-tight">
                                                    句末留白 {trainingConfig.shadowingRatio.toFixed(1)}x 时长后自动下一句
                                                </span>
                                            </div>
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={loopTimesActive}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => {
                                            playerActions.setSentenceLoop(loopTimesActive ? null : { times: trainingConfig.repeatTimes });
                                        }}
                                        className="text-xs cursor-pointer py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Repeat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">每句重复 ×{trainingConfig.repeatTimes}</span>
                                                <span className="text-[10px] text-muted-foreground leading-tight">
                                                    每句连续播放 {trainingConfig.repeatTimes} 遍后自动下一句
                                                </span>
                                            </div>
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={loopRatesActive}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => {
                                            playerActions.setSentenceLoop(
                                                loopRatesActive
                                                    ? null
                                                    : { times: trainingConfig.progressiveRates.length, rates: trainingConfig.progressiveRates }
                                            );
                                        }}
                                        className="text-xs cursor-pointer py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Gauge className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">递进倍速精听</span>
                                                <span className="text-[10px] text-muted-foreground leading-tight">
                                                    每句 {trainingConfig.progressiveRates.map((r) => `${r}x`).join(' → ')} 递进
                                                </span>
                                            </div>
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuSeparator />
                                    {/* 辅助播放行为 */}
                                    <DropdownMenuCheckboxItem
                                        checked={skipGap}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setSkipGap(!skipGap)}
                                        className="text-xs cursor-pointer py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FastForward className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">跳过句间空隙</span>
                                                <span className="text-[10px] text-muted-foreground leading-tight">句末立即跳转到下一句开头</span>
                                            </div>
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={rewindOnResume}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setRewindOnResume(!rewindOnResume)}
                                        className="text-xs cursor-pointer py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <RotateCcw className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">暂停后回退句首</span>
                                                <span className="text-[10px] text-muted-foreground leading-tight">继续播放时从当前句开头开始</span>
                                            </div>
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => setSettingsOpen(true)}
                                        className="text-xs cursor-pointer py-1.5 flex items-center justify-between text-muted-foreground hover:text-foreground"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="w-3.5 h-3.5 text-stone-500" />
                                            <span>自定义训练参数...</span>
                                        </div>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

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

                            {/* 时间戳调整配置（常驻）：点击弹层直接编辑当前句起/终偏移 */}
                            <Popover open={adjustPopoverOpen} onOpenChange={handleAdjustPopoverChange}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <PopoverTrigger asChild>
                                            <button
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors ${
                                                    adjusted
                                                        ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/80'
                                                        : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                                                }`}
                                            >
                                                <History className="w-3.5 h-3.5 stroke-[2]" />
                                                <span className="font-mono text-[10px] font-semibold leading-none tabular-nums">
                                                    {`${adjustDiff && adjustDiff.start >= 0 ? '+' : ''}${(adjustDiff?.start ?? 0).toFixed(2)}/${adjustDiff && adjustDiff.end >= 0 ? '+' : ''}${(adjustDiff?.end ?? 0).toFixed(2)}s`}
                                                </span>
                                            </button>
                                        </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">配置当前句时间戳偏移</TooltipContent>
                                </Tooltip>
                                <PopoverContent side="top" align="end" className="w-64 p-3 gap-2">
                                    <div className="text-xs font-semibold text-foreground">当前句时间戳偏移</div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 text-xs text-muted-foreground shrink-0">起点</span>
                                        <Input
                                            type="number"
                                            step={0.05}
                                            className="h-8 flex-1 font-mono text-xs"
                                            value={adjustDraft.start}
                                            onChange={(e) => setAdjustDraft((d) => ({ ...d, start: e.target.value }))}
                                            onBlur={() => applyAdjustDraft('start', adjustDraft.start)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') applyAdjustDraft('start', adjustDraft.start); }}
                                        />
                                        <span className="text-[10px] text-muted-foreground shrink-0">s</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 text-xs text-muted-foreground shrink-0">终点</span>
                                        <Input
                                            type="number"
                                            step={0.05}
                                            className="h-8 flex-1 font-mono text-xs"
                                            value={adjustDraft.end}
                                            onChange={(e) => setAdjustDraft((d) => ({ ...d, end: e.target.value }))}
                                            onBlur={() => applyAdjustDraft('end', adjustDraft.end)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') applyAdjustDraft('end', adjustDraft.end); }}
                                        />
                                        <span className="text-[10px] text-muted-foreground shrink-0">s</span>
                                    </div>
                                    <p className="text-[10px] leading-tight text-muted-foreground">
                                        相对原始字幕的偏移秒数，失焦或回车即生效
                                    </p>
                                </PopoverContent>
                            </Popover>

                            {/* 时间戳重置（常驻）：无调整时禁用 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => { if (adjusted) void playerActions.clearAdjust(); }}
                                        disabled={!adjusted}
                                        className={`p-1 rounded-full transition-colors ${
                                            adjusted
                                                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60'
                                                : 'text-stone-400/60 dark:text-neutral-600 cursor-default'
                                        }`}
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">{adjusted ? '重置当前句时间戳' : '当前句没有时间戳调整'}</TooltipContent>
                            </Tooltip>

                            {/* 字幕轨道开关下拉菜单（直观展示当前是双语/单英文/单中文/全关状态） */}
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all text-[10px] font-medium leading-none ${
                                                    hasAnyTrack
                                                        ? 'text-stone-900 dark:text-neutral-100 bg-stone-300/80 dark:bg-neutral-600 shadow-xs'
                                                        : 'text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-300 hover:bg-stone-300/40 dark:hover:bg-neutral-700/40'
                                                }`}
                                            >
                                                <Languages className="w-3.5 h-3.5" />
                                                {/* 轨道标签 Badge: 双语/英/中/隐藏 */}
                                                {showEn && (showCn || showSourceZh) ? (
                                                    <span className="font-sans text-[10px] font-semibold text-stone-700 dark:text-neutral-200">
                                                        双语
                                                    </span>
                                                ) : showEn ? (
                                                    <span className="font-sans text-[10px] font-semibold text-stone-700 dark:text-neutral-200">
                                                        EN
                                                    </span>
                                                ) : showCn || showSourceZh ? (
                                                    <span className="font-sans text-[10px] font-semibold text-stone-700 dark:text-neutral-200">
                                                        中
                                                    </span>
                                                ) : (
                                                    <span className="font-sans text-[10px] text-stone-400 dark:text-neutral-500">
                                                        无
                                                    </span>
                                                )}
                                            </button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="end">
                                        {`字幕轨道: ${
                                            showEn && (showCn || showSourceZh)
                                                ? '双语显示'
                                                : showEn
                                                ? '仅显示英文'
                                                : showCn || showSourceZh
                                                ? '仅显示中文'
                                                : '已全部隐藏'
                                        }`}
                                    </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent side="top" align="end" className="w-40">
                                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                                        {t('controlBox.subtitleTracks')}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={showEn}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => changeShowEn()}
                                        className="text-xs cursor-pointer"
                                    >
                                        {t('controlBox.showEnglish')}
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={showCn}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => changeShowCn()}
                                        className="text-xs cursor-pointer"
                                    >
                                        {t('controlBox.showChinese')}
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={showSourceZh}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => changeShowSourceZh()}
                                        className="text-xs cursor-pointer"
                                    >
                                        {t('controlBox.showSourceZh')}
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TooltipProvider>
                    </div>
                </div>

                {/* 训练模式参数配置弹窗 */}
                <TrainingSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
            </div>
        );
    };

    return render();
}

/**
 * 影子跟读留白剩余秒数徽章：按 200ms tick 派生渲染剩余时间。
 * 独立成子组件以隔离高频刷新；setState 仅在定时器回调中发生，挂载阶段无同步写状态。
 * @param untilTs 留白结束的时间戳（毫秒）
 */
function ShadowCountdown({ untilTs }: { untilTs: number }) {
    // 初始值在 useState 惰性初始化中派生（父级以 untilTs 作 key，变化即重挂载）；后续由定时器回调刷新
    const [secondsLeft, setSecondsLeft] = useState(() => Math.max(Math.ceil((untilTs - Date.now()) / 1000), 0));
    useEffect(() => {
        const intervalId = setInterval(() => {
            setSecondsLeft(Math.max(Math.ceil((untilTs - Date.now()) / 1000), 0));
        }, 200);
        return () => clearInterval(intervalId);
    }, [untilTs]);
    return (
        <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1 py-0.5 rounded-sm animate-pulse">
            {secondsLeft}s
        </span>
    );
}

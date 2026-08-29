import React, { ReactElement, useEffect, useMemo } from 'react';
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
    Shuffle
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
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

export default function MainSubtitle() {
    const logger = getRendererLogger('MainSubtitle');
    const { t } = useI18nTranslation('player');
    const sentence = usePlayerState((s) => s.currentSentence);
    const playing = usePlayerState((s) => s.playing);
    const srtTender = usePlayerState((s) => s.srtTender);
    const adjusted = useMemo(() => (sentence && srtTender ? (srtTender.adjusted(sentence) ?? false) : false), [sentence, srtTender]);

    const singleRepeat = usePlayer((s) => s.singleRepeat);
    const setSingleRepeat = usePlayer((s) => s.setSingleRepeat);
    const autoPause = usePlayer((s) => s.autoPause);
    const setAutoPause = usePlayer((s) => s.setAutoPause);

    // 训练模式（组合播放计划）
    const skipGap = usePlayer((s) => s.skipGap);
    const setSkipGap = usePlayer((s) => s.setSkipGap);
    const shadowing = usePlayer((s) => s.shadowing);
    const setShadowing = usePlayer((s) => s.setShadowing);
    const rewindOnResume = usePlayer((s) => s.rewindOnResume);
    const setRewindOnResume = usePlayer((s) => s.setRewindOnResume);
    const sentenceLoop = usePlayer((s) => s.sentenceLoop);
    // 两种逐句循环配置互斥：×N 模式不带倍速表，精听模式带倍速表
    const loopTimesActive = sentenceLoop !== null && !sentenceLoop.rates;
    const loopRatesActive = sentenceLoop !== null && !!sentenceLoop.rates;
    const trainingActive = sentenceLoop !== null || skipGap || shadowing || rewindOnResume;

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

    const sentences = usePlayerState((s) => s.sentences);

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
                key={`trans-sub:${sentence?.key}`}
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

                            {/* 单句循环 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setSingleRepeat(!singleRepeat)}
                                        className={`p-1 rounded-full transition-colors ${
                                            singleRepeat
                                                ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60'
                                                : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                                        }`}
                                    >
                                        <Repeat1 className="w-3.5 h-3.5 stroke-[2.2]" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">单句循环{formatShortcut(repeatShortcut)}</TooltipContent>
                            </Tooltip>

                            {/* 自动暂停 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setAutoPause(!autoPause)}
                                        className={`p-1 rounded-full transition-colors ${
                                            autoPause
                                                ? 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/60'
                                                : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                                        }`}
                                    >
                                        <CirclePause className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">句末自动暂停{formatShortcut(autoPauseShortcut)}</TooltipContent>
                            </Tooltip>

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

                            {/* 时间戳重置（有调整时显示） */}
                            {adjusted && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => { void playerActions.clearAdjust(); }}
                                            className="p-1 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
                                        >
                                            <History className="w-3.5 h-3.5 stroke-[2]" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">重置当前句时间戳</TooltipContent>
                                </Tooltip>
                            )}

                            {/* 字幕轨道开关下拉菜单 */}
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className={`p-1 rounded-full transition-colors ${
                                                    hasAnyTrack
                                                        ? 'text-stone-900 dark:text-neutral-100 bg-stone-300/80 dark:bg-neutral-600'
                                                        : 'text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-300 hover:bg-stone-300/40 dark:hover:bg-neutral-700/40'
                                                }`}
                                            >
                                                <Languages className="w-3.5 h-3.5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{t('controlBox.subtitleTracks')}</TooltipContent>
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

                            {/* 训练模式（组合播放计划） */}
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className={`p-1 rounded-full transition-colors ${
                                                    trainingActive
                                                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200/70 dark:bg-emerald-900/60'
                                                        : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                                                }`}
                                            >
                                                <Dumbbell className="w-3.5 h-3.5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">训练模式</TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent side="top" align="end" className="w-60">
                                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                                        训练模式
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {/* 句末行为（引擎层互斥：开启任一自动关闭其他） */}
                                    <DropdownMenuCheckboxItem
                                        checked={singleRepeat}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setSingleRepeat(!singleRepeat)}
                                        className="text-xs cursor-pointer"
                                    >
                                        单句循环
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={autoPause}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setAutoPause(!autoPause)}
                                        className="text-xs cursor-pointer"
                                    >
                                        句末自动暂停
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={shadowing}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setShadowing(!shadowing)}
                                        className="text-xs cursor-pointer"
                                    >
                                        影子跟读（句末留白自动下一句）
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={loopTimesActive}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => { playerActions.setSentenceLoop(loopTimesActive ? null : { times: 3 }); }}
                                        className="text-xs cursor-pointer"
                                    >
                                        每句 ×3 后下一句
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={loopRatesActive}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => { playerActions.setSentenceLoop(loopRatesActive ? null : { times: 3, rates: [0.75, 1, 1.25] }); }}
                                        className="text-xs cursor-pointer"
                                    >
                                        递进倍速精听（0.75→1.0→1.25）
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => { playerActions.randomJump(); }}
                                        className="text-xs cursor-pointer"
                                    >
                                        <Shuffle className="w-3.5 h-3.5" />
                                        随机跳一句
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={skipGap}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setSkipGap(!skipGap)}
                                        className="text-xs cursor-pointer"
                                    >
                                        跳过句间空隙
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={rewindOnResume}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => setRewindOnResume(!rewindOnResume)}
                                        className="text-xs cursor-pointer"
                                    >
                                        暂停后回退句首
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TooltipProvider>
                    </div>
                </div>
            </div>
        );
    };

    return render();
}

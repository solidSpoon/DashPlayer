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
import { 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Repeat1, 
    Bookmark, 
    CirclePause,
    Languages,
    History
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';

export default function MainSubtitle() {
    const logger = getRendererLogger('MainSubtitle');
    const sentence = usePlayerState((s) => s.currentSentence);
    const playing = usePlayerState((s) => s.playing);
    const srtTender = usePlayerState((s) => s.srtTender);
    const adjusted = useMemo(() => (sentence && srtTender ? (srtTender.adjusted(sentence) ?? false) : false), [sentence, srtTender]);

    const singleRepeat = usePlayer((s) => s.singleRepeat);
    const setSingleRepeat = usePlayer((s) => s.setSingleRepeat);
    const autoPause = usePlayer((s) => s.autoPause);
    const setAutoPause = usePlayer((s) => s.setAutoPause);

    const isFavourite = useFavouriteClip(
        (s) => sentence ? (s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false) : false
    );
    const changeCurrentLineClip = useFavouriteClip((s) => s.changeCurrentLineClip);

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

    const showCn = usePlayerUi((state) => state.showCn);
    const showSourceZh = usePlayerUi((state) => state.showSourceZh);
    const changeShowCn = usePlayerUi((state) => state.changeShowCn);

    const ele = (): ReactElement[] => {
        if (!sentence) {
            return [];
        }

        const lines: ReactElement[] = [];

        // 1. 原文字幕
        if (StrUtil.isNotBlank(sentence.text)) {
            lines.push(
                <TranslatableLine
                    variant="plain"
                    adjusted={adjusted}
                    clearAdjust={() => { void playerActions.clearAdjust(); }}
                    key={`first-${sentence.key}`}
                    sentence={sentence}
                />
            );
        }

        // 2. 机器翻译
        if (showCn && StrUtil.isNotBlank(newTranslation)) {
            lines.push(
                <NormalLine
                    key={`translation-${sentence.key}`}
                    text={newTranslation}
                    order="second"
                />
            );
        }

        // 3. 字幕自带中文
        if (showSourceZh && StrUtil.isNotBlank(sentence.textZH)) {
            lines.push(
                <NormalLine
                    key={`sourceZh-${sentence.key}`}
                    text={sentence.textZH!}
                    order={lines.length === 1 ? 'second' : 'third'}
                />
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
                className="relative flex flex-col w-full h-full justify-center items-center px-12 py-2 text-center text-textColor select-none"
            >
                {/* 字幕内容区：独占完全居中的纵向空间 */}
                <div className="flex flex-col justify-center items-center gap-1.5 w-full min-w-0">
                    {ele()}
                </div>

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
                                <TooltipContent side="top">上一句 (A)</TooltipContent>
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
                                        className="p-1 rounded-full bg-stone-900 text-stone-100 dark:bg-neutral-200 dark:text-neutral-900 hover:scale-105 active:scale-95 transition-all shadow-xs"
                                    >
                                        {playing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">{playing ? '暂停 (Space)' : '播放 (Space)'}</TooltipContent>
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
                                <TooltipContent side="top">下一句 (D)</TooltipContent>
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
                                <TooltipContent side="top">单句循环 (R)</TooltipContent>
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
                                <TooltipContent side="top">句末自动暂停 (P)</TooltipContent>
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
                                <TooltipContent side="top">收藏当前句 (S)</TooltipContent>
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

                            {/* 译文开关 */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => changeShowCn()}
                                        className={`p-1 rounded-full transition-colors ${
                                            showCn
                                                ? 'text-stone-900 dark:text-neutral-100 bg-stone-300/80 dark:bg-neutral-600'
                                                : 'text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-300 hover:bg-stone-300/40 dark:hover:bg-neutral-700/40'
                                        }`}
                                    >
                                        <Languages className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">显示/隐藏中文翻译 (T)</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>
        );
    };

    return render();
}

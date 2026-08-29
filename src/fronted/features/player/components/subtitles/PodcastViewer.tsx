import React, { useRef, useLayoutEffect } from 'react';
import { motion, useSpring } from 'framer-motion';
import { cn } from '@/fronted/lib/utils';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { Sentence } from '@/common/types/SentenceC';
import TranslatableLinePodcast from './TranslatableLinePodcast';
import PodcastControlBar from './PodcastControlBar';
import StrUtil from '@/common/utils/str-util';
import FuncUtil from '@/common/utils/func-util';
import useTranslation from '@/fronted/features/player/translationStore';

const PodcastViewer = ({ className }: { className?: string }) => {
    const current: Sentence | null = usePlayer((s) => s.currentSentence);
    const sentences = usePlayer((s) => s.sentences);
    const seekTo = usePlayer((s) => s.seekTo);

    const translationKey = current?.translationKey || '';
    const newTranslation = useTranslation((state) => state.translations.get(translationKey)) || '';

    const showCn = usePlayerUi((s) => s.showCn);
    const showSourceZh = usePlayerUi((s) => s.showSourceZh);
    const srtTender = usePlayer((s) => s.srtTender);
    const clearAdjust = () => { void playerActions.clearAdjust(); };

    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLDivElement>(null);

    // 针对 120Hz / 高刷屏精心调校的工业级物理弹簧（极致跟手、无多余振荡）
    const springY = useSpring(0, {
        stiffness: 340,
        damping: 32,
        mass: 0.6,
        restDelta: 0.2
    });

    const currentIndex = current
        ? sentences.findIndex((x) => x.index === current.index && x.fileHash === current.fileHash)
        : -1;

    // 零延迟测量：将当前焦点句（中英双语完整块）的几何中心精确锁定在有效可用视口的正中心
    useLayoutEffect(() => {
        if (!current || !viewerContainerRef.current || !activeItemRef.current) return;
        const container = viewerContainerRef.current;
        const activeElem = activeItemRef.current;

        // 扣除底部约 70px 控制栏，计算更沉稳舒适的可用视口重心（约 0.53）
        const availableHeight = container.clientHeight - 70;
        const viewportCenter = availableHeight * 0.53;

        const targetY = -(activeElem.offsetTop + activeElem.offsetHeight / 2 - viewportCenter);
        springY.set(targetY);
    }, [current?.key, newTranslation, showCn, showSourceZh]);

    if (!current || !srtTender) {
        return (
            <div
                className={cn(
                    'relative flex h-full w-full items-center justify-center overflow-hidden',
                    'bg-[#f8f9fa] dark:bg-[#121316] transition-colors duration-300',
                    className
                )}
            />
        );
    }

    return (
        <div
            ref={viewerContainerRef}
            className={cn(
                'relative h-full w-full overflow-hidden select-none',
                'bg-[#f8f9fa] dark:bg-[#121316] transition-colors duration-300',
                className
            )}
        >
            {/* 上下方渐变柔化遮罩 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#f8f9fa] via-[#f8f9fa]/85 to-transparent dark:from-[#121316] dark:via-[#121316]/85 z-20" />
            <div className="pointer-events-none absolute inset-x-0 bottom-16 h-36 bg-gradient-to-t from-[#f8f9fa] via-[#f8f9fa]/85 to-transparent dark:from-[#121316] dark:via-[#121316]/85 z-20" />

            {/* 纯净流动的沉浸式字幕流（GPU 硬件合成层 + 0 重排） */}
            <motion.div
                style={{ y: springY }}
                className="absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-6 px-6 md:px-8 pt-[44vh] pb-[60vh] will-change-transform pointer-events-none"
            >
                {sentences.map((sentence, idx) => {
                    const isCurrent = sentence.key === current.key;
                    const dist = Math.abs(idx - currentIndex);

                    // 视口外超远距离的占位优化
                    if (dist > 12) {
                        return <div key={sentence.key} className="w-full h-10" />;
                    }

                    // 电影级景深计算（动态衰减透明度、微量缩放与轻度焦外模糊）
                    const opacity = isCurrent ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.28 : 0.12;
                    const scale = isCurrent ? 1 : dist === 1 ? 0.88 : dist === 2 ? 0.8 : 0.74;
                    const blur = isCurrent ? 0 : dist === 1 ? 0.4 : dist === 2 ? 1.2 : 2.2;

                    return (
                        <div
                            key={sentence.key}
                            ref={isCurrent ? activeItemRef : undefined}
                            onClick={() => {
                                if (typeof sentence.start === 'number') {
                                    seekTo({ time: sentence.start / 1000 });
                                }
                            }}
                            style={{
                                transform: `scale(${scale})`,
                                opacity,
                                filter: blur > 0 ? `blur(${blur}px)` : 'none'
                            }}
                            className={cn(
                                'w-full max-w-3xl px-6 md:px-8 py-2 text-center pointer-events-auto cursor-pointer rounded-2xl origin-center',
                                'transition-[transform,opacity,filter] duration-300 ease-out will-change-transform will-change-[filter]',
                                isCurrent ? 'cursor-default' : 'hover:opacity-80'
                            )}
                        >
                            {/* 统一使用原生大字号基准，纯靠 GPU scale 缩放，0 次 CPU 字体重排 */}
                            <TranslatableLinePodcast
                                className={cn(
                                    'text-3xl md:text-[2.2rem] leading-relaxed tracking-tight transition-colors duration-300',
                                    isCurrent
                                        ? 'font-bold text-zinc-900 dark:text-zinc-50'
                                        : 'font-normal text-zinc-600 dark:text-zinc-400'
                                )}
                                adjusted={isCurrent ? (srtTender.adjusted(current) ?? false) : false}
                                clearAdjust={isCurrent ? clearAdjust : FuncUtil.blank}
                                sentence={sentence}
                            />

                            {/* 仅焦点句展示中文与源译文 */}
                            {isCurrent && showCn && !StrUtil.isBlank(newTranslation) && (
                                <div className="mt-4 text-xl md:text-2xl font-normal text-zinc-600 dark:text-zinc-300 leading-relaxed transition-all">
                                    {newTranslation}
                                </div>
                            )}
                            {isCurrent && showSourceZh && !StrUtil.isBlank(current?.textZH) && (
                                <div className="mt-2 text-lg md:text-xl font-normal text-zinc-500 dark:text-zinc-400 leading-relaxed transition-all">
                                    {current?.textZH}
                                </div>
                            )}
                        </div>
                    );
                })}
            </motion.div>

            <PodcastControlBar className="absolute left-0 bottom-0 z-30" />
        </div>
    );
};

export default PodcastViewer;

PodcastViewer.defaultProps = {
    className: ''
};

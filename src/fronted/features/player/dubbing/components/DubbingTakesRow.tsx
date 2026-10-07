import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Check, Trash2 } from 'lucide-react';

import UrlUtil from '@/common/utils/UrlUtil';
import useFile from '@/fronted/features/file-browser/fileStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { cn } from '@/fronted/lib/utils';
import { useDubbing } from '../dubbingStore';

/** 试听会话状态：试听中的音频元素与试听前的播放状态。 */
interface PreviewSession {
    audio: HTMLAudioElement;
    wasPlayingBefore: boolean;
}

/**
 * 生成与 CSS rounded-full 完全一致的胶囊边框路径（半圆端帽 + 上下直线）。
 *
 * 注意不能用 rect + rx=999：SVG 会把 rx 截成宽度一半，端帽变成椭圆弧，
 * 与卡片真实的半圆端帽轨迹不符。路径从顶部中点起顺时针一圈。
 *
 * @param w 宽（px） @param h 高（px） @param sw 描边宽度，路径向内收缩 sw/2 保证描边完整落在元素内
 */
const stadiumPath = (w: number, h: number, sw: number): string => {
    const inset = sw / 2;
    const r = Math.min(h - sw, w - sw) / 2;
    const cxL = inset + r;
    const cxR = w - inset - r;
    const midY = h / 2;
    return [
        `M ${w / 2} ${inset}`,
        `H ${cxR}`,
        `A ${r} ${r} 0 0 1 ${cxR + r} ${midY}`,
        `A ${r} ${r} 0 0 1 ${cxR} ${h - inset}`,
        `H ${cxL}`,
        `A ${r} ${r} 0 0 1 ${inset} ${midY}`,
        `A ${r} ${r} 0 0 1 ${cxL} ${inset}`,
        'Z'
    ].join(' ');
};

/**
 * 试听倒计时描边：沿卡片自身边框轨迹从满圈退到空圈。
 *
 * 首帧先挂载空 svg 实测卡片尺寸，再用真实尺寸生成半圆端帽路径驱动 dashoffset。
 */
const PreviewRing = ({ progress }: { progress: number }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);

    useLayoutEffect(() => {
        const el = svgRef.current;
        if (el && el.clientWidth > 0) {
            setSize({ w: el.clientWidth, h: el.clientHeight });
        }
    }, []);

    return (
        <svg
            ref={svgRef}
            aria-hidden="true"
            className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible text-sky-500 dark:text-sky-400"
        >
            {size && (
                <path
                    d={stadiumPath(size.w, size.h, 1.5)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={100}
                    strokeDashoffset={(1 - progress) * 100}
                />
            )}
        </svg>
    );
};

/**
 * 当前句多遍录音横排（主字幕区胶囊控制栏上方一行）：
 *
 * 当前句已配音时展示每遍一张小卡片，横向排列；点卡片试听该遍（试听中卡片
 * 外圈显示倒计时圆环，由满变空），点卡片内勾选按钮切换生效遍，行尾提供清除整句。
 */
export default function DubbingTakesRow() {
    const { t } = useTranslation('player');

    const srtHash = useFile((s) => s.srtHash);
    const currentSentence = usePlayerState((s) => s.currentSentence);
    const sentenceIndex = currentSentence?.index ?? null;
    const record = useDubbing((s) => (
        sentenceIndex === null ? null : s.manifest?.sentences[String(sentenceIndex)] ?? null
    ));
    const previewRef = useRef<PreviewSession | null>(null);
    const rafRef = useRef<number | null>(null);
    const [previewingId, setPreviewingId] = useState<string | null>(null);
    // 倒计时圆环剩余比例：试听开始为 1（满），随播放推进递减到 0（空）
    const [previewProgress, setPreviewProgress] = useState(1);

    /** 停止试听并按需恢复视频播放。 */
    const stopPreview = (): void => {
        const session = previewRef.current;
        if (!session) {
            return;
        }
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        session.audio.onended = null;
        session.audio.pause();
        previewRef.current = null;
        setPreviewingId(null);
        if (session.wasPlayingBefore) {
            playerActions.play();
        }
    };

    // 切句或卸载时停止试听并恢复视频播放状态
    useEffect(() => () => stopPreview(), [sentenceIndex]);

    if (!srtHash || !record || record.takes.length === 0) {
        return null;
    }

    const playTake = (takeId: string, filePath?: string): void => {
        if (!filePath) {
            return;
        }
        // 试听前暂停视频避免两路声音叠播；连播多遍只记第一次试听前的状态
        if (previewRef.current) {
            previewRef.current.audio.onended = null;
            previewRef.current.audio.pause();
        }
        const wasPlayingBefore = previewRef.current
            ? previewRef.current.wasPlayingBefore
            : usePlayer.getState().playing;
        playerActions.pause();
        const audio = new Audio(UrlUtil.toUrl(filePath));
        audio.volume = 0.9;
        audio.onended = () => {
            stopPreview();
        };
        previewRef.current = { audio, wasPlayingBefore };
        setPreviewingId(takeId);
        setPreviewProgress(1);
        // rAF 逐帧驱动倒计时圆环，比 timeupdate 事件更平滑；换卡试听先取消旧循环
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
        }
        const tick = (): void => {
            const session = previewRef.current;
            if (!session) {
                rafRef.current = null;
                return;
            }
            setPreviewProgress(
                session.audio.duration > 0
                    ? Math.max(0, 1 - session.audio.currentTime / session.audio.duration)
                    : 1
            );
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        void audio.play();
    };

    const handleSetActive = async (takeId: string): Promise<void> => {
        try {
            await useDubbing.getState().setActiveTake(srtHash, sentenceIndex!, takeId);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('dubbing.updateFailed'));
        }
    };

    const handleDelete = async (takeId: string): Promise<void> => {
        try {
            await useDubbing.getState().deleteTake(srtHash, sentenceIndex!, takeId);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('dubbing.updateFailed'));
        }
    };

    const handleClear = async (): Promise<void> => {
        try {
            await useDubbing.getState().clearSentence(srtHash, sentenceIndex!);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('dubbing.updateFailed'));
        }
    };

    return (
        <div className="flex items-center gap-1 rounded-full bg-stone-100/80 dark:bg-neutral-800/80 px-1.5 py-1 shadow-xs backdrop-blur-sm">
            {record.takes.map((take, position) => {
                const isActive = take.id === record.activeTakeId;
                const isPreviewing = previewingId === take.id;
                return (
                    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
                    <div
                        key={take.id}
                        className={cn(
                            // 四边内边距一致（4px）：卡片高度 24px，半圆端帽圆心恰与 16px 圆形按钮同心
                            'relative group flex items-center gap-2.5 rounded-full p-1 transition-colors cursor-pointer',
                            isActive
                                ? 'bg-sky-200/80 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300'
                                : 'text-stone-600 dark:text-neutral-400 hover:bg-stone-200/70 dark:hover:bg-neutral-700/70'
                        )}
                        onClick={() => playTake(take.id, take.filePath)}
                        title={t('dubbing.takeLabel', { position: position + 1 })}
                    >
                        {/* 试听倒计时：沿卡片边框轨迹的半圆端帽描边，开始满、播完空 */}
                        {isPreviewing && <PreviewRing progress={previewProgress} />}
                        <button
                            type="button"
                            aria-label={t('dubbing.setActiveTake')}
                            title={t('dubbing.setActiveTake')}
                            className={cn(
                                'w-4 h-4 flex items-center justify-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10',
                                isActive
                                    ? 'text-sky-600 dark:text-sky-400'
                                    : 'text-stone-400 dark:text-neutral-500 hover:text-sky-600 dark:hover:text-sky-400'
                            )}
                            onClick={(event) => {
                                event.stopPropagation();
                                void handleSetActive(take.id);
                            }}
                        >
                            <Check className="w-2.5 h-2.5" />
                        </button>
                        <span className="min-w-[16px] text-center text-[10px] font-medium leading-none tabular-nums">
                            {position + 1}
                        </span>
                        <button
                            type="button"
                            aria-label={t('dubbing.deleteTake')}
                            className="w-4 h-4 flex items-center justify-center rounded-full text-stone-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            onClick={(event) => {
                                event.stopPropagation();
                                void handleDelete(take.id);
                            }}
                        >
                            <Trash2 className="w-2.5 h-2.5" />
                        </button>
                    </div>
                );
            })}
            <button
                type="button"
                aria-label={t('dubbing.clearSentence')}
                title={t('dubbing.clearSentence')}
                className="w-4 h-4 flex items-center justify-center rounded-full text-stone-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                onClick={() => void handleClear()}
            >
                <Trash2 className="w-2.5 h-2.5" />
            </button>
        </div>
    );
}

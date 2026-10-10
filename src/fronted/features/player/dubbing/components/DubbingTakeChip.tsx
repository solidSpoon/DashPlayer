import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Loader2, Play, Trash2 } from 'lucide-react';

import UrlUtil from '@/common/utils/UrlUtil';
import useFile from '@/fronted/features/file-browser/fileStore';
import {
    CAPTION_CARD_BUTTON_CLASS,
    CAPTION_CARD_CLASS,
    CAPTION_ICON_SLOT_CLASS,
} from '@/fronted/features/player/components/captionCardShell';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { cn } from '@/fronted/lib/utils';
import { resumePlaybackFromSentenceStart } from '../dubbingPlayback';
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

/** 装饰性迷你波形各竖条的高度（px），只用来表明“这是一段录音”，不反映真实振幅。 */
const WAVE_HEIGHTS = [6, 10, 15, 8, 12, 7, 10];

/**
 * 装饰性迷你波形：静态，不随录音或试听变化。
 */
const Waveform = () => (
    <span aria-hidden="true" className="flex items-center gap-[1.5px] h-4 text-current opacity-60">
        {WAVE_HEIGHTS.map((height, index) => (
            <span key={index} className="w-[1.5px] rounded-full bg-current" style={{ height }} />
        ))}
    </span>
);

/**
 * 录音中/处理中的占位卡片：录音时显示红点与实时秒数，处理时显示转圈。
 *
 * 三格结构与成品卡片一一对应（状态点↔播放键、秒数↔波形、空位↔删除键），
 * 保存完成后由真实录音卡片原样接替，宽度与图标落点都不跳变。
 *
 * @param state 录音中或处理中
 * @param recordingStartTs 本次录音开始时间戳（毫秒），仅录音中用于计时
 */
function PendingCard({ state, recordingStartTs }: {
    state: 'recording' | 'saving';
    recordingStartTs: number | null;
}) {
    const [elapsedSec, setElapsedSec] = useState(0);

    useEffect(() => {
        if (state !== 'recording' || recordingStartTs === null) {
            return;
        }
        setElapsedSec(0);
        const timer = window.setInterval(() => {
            setElapsedSec(Math.floor((Date.now() - recordingStartTs) / 1000));
        }, 200);
        return () => window.clearInterval(timer);
    }, [state, recordingStartTs]);

    return (
        <div
            className={cn(
                CAPTION_CARD_CLASS,
                state === 'recording'
                    ? 'bg-red-100/80 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                    : 'bg-sky-100/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
            )}
        >
            <span className={CAPTION_ICON_SLOT_CLASS}>
                {state === 'recording' ? (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                ) : (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
            </span>
            <span className={cn(CAPTION_ICON_SLOT_CLASS, 'text-xs font-medium leading-none tabular-nums')}>
                {state === 'recording' ? `${elapsedSec}s` : ''}
            </span>
            {/* 空占位：预留成品卡片删除键那一格，两态宽度因此完全一致 */}
            <span className={CAPTION_ICON_SLOT_CLASS} aria-hidden="true" />
        </div>
    );
}

/**
 * 当前句录音卡片（主字幕区胶囊左侧）：
 *
 * 当前句已配音时展示一张卡片，点击试听（试听中卡片外圈显示倒计时圆环，由满变空），
 * 卡片内的删除键清除本句配音。每句只留一份录音，重录即覆盖。
 *
 * 录音中与处理中原地插入一张占位卡片，展示录音秒数或处理状态；保存成功后它被真实
 * 录音卡片接替，所以整个流程该位置只在开始录音时出现一次。
 */
export default function DubbingTakeChip() {
    const { t } = useTranslation('player');

    const srtHash = useFile((s) => s.srtHash);
    const currentSentence = usePlayerState((s) => s.currentSentence);
    const sentenceIndex = currentSentence?.index ?? null;
    const record = useDubbing((s) => (
        sentenceIndex === null ? null : s.manifest?.sentences[String(sentenceIndex)] ?? null
    ));
    const phase = useDubbing((s) => s.phase);
    const recordingStartTs = useDubbing((s) => s.recordingStartTs);
    const targetIndex = useDubbing((s) => s.targetIndex);
    const previewRef = useRef<PreviewSession | null>(null);
    const rafRef = useRef<number | null>(null);
    const [previewing, setPreviewing] = useState(false);
    // 倒计时圆环剩余比例：试听开始为 1（满），随播放推进递减到 0（空）
    const [previewProgress, setPreviewProgress] = useState(1);

    /**
     * 停止试听：释放当前试听音频并取消倒计时动画，不改动视频播放状态。
     *
     * @returns 试听前视频是否在播放；当前没有试听时返回 false
     */
    const stopPreview = (): boolean => {
        const session = previewRef.current;
        if (!session) {
            return false;
        }
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        session.audio.onended = null;
        session.audio.pause();
        previewRef.current = null;
        setPreviewing(false);
        return session.wasPlayingBefore;
    };

    // 切句或卸载时停止试听并恢复原来的播放状态（不回到句首，避免打断用户导航）
    useEffect(() => () => {
        if (stopPreview()) {
            playerActions.play();
        }
    }, [sentenceIndex]);

    const isRecording = phase === 'recording';
    // 处理中卡片也要留着：这期间原地显示处理状态，不消失再出现
    const isSaving = phase === 'saving';
    // 占位卡片属于正在录的那一句；若用户已跳到别的句，就不在别的句上显示它
    const isPending = (isRecording || isSaving) && targetIndex === sentenceIndex;

    if (!srtHash || (!isPending && !record)) {
        return null;
    }

    const playTake = (): void => {
        const filePath = record?.take.filePath;
        if (!filePath) {
            return;
        }
        // 试听前暂停视频避免两路声音叠播；重复点击同一卡片只记第一次试听前的播放状态
        const wasPlayingBefore = previewRef.current?.wasPlayingBefore ?? usePlayer.getState().playing;
        if (previewRef.current) {
            // 仅停止旧试听，不恢复播放（马上要接着播新的）
            stopPreview();
        } else {
            playerActions.pause();
        }
        const audio = new Audio(UrlUtil.toUrl(filePath));
        audio.volume = 0.9;
        audio.onended = () => {
            // 播完用户自己的录音：回到当前句句首再续播，方便紧接着听原声对比
            resumePlaybackFromSentenceStart(stopPreview());
        };
        previewRef.current = { audio, wasPlayingBefore };
        setPreviewing(true);
        setPreviewProgress(1);
        // rAF 逐帧驱动倒计时圆环，比 timeupdate 事件更平滑
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

    const handleDelete = async (): Promise<void> => {
        try {
            await useDubbing.getState().clearSentence(srtHash, sentenceIndex!);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('dubbing.updateFailed'));
        }
    };

    if (isPending) {
        return <PendingCard state={isRecording ? 'recording' : 'saving'} recordingStartTs={recordingStartTs} />;
    }

    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
            aria-label={t('dubbing.preview')}
            title={t('dubbing.preview')}
            className={cn(
                'relative group cursor-pointer transition-colors',
                CAPTION_CARD_CLASS,
                previewing
                    ? 'bg-sky-200/80 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300'
                    : 'text-stone-600 dark:text-neutral-400 hover:bg-stone-300/70 dark:hover:bg-neutral-600/70'
            )}
            onClick={playTake}
        >
            {/* 试听倒计时：沿卡片边框轨迹的半圆端帽描边，开始满、播完空 */}
            {previewing && <PreviewRing progress={previewProgress} />}
            <span className={CAPTION_ICON_SLOT_CLASS}>
                <Play className="w-3.5 h-3.5 fill-current" />
            </span>
            <span className={CAPTION_ICON_SLOT_CLASS}>
                <Waveform />
            </span>
            <button
                type="button"
                aria-label={t('dubbing.clearSentence')}
                title={t('dubbing.clearSentence')}
                className={cn(
                    CAPTION_CARD_BUTTON_CLASS,
                    'text-stone-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-500/10'
                )}
                onClick={(event) => {
                    event.stopPropagation();
                    void handleDelete();
                }}
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

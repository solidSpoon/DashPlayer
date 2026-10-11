import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Loader2, Play, Trash2 } from 'lucide-react';

import useFile from '@/fronted/features/file-browser/fileStore';
import {
    CAPTION_CARD_BUTTON_CLASS,
    CAPTION_CARD_CLASS,
    CAPTION_CARD_WIDTH_ONE_SLOT,
    CAPTION_CARD_WIDTH_THREE_SLOT,
    CAPTION_ICON_SLOT_CLASS,
} from '@/fronted/features/player/components/captionCardShell';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { cn } from '@/fronted/lib/utils';
import { playTake, stopTake, useDubbingTakePlayer } from '../dubbingTakePlayer';
import { useDubbing } from '../dubbingStore';

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

/** 录音流程占位卡片的三个阶段：预备中、录音中、处理中。 */
type PendingState = 'preparing' | 'recording' | 'saving';

/**
 * 占位卡片各阶段的配色：预备=卡片本来的中性灰（还没开始录）、录音=红（已在收音）、处理=天蓝。
 */
const PENDING_STATE_CLASS: Record<PendingState, string> = {
    preparing: 'text-stone-600 dark:text-neutral-400',
    recording: 'bg-red-100/80 dark:bg-red-950/60 text-red-600 dark:text-red-400',
    saving: 'bg-sky-100/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400',
};

/**
 * 录音流程占位卡片（胶囊左侧那一格）：预备中、录音中、处理中三个阶段共用同一张卡片。
 *
 * 入场（预备中）是"小胶囊长成大卡"的形变：长按越过阈值、麦克风开流那一刻卡片从最窄的单格
 * 小胶囊（只剩状态点）起，锚在右端（胶囊侧）向左弹出成三格整卡；形状先到、内容跟上，状态点
 * 随后淡入。形变时长刻意对齐预备窗（PREPARE_MS≈300ms），长完正赶上开录。
 * 本色是卡片本来的中性灰，只有真正开始收音（就绪）才转红。
 *
 * 本句已经录过音时不再重长：此时成品卡片正占着这一格，占位卡片直接以同样的整卡宽度接替，
 * 只换底色与格内内容，避免"卡片重新弹出并由窄变宽"的突兀。就绪与处理只换配色与格内内容：
 * 就绪（开始收音）=整卡转红、中格秒数淡入并开始跳；处理=第一格换成转圈。尾部空位与成品录音
 * 卡片的删除键对齐，保存完成后由真实录音卡片原样接替，宽度与图标落点不跳。
 *
 * @param state 预备中/录音中/处理中
 * @param recordingStartTs 本次录音开始时间戳（毫秒），仅录音中用于计时
 * @param hasTake 本次录音前这一句是否已有录音（已有则本卡直接整卡宽入场，不再由窄变宽）
 */
function PendingCard({ state, recordingStartTs, hasTake }: {
    state: PendingState;
    recordingStartTs: number | null;
    hasTake: boolean;
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
        <motion.div
            // 只在首次挂载时从单格小胶囊弹开到三格整卡：右端为锚点，视觉上像胶囊自己长出一段，
            // 而不是凭空插进来一张卡。弹簧与预备窗同量级，落定时正好开录；后续阶段改动画目标
            // 值不变，因此不会再重播。已有录音时起点就是整卡宽（接替那张成品卡），不做形变。
            initial={{ width: hasTake ? CAPTION_CARD_WIDTH_THREE_SLOT : CAPTION_CARD_WIDTH_ONE_SLOT }}
            animate={{ width: CAPTION_CARD_WIDTH_THREE_SLOT }}
            transition={{ type: 'spring', stiffness: 360, damping: 26, mass: 0.7 }}
            // 形变期间多出来的两格先裁掉，避免内容被挤变形
            className={cn(CAPTION_CARD_CLASS, 'overflow-hidden origin-right', PENDING_STATE_CLASS[state])}
        >
            {/* 状态点（处理中换成转圈）：形状先到、内容跟上，所以稍晚一点淡入；接替成品卡时不淡入 */}
            <motion.span
                className={CAPTION_ICON_SLOT_CLASS}
                initial={hasTake ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.24, delay: 0.06, ease: 'easeOut' }}
            >
                {state === 'saving' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                )}
            </motion.span>
            {/* 秒数：就绪那一刻淡入，而不是被宽度带着滑出来；非录音态留透明占位不占位跳动 */}
            <motion.span
                className={cn(CAPTION_ICON_SLOT_CLASS, 'text-xs font-medium leading-none tabular-nums')}
                animate={{ opacity: state === 'recording' ? 1 : 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
            >
                {elapsedSec}s
            </motion.span>
            {/* 空占位：预留成品卡片删除键那一格，三态宽度与成品卡片完全一致 */}
            <span className={CAPTION_ICON_SLOT_CLASS} aria-hidden="true" />
        </motion.div>
    );
}

/**
 * 当前句录音卡片（主字幕区胶囊左侧）：
 *
 * 当前句已配音时展示一张卡片，点击试听（试听中卡片外圈显示倒计时圆环，由满变空），
 * 卡片内的删除键清除本句配音。每句只留一份录音，重录即覆盖；短按录音键等价于点这张卡。
 *
 * 录音中与处理中原地插入一张占位卡片，展示录音秒数或处理状态；保存成功后它被真实
 * 录音卡片接替，所以整个流程该位置只在开始录音时出现一次。
 *
 * 预备中（长按越阈、麦克风已开流但还没开始收音）也占这一格：卡片在开流那一刻从单格小胶囊
 * "长"成三格整卡（形变铺满预备窗、锚在右端像从胶囊里长出来），之后就绪只换配色与格内内容。
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
    // 试听态与倒计时进度由共享播放器持有（点击本卡、短按录音键、录完自动回放都写它）
    const playingIndex = useDubbingTakePlayer((s) => s.playingIndex);
    const previewProgress = useDubbingTakePlayer((s) => s.progress);

    // 切句或卸载时停止试听并恢复原来的播放状态（不回到句首，避免打断用户导航）
    useEffect(() => () => {
        if (stopTake()) {
            playerActions.play();
        }
    }, [sentenceIndex]);

    const isPreparing = phase === 'preparing';
    const isRecording = phase === 'recording';
    // 处理中卡片也要留着：这期间原地显示处理状态，不消失再出现
    const isSaving = phase === 'saving';
    // 占位卡片属于正在处理的那一句；若用户已跳到别的句，就不在别的句上显示它
    const isPending = (isPreparing || isRecording || isSaving) && targetIndex === sentenceIndex;

    if (!srtHash || (!isPending && !record)) {
        return null;
    }

    const previewing = playingIndex === sentenceIndex;

    const handlePreview = (): void => {
        const filePath = record?.take.filePath;
        if (!filePath || sentenceIndex === null) {
            return;
        }
        playTake(sentenceIndex, filePath);
    };

    const handleDelete = async (): Promise<void> => {
        try {
            await useDubbing.getState().clearSentence(srtHash, sentenceIndex!);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('dubbing.updateFailed'));
        }
    };

    if (isPending) {
        const pendingState: PendingState = isPreparing ? 'preparing' : isRecording ? 'recording' : 'saving';
        return (
            <PendingCard
                state={pendingState}
                recordingStartTs={recordingStartTs}
                hasTake={record !== null}
            />
        );
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
            onClick={handlePreview}
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

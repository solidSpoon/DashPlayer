import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import useChatPanel from '@/fronted/features/chat/chatStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { dubbingApi } from './dubbingApi';
import { dubbingControls, registerDubbingControls } from './dubbingControls';
import { playTake, stopTake, stopTakeAndResume, useDubbingTakePlayer } from './dubbingTakePlayer';
import { useDubbing } from './dubbingStore';

const logger = getRendererLogger('useDubbingRecorder');

/**
 * 长按判定阈值（毫秒）：按住超过该时长才算“要录音”，此刻才开麦、卡片才出现；
 * 没到阈值就松手视为短按，只试听本句已有录音。
 */
const HOLD_THRESHOLD_MS = 400;

/**
 * 录音超长提醒阈值：录音时长超过句长的该倍数时提示变速倍率。
 */
const TOO_LONG_RATIO = 1.5;

/**
 * 开录前的预备时长（毫秒）：麦克风开流瞬间 macOS 会发一记系统咔哒（扬声器里
 * 那声"卡"就是它，麦克风也会收到），这窗口让咔哒过去后再开始收音；界面同期
 * 展示预备动效，提示用户稍候再开口。
 */
const PREPARE_MS = 300;

/**
 * 快捷键配置里的键名 → 键盘事件 key（小写）。
 * 录制器用原生 keydown/keyup 实现长按，需要自己归一化；未列出的键名（字母、数字）直接小写比较。
 */
const KEY_NAME_TO_EVENT_KEY: Record<string, string> = {
    slash: '/',
    space: ' ',
};

/**
 * 判定键盘事件是否命中配置的录音快捷键。
 *
 * 配置格式与其它快捷键一致：逗号分隔多组，组内加号组合修饰键（如 `q,ctrl+k`）。
 * 单字符键要求 shift 态精确匹配（`q` 与 `shift+q` 是两个不同组合）；符号类键的
 * shift 形态字符本就不相等，天然区分。
 */
function matchesRecordShortcut(event: KeyboardEvent, config: string): boolean {
    for (const combo of config.split(',')) {
        const parts = combo.trim().split('+').filter(Boolean);
        if (parts.length === 0) {
            continue;
        }
        const mainKey = KEY_NAME_TO_EVENT_KEY[parts[parts.length - 1].toLowerCase()] ?? parts[parts.length - 1].toLowerCase();
        const needCtrl = parts.includes('ctrl') || parts.includes('control');
        const needMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');
        const needAlt = parts.includes('alt') || parts.includes('option');
        const needShift = parts.includes('shift');
        if (event.ctrlKey !== needCtrl || event.metaKey !== needMeta || event.altKey !== needAlt) {
            continue;
        }
        if (event.key.toLowerCase() !== mainKey) {
            continue;
        }
        if (mainKey.length === 1 && event.shiftKey !== needShift) {
            continue;
        }
        return true;
    }
    return false;
}

/**
 * 判定 keyup 事件是否为录音快捷键主键的松开（修饰键可能仍被按住）。
 */
function releasesRecordShortcut(event: KeyboardEvent, config: string): boolean {
    for (const combo of config.split(',')) {
        const parts = combo.trim().split('+').filter(Boolean);
        if (parts.length === 0) {
            continue;
        }
        const mainKey = KEY_NAME_TO_EVENT_KEY[parts[parts.length - 1].toLowerCase()] ?? parts[parts.length - 1].toLowerCase();
        if (event.key.toLowerCase() === mainKey) {
            return true;
        }
    }
    return false;
}

function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return !!element
        && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
}

/**
 * 长按判定计时器：按下时挂上，越过阈值即视为长按并开录。
 * 属于“当前这一按”的输入态，随监听卸载归零。
 */
let holdTimer: number | null = null;

/** 本次按下是否已越过长按阈值（长按成立、录音流程已启动）。 */
let holdActivated = false;

/**
 * 长按成立后、还没真正开始收音就松手：作废本次录音。
 * 授权、开流、预备窗口都是异步的，松手可能落在其中任意一段，靠这个标记让流程自行退出。
 */
let abortPending = false;

/** 键盘监听当前的挂载数：只有第一份挂载安装监听、最后一份卸载移除。 */
let keyboardMountCount = 0;

/**
 * 录音快捷键按下：Esc 取消录音/跳过试听；录音键只启动长按判定，不直接开录。
 *
 * 处理器是模块级纯路由（只依赖 store 与全局控制通道，不携带 hook 实例状态），
 * 因此即便 hook 实例更替，监听与行为始终指向最新注册的动作。
 */
function onRecordKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        const { phase } = useDubbing.getState();
        if (phase === 'recording') {
            event.preventDefault();
            dubbingControls.cancel();
        } else if (useDubbingTakePlayer.getState().playingIndex !== null) {
            // 试听/回放中按 Esc：跳过试听
            event.preventDefault();
            stopTakeAndResume();
        }
        return;
    }
    if (event.repeat || isTypingTarget(event.target)) {
        return;
    }
    const config = useSetting.getState().setting('shortcut.dubbingRecord');
    if (!matchesRecordShortcut(event, config)) {
        return;
    }
    event.preventDefault();
    dubbingControls.pressStart();
}

/**
 * 录音快捷键松开：长按成立的这一路结束（停录保存），短按则试听已有录音。
 */
function onRecordKeyUp(event: KeyboardEvent): void {
    const config = useSetting.getState().setting('shortcut.dubbingRecord');
    if (!releasesRecordShortcut(event, config)) {
        return;
    }
    dubbingControls.pressEnd();
}

function pickMimeType(): string | undefined {
    if (typeof MediaRecorder === 'undefined') {
        return undefined;
    }
    for (const mimeType of ['audio/webm;codecs=opus', 'audio/webm']) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return mimeType;
        }
    }
    return undefined;
}

/** 录音流程对外控制接口；控制条按钮通过 dubbingControls 全局通道触发相同动作。 */
export interface DubbingRecorderControls {
    /** 按下录音键：开始长按判定，此时不开麦、界面不动 */
    pressStart: () => void;
    /** 松开录音键：长按成立则停止录音并保存，否则按短按处理 */
    pressEnd: () => void;
    /** 取消当前录音（不保存） */
    cancel: () => void;
}

/**
 * 配音录音交互。
 *
 * 触发方式（快捷键与控制条按钮共用同一套流程）：
 * - 录音快捷键（默认 Q，可在设置中改绑）：按住超过阈值才开始录音（先开麦、过一个预备窗口再收音），
 *   松手即停并自动保存；短按则试听本句已有录音（没录过无动作）；Esc 取消录音、跳过试听；
 * - 控制条录制按钮：按下/松开等效于快捷键的按下/松开。
 *
 * 录完自动回放一遍，回放结束恢复原来的播放状态。保存成功后清单从后端重取
 * （后端是唯一真相源），不在前端拼装本地清单。
 */
export function useDubbingRecorder(): DubbingRecorderControls {
    const { t } = useTranslation('player');

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const wasPlayingBeforeRef = useRef(false);
    const cancelRequestedRef = useRef(false);

    const releaseStream = (): void => {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
    };

    /**
     * 录音还没开始收音就作废：清掉作废标记、关掉可能已经打开的麦克风、回到空闲。
     *
     * @returns 本次是否被作废
     */
    const abortPendingRecording = (): boolean => {
        if (!abortPending) {
            return false;
        }
        abortPending = false;
        releaseStream();
        useDubbing.getState().setIdle();
        return true;
    };

    /**
     * 录音流程收尾：回到空闲，并按录音前的播放状态决定是否续播。
     */
    const finishFlow = (): void => {
        useDubbing.getState().setIdle();
        const resumePlay = wasPlayingBeforeRef.current;
        wasPlayingBeforeRef.current = false;
        if (resumePlay) {
            playerActions.play();
        }
    };

    const handleRecordingDone = async (sentenceIndex: number, sentenceDuration: number): Promise<void> => {
        const recorder = mediaRecorderRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' });
        mediaRecorderRef.current = null;
        chunksRef.current = [];

        if (cancelRequestedRef.current || blob.size === 0) {
            if (!cancelRequestedRef.current) {
                toast.error(t('dubbing.emptyRecording'));
            }
            finishFlow();
            return;
        }

        useDubbing.getState().setSaving();
        try {
            const buffer = await blob.arrayBuffer();
            const { videoPath, subtitlePath, srtHash } = useFile.getState();
            const take = await dubbingApi.saveTake({
                videoKey: srtHash!,
                sentenceIndex,
                audio: new Uint8Array(buffer),
                videoPath: videoPath!,
                subtitlePath,
            });
            // 后端刚把这遍录音写进清单，重取即得全量真相；前端不自行拼装清单
            await useDubbing.getState().loadManifest(srtHash!);

            const ratio = take.durationSec / sentenceDuration;
            if (ratio > TOO_LONG_RATIO) {
                toast(t('dubbing.tooLong', { factor: ratio.toFixed(1) }), { icon: '⚠️' });
            }

            // 录完立刻回放一遍，播完回到句首续播，方便紧接着听原声对比
            useDubbing.getState().setIdle();
            playTake(sentenceIndex, take.filePath, wasPlayingBeforeRef.current);
            wasPlayingBeforeRef.current = false;
        } catch (error) {
            logger.error('保存配音录音失败', { error });
            toast.error(error instanceof Error ? error.message : t('dubbing.saveFailed'));
            finishFlow();
        }
    };

    const startRecording = async (): Promise<void> => {
        const { phase } = useDubbing.getState();
        if (phase === 'preparing' || phase === 'recording' || phase === 'saving') {
            return;
        }
        if (useChatPanel.getState().learningVisible) {
            return;
        }
        abortPending = false;
        // 试听/回放中开录：先掐掉在播的一路，并沿用它记录的“试听前是否在播放”，
        // 避免被试听期间的暂停覆盖，导致连录结束后不再续播
        const takeWasPlaying = stopTake();

        const srtHash = useFile.getState().srtHash;
        if (!srtHash) {
            toast.error(t('dubbing.noSubtitle'));
            return;
        }
        const { currentSentence, srtTender } = usePlayer.getState();
        if (!currentSentence || !srtTender) {
            toast.error(t('dubbing.noSentence'));
            return;
        }
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            toast.error(t('dubbing.micUnsupported'));
            return;
        }

        // macOS 的授权框要由主进程请求才会弹（getUserMedia 不触发），未授权时 Chromium
        // 只给全静音音轨不报错，必须先过这道闸门再开流
        const micStatus = await dubbingApi.ensureMicrophone();
        if (abortPendingRecording()) {
            return;
        }
        if (micStatus !== 'granted') {
            logger.warn('麦克风授权未就绪，取消录音', { micStatus });
            toast.error(t('dubbing.micDenied'));
            return;
        }

        try {
            // 显式关闭 Chromium 默认开启的回声消除/降噪/自动增益：录音时视频已暂停、
            // 没有回声可消，而回声消除器在有声输出刚停止的瞬间启动自适应会产生一记
            // 比原声还响、随滤波器收敛指数衰减的开场爆音（原始 webm 实测确诊）；
            // 配音要的是麦克风原始输入
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });
        } catch (error) {
            logger.error('获取麦克风失败', { error });
            toast.error(t('dubbing.micDenied'));
            return;
        }
        if (abortPendingRecording()) {
            return;
        }

        wasPlayingBeforeRef.current = takeWasPlaying || usePlayer.getState().playing;
        playerActions.pause();

        // 变速提醒与导出对齐用同一把尺子：含时间轴微调的句区间
        const range = srtTender.mapSeekTime(currentSentence);
        const sentenceDuration = range.end - range.start;

        // 预备窗口：开流咔哒落在此时段内，动效结束才开始收音；
        // 期间流程被外部重置（切视频/卸载）就放弃本次录音并释放麦克风
        useDubbing.getState().beginPreparing(currentSentence.index);
        await new Promise((resolve) => setTimeout(resolve, PREPARE_MS));
        if (abortPendingRecording()) {
            return;
        }
        if (useDubbing.getState().phase !== 'preparing') {
            releaseStream();
            return;
        }

        cancelRequestedRef.current = false;
        chunksRef.current = [];
        const mimeType = pickMimeType();
        const mediaRecorder = new MediaRecorder(
            mediaStreamRef.current,
            mimeType ? { mimeType } : undefined,
        );
        mediaRecorderRef.current = mediaRecorder;
        useDubbing.getState().beginRecording(currentSentence.index);
        mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
                chunksRef.current.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            releaseStream();
            void handleRecordingDone(currentSentence.index, sentenceDuration);
        };
        mediaRecorder.start(200);
    };

    const stopRecording = (): void => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const cancelRecording = (): void => {
        cancelRequestedRef.current = true;
        stopRecording();
    };

    /**
     * 按下：只挂长按计时，不开麦、不改界面。没到阈值就松手不会有任何痕迹
     * （也就不会有开流那声咔哒）；越过阈值才真正进入录音流程。
     */
    const pressStart = (): void => {
        if (holdTimer !== null) {
            return;
        }
        const { phase } = useDubbing.getState();
        if (phase === 'saving' || phase === 'preparing') {
            return;
        }
        if (phase === 'recording') {
            // 录音中按下等同停止：正常靠松手停，这里兜住拿不到 keyup 的情况（如窗口失焦）
            stopRecording();
            return;
        }
        holdActivated = false;
        holdTimer = window.setTimeout(() => {
            holdTimer = null;
            holdActivated = true;
            void startRecording();
        }, HOLD_THRESHOLD_MS);
    };

    /**
     * 松开：长按成立的这一路收尾——已开始收音就停录保存，还停在授权/开流/预备窗口里就作废本次；
     * 没到阈值的短按则试听本句已有录音（没录过则什么都不做）。
     */
    const pressEnd = (): void => {
        if (holdTimer !== null) {
            window.clearTimeout(holdTimer);
            holdTimer = null;
        }
        if (holdActivated) {
            holdActivated = false;
            const { phase } = useDubbing.getState();
            if (phase === 'recording') {
                stopRecording();
            } else if (phase !== 'saving') {
                // 还没开始收音就松手：作废本次，别留下一段空壳录音
                abortPending = true;
            }
            return;
        }
        shortPress();
    };

    /**
     * 短按：试听本句已有录音，等价于点一下胶囊左侧那张录音卡片；这句没录过则无动作。
     */
    const shortPress = (): void => {
        if (useDubbing.getState().phase !== 'idle') {
            return;
        }
        const currentSentence = usePlayer.getState().currentSentence;
        if (!currentSentence) {
            return;
        }
        const filePath = useDubbing.getState().manifest
            ?.sentences[String(currentSentence.index)]?.take.filePath;
        if (!filePath) {
            return;
        }
        playTake(currentSentence.index, filePath);
    };

    // 每次渲染把最新闭包（含最新的 t）注册进全局通道；控制条按钮与键盘监听都从这里走
    useEffect(() => {
        registerDubbingControls({ pressStart, pressEnd, cancel: cancelRecording });
    });

    // 键盘监听按挂载数引用计数，进程内始终只有一份；动作经 dubbingControls
    // 路由到最新注册的闭包，hook 实例更替不会产生第二套监听或丢失路由
    useEffect(() => {
        keyboardMountCount += 1;
        if (keyboardMountCount === 1) {
            window.addEventListener('keydown', onRecordKeyDown);
            window.addEventListener('keyup', onRecordKeyUp);
        }
        return () => {
            keyboardMountCount -= 1;
            if (keyboardMountCount === 0) {
                window.removeEventListener('keydown', onRecordKeyDown);
                window.removeEventListener('keyup', onRecordKeyUp);
                if (holdTimer !== null) {
                    window.clearTimeout(holdTimer);
                    holdTimer = null;
                }
                holdActivated = false;
            }
            stopTake();
            // 卸载后录音不能再落地：预备窗口内直接作废并释放麦克风；还在授权/开流途中
            // （阶段仍是 idle）也打上作废标记，等它走到检查点自行退出
            if (useDubbing.getState().phase === 'preparing') {
                abortPending = true;
                useDubbing.getState().setIdle();
                releaseStream();
            } else if (useDubbing.getState().phase === 'idle') {
                abortPending = true;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { pressStart, pressEnd, cancel: cancelRecording };
}

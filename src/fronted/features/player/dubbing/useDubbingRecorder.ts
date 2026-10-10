import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import UrlUtil from '@/common/utils/UrlUtil';
import useChatPanel from '@/fronted/features/chat/chatStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { dubbingApi } from './dubbingApi';
import { dubbingControls, registerDubbingControls } from './dubbingControls';
import { resumePlaybackFromSentenceStart } from './dubbingPlayback';
import { useDubbing } from './dubbingStore';

const logger = getRendererLogger('useDubbingRecorder');

/**
 * 长按判定阈值：按住超过该时长进入“按住录音”模式（松手即停），否则等待第二次点按停止。
 */
const HOLD_THRESHOLD_MS = 400;

/**
 * 录音超长提醒阈值：录音时长超过句长的该倍数时提示变速倍率。
 */
const TOO_LONG_RATIO = 1.5;

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

/** 录音快捷键本次按下的时间戳（毫秒）；键盘监听单例的输入态，随监听卸载归零。 */
let pressStartAt = 0;

/** 键盘监听当前的挂载数：只有第一份挂载安装监听、最后一份卸载移除。 */
let keyboardMountCount = 0;

/**
 * 录音快捷键按下：Esc 取消/跳过回放；录音键经 dubbingControls 路由主操作。
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
        } else if (phase === 'replaying') {
            event.preventDefault();
            dubbingControls.primary();
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
    const { phase } = useDubbing.getState();
    if (phase === 'saving') {
        return;
    }
    event.preventDefault();
    pressStartAt = performance.now();
    dubbingControls.primary();
}

/**
 * 录音快捷键松开：长按（按住超过阈值）松手即停；短按继续录音等第二次点按。
 */
function onRecordKeyUp(event: KeyboardEvent): void {
    const config = useSetting.getState().setting('shortcut.dubbingRecord');
    if (!releasesRecordShortcut(event, config)) {
        return;
    }
    const { phase } = useDubbing.getState();
    if (phase !== 'recording') {
        return;
    }
    if (performance.now() - pressStartAt >= HOLD_THRESHOLD_MS) {
        dubbingControls.primary();
    }
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
    /** 主操作：空闲时开始录音、录音中停止、回放中跳过回放。 */
    primary: () => void;
    /** 取消当前录音（不保存）。 */
    cancel: () => void;
}

/**
 * 配音录音交互。
 *
 * 触发方式（两条入口共用同一流程）：
 * - 录音快捷键（默认 Q，可在设置中改绑）：点按开始/再按停止；长按松手即停；Esc 取消；
 * - 控制条录制按钮：通过 dubbingControls 全局通道触发相同动作。
 *
 * 录完自动保存为该句录音（覆盖旧录音），随后回放一遍，回放结束恢复原来的播放状态。
 * 保存成功后清单从后端重取（后端是唯一真相源），不在前端拼装本地清单。
 */
export function useDubbingRecorder(): DubbingRecorderControls {
    const { t } = useTranslation('player');

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const replayAudioRef = useRef<HTMLAudioElement | null>(null);
    const wasPlayingBeforeRef = useRef(false);
    const cancelRequestedRef = useRef(false);

    const releaseStream = (): void => {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
    };

    const stopReplay = (): void => {
        const audio = replayAudioRef.current;
        if (audio) {
            audio.onended = null;
            audio.pause();
            replayAudioRef.current = null;
        }
    };

    /**
     * 录音流程收尾：回到空闲并按需恢复播放。
     * @param backToSentenceStart 回放结束后是否先跳回当前句句首（原声对比场景），再按录音前的状态续播
     */
    const finishFlow = (backToSentenceStart = false): void => {
        stopReplay();
        useDubbing.getState().setIdle();
        const resumePlay = wasPlayingBeforeRef.current;
        wasPlayingBeforeRef.current = false;
        if (backToSentenceStart) {
            resumePlaybackFromSentenceStart(resumePlay);
            return;
        }
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

            const replayUrl = UrlUtil.toUrl(take.filePath);
            useDubbing.getState().beginReplay(replayUrl);
            const replayAudio = new Audio(replayUrl);
            replayAudio.volume = 0.9;
            replayAudio.onended = () => {
                // 回放结束跳回当前句句首再续播，方便紧接着听原声对比
                finishFlow(true);
            };
            replayAudioRef.current = replayAudio;
            await replayAudio.play();
        } catch (error) {
            logger.error('保存配音录音失败', { error });
            toast.error(error instanceof Error ? error.message : t('dubbing.saveFailed'));
            finishFlow();
        }
    };

    const startRecording = async (): Promise<void> => {
        const { phase } = useDubbing.getState();
        if (phase === 'recording' || phase === 'saving') {
            return;
        }
        if (useChatPanel.getState().learningVisible) {
            return;
        }
        // 回放中再次按下：跳过回放直接录下一遍；连录时保留最初录音前的播放状态，
        // 避免被回放期间的暂停覆盖导致整段连录结束后不再续播
        const chainedFromReplay = phase === 'replaying';
        stopReplay();
        useDubbing.getState().setIdle();

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

        try {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (error) {
            logger.error('获取麦克风失败', { error });
            toast.error(t('dubbing.micDenied'));
            return;
        }

        if (!chainedFromReplay) {
            wasPlayingBeforeRef.current = usePlayer.getState().playing;
        }
        playerActions.pause();

        // 变速提醒与导出对齐用同一把尺子：含时间轴微调的句区间
        const range = srtTender.mapSeekTime(currentSentence);
        const sentenceDuration = range.end - range.start;

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

    const primary = (): void => {
        const { phase } = useDubbing.getState();
        if (phase === 'saving') {
            return;
        }
        if (phase === 'recording') {
            stopRecording();
            return;
        }
        if (phase === 'replaying') {
            // 跳过回放同样回到句首，便于马上再录下一遍
            finishFlow(true);
            return;
        }
        void startRecording();
    };

    // 每次渲染把最新闭包（含最新的 t）注册进全局通道；控制条按钮与键盘监听都从这里走
    useEffect(() => {
        registerDubbingControls({ primary, cancel: cancelRecording });
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
                pressStartAt = 0;
            }
            stopReplay();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { primary, cancel: cancelRecording };
}

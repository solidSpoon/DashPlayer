import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import UrlUtil from '@/common/utils/UrlUtil';
import useChatPanel from '@/fronted/features/chat/chatStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { dubbingApi } from './dubbingApi';
import { registerDubbingControls } from './dubbingControls';
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

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let replayAudio: HTMLAudioElement | null = null;
let wasPlayingBeforeRecording = false;
let cancelRequested = false;

function releaseStream(): void {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
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

function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return !!element
        && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
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
 * - Q 键：点按开始/再按停止；长按松手即停；Esc 取消；
 * - 控制条录制按钮：通过 dubbingControls 全局通道触发相同动作。
 *
 * 录完自动保存为该句录音（覆盖旧录音），随后回放一遍，回放结束恢复原来的播放状态。
 */
export function useDubbingRecorder(): DubbingRecorderControls {
    const { t } = useTranslation('player');
    const pressStartRef = useRef(0);

    const stopReplay = (): void => {
        if (replayAudio) {
            replayAudio.onended = null;
            replayAudio.pause();
            replayAudio = null;
        }
    };

    /**
     * 录音流程收尾：回到空闲并按需恢复播放。
     * @param backToSentenceStart 回放结束后是否先跳回当前句句首（原声对比场景），再按录音前的状态续播
     */
    const finishFlow = (backToSentenceStart = false): void => {
        stopReplay();
        useDubbing.getState().setIdle();
        const resumePlay = wasPlayingBeforeRecording;
        wasPlayingBeforeRecording = false;
        if (backToSentenceStart) {
            resumePlaybackFromSentenceStart(resumePlay);
            return;
        }
        if (resumePlay) {
            playerActions.play();
        }
    };

    const handleRecordingDone = async (sentenceIndex: number, sentenceDuration: number): Promise<void> => {
        const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        mediaRecorder = null;
        chunks = [];

        if (cancelRequested || blob.size === 0) {
            if (!cancelRequested) {
                toast.error(t('dubbing.emptyRecording'));
            }
            finishFlow();
            return;
        }

        useDubbing.getState().setSaving();
        try {
            const buffer = await blob.arrayBuffer();
            const { videoPath, subtitlePath } = useFile.getState();
            const take = await dubbingApi.saveTake({
                videoKey: useFile.getState().srtHash!,
                sentenceIndex,
                audio: new Uint8Array(buffer),
                videoPath: videoPath!,
                subtitlePath,
            });
            useDubbing.getState().setSentenceTake(sentenceIndex, take);

            const ratio = take.durationSec / sentenceDuration;
            if (ratio > TOO_LONG_RATIO) {
                toast(t('dubbing.tooLong', { factor: ratio.toFixed(1) }), { icon: '⚠️' });
            }

            const replayUrl = UrlUtil.toUrl(take.filePath);
            useDubbing.getState().beginReplay(replayUrl);
            replayAudio = new Audio(replayUrl);
            replayAudio.volume = 0.9;
            replayAudio.onended = () => {
                // 回放结束跳回当前句句首再续播，方便紧接着听原声对比
                finishFlow(true);
            };
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
        const sentence = usePlayer.getState().currentSentence;
        if (!sentence) {
            toast.error(t('dubbing.noSentence'));
            return;
        }
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            toast.error(t('dubbing.micUnsupported'));
            return;
        }

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (error) {
            logger.error('获取麦克风失败', { error });
            toast.error(t('dubbing.micDenied'));
            return;
        }

        if (!chainedFromReplay) {
            wasPlayingBeforeRecording = usePlayer.getState().playing;
        }
        playerActions.pause();

        cancelRequested = false;
        chunks = [];
        mediaRecorder = new MediaRecorder(mediaStream, pickMimeType() ? { mimeType: pickMimeType() } : undefined);
        useDubbing.getState().beginRecording(sentence.index);
        mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            releaseStream();
            void handleRecordingDone(sentence.index, sentence.end - sentence.start);
        };
        mediaRecorder.start(200);
    };

    const stopRecording = (): void => {
        if (mediaRecorder?.state === 'recording') {
            mediaRecorder.stop();
        }
    };

    const cancelRecording = (): void => {
        cancelRequested = true;
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

    // 快捷键监听保持挂载一次；通过 ref 调到每次渲染的最新闭包（含最新的 t）
    const controlsRef = useRef({ primary, cancel: cancelRecording });
    useEffect(() => {
        controlsRef.current = { primary, cancel: cancelRecording };
        // 控制条按钮经全局通道调到最新闭包
        registerDubbingControls({ primary, cancel: cancelRecording });
    });

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                const { phase } = useDubbing.getState();
                if (phase === 'recording') {
                    event.preventDefault();
                    controlsRef.current.cancel();
                } else if (phase === 'replaying') {
                    event.preventDefault();
                    controlsRef.current.primary();
                }
                return;
            }
            if (event.code !== 'KeyQ' || event.repeat || isTypingTarget(event.target)) {
                return;
            }
            const { phase } = useDubbing.getState();
            if (phase === 'saving') {
                return;
            }
            event.preventDefault();
            pressStartRef.current = performance.now();
            if (phase === 'recording') {
                stopRecording();
                return;
            }
            void startRecording();
        };

        const onKeyUp = (event: KeyboardEvent): void => {
            if (event.code !== 'KeyQ') {
                return;
            }
            const { phase } = useDubbing.getState();
            if (phase !== 'recording') {
                return;
            }
            // 长按：松手即停；短按：继续录音等第二次点按
            if (performance.now() - pressStartRef.current >= HOLD_THRESHOLD_MS) {
                stopRecording();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            stopReplay();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { primary, cancel: cancelRecording };
}

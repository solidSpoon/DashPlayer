import { create } from 'zustand';
import {
    DubbingManifest,
} from '@/common/contracts/dubbing';
import useFile from '@/fronted/features/file-browser/fileStore';
import { dubbingApi } from './dubbingApi';

/**
 * 配音录音流程所处阶段。
 */
export type DubbingPhase = 'idle' | 'recording' | 'saving' | 'replaying';

interface DubbingState {
    /** 当前视频的配音清单；无字幕或未加载时为 null。 */
    manifest: DubbingManifest | null;
    /** 录音流程阶段。 */
    phase: DubbingPhase;
    /** 正在录音/处理/回放的目标句序号。 */
    targetIndex: number | null;
    /** 本次录音开始时间戳（毫秒），用于界面计时。 */
    recordingStartTs: number | null;
    /** 当前正在回放的录音文件 URL。 */
    replayUrl: string | null;

    /** 切换视频时加载配音清单。 */
    loadManifest: (videoKey: string) => Promise<void>;
    /** 重置录音流程与清单（视频切换/卸载时调用）。 */
    reset: () => void;
    /** 标记开始录音。 */
    beginRecording: (sentenceIndex: number) => void;
    /** 标记录音处理中。 */
    setSaving: () => void;
    /** 标记开始回放录音。 */
    beginReplay: (url: string) => void;
    /** 录音流程结束回到空闲。 */
    setIdle: () => void;
    /** 清除某句的配音（本地清单同步移除）。 */
    clearSentence: (videoKey: string, sentenceIndex: number) => Promise<void>;
}

export const useDubbing = create<DubbingState>((set, get) => ({
    manifest: null,
    phase: 'idle',
    targetIndex: null,
    recordingStartTs: null,
    replayUrl: null,

    loadManifest: async (videoKey: string) => {
        const manifest = await dubbingApi.list(videoKey);
        // 加载期间视频可能已切换，只回填仍然匹配的结果
        if (useFile.getState().srtHash === videoKey) {
            set({ manifest });
        }
    },

    reset: () => {
        set({ manifest: null, phase: 'idle', targetIndex: null, recordingStartTs: null, replayUrl: null });
    },

    beginRecording: (sentenceIndex: number) => {
        set({ phase: 'recording', targetIndex: sentenceIndex, recordingStartTs: Date.now(), replayUrl: null });
    },

    setSaving: () => {
        set({ phase: 'saving', recordingStartTs: null });
    },

    beginReplay: (url: string) => {
        set({ phase: 'replaying', replayUrl: url });
    },

    setIdle: () => {
        set({ phase: 'idle', targetIndex: null, recordingStartTs: null, replayUrl: null });
    },

    clearSentence: async (videoKey: string, sentenceIndex: number) => {
        await dubbingApi.clearSentence({ videoKey, sentenceIndex });
        const manifest = get().manifest;
        if (!manifest) {
            return;
        }
        const sentences = { ...manifest.sentences };
        delete sentences[String(sentenceIndex)];
        set({ manifest: { ...manifest, sentences } });
    },
}));

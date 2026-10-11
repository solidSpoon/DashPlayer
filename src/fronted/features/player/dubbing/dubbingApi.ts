import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { DubbingExportStatus, DubbingLibraryEntry, DubbingManifest, DubbingTakeVO } from '@/common/contracts/dubbing';

/**
 * 配音功能的 backendClient 封装。
 */
export const dubbingApi = {
    saveTake: (params: {
        videoKey: string;
        sentenceIndex: number;
        audio: Uint8Array;
        videoPath: string;
        subtitlePath: string | null;
    }): Promise<DubbingTakeVO> => backendClient.call('dubbing/save-take', params),

    list: (videoKey: string): Promise<DubbingManifest | null> =>
        backendClient.call('dubbing/list', { videoKey }),

    /** 列出所有可导出的配音视频（视频文件仍存在且已录过音）。 */
    listLibrary: (): Promise<DubbingLibraryEntry[]> =>
        backendClient.call('dubbing/list-library'),

    clearSentence: (params: { videoKey: string; sentenceIndex: number }): Promise<void> =>
        backendClient.call('dubbing/clear-sentence', params),

    clearVideo: (videoKey: string): Promise<void> =>
        backendClient.call('dubbing/clear-video', { videoKey }),

    export: (params: { videoKey: string; outputFolder: string }): Promise<string> =>
        backendClient.call('dubbing/export', params),

    /** 查询最近一次导出任务的状态（含进行中）；导出页重进时据此恢复行状态。 */
    exportStatus: (): Promise<DubbingExportStatus | null> =>
        backendClient.call('dubbing/export-status'),

    selectFolder: (options?: { defaultPath?: string; createDirectory?: boolean }): Promise<string[]> =>
        backendClient.call('system/select-folder', options ?? {}),

    openFolder: (path: string): Promise<void> =>
        backendClient.call('system/open-folder', { path }),

    /** 确保 macOS 麦克风授权已就绪（未决定时主进程弹系统授权框）；仅 'granted' 可录音。 */
    ensureMicrophone: (): Promise<'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown'> =>
        backendClient.call('system/ensure-microphone'),
};

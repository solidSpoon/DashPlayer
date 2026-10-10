import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { DubbingManifest, DubbingTakeVO } from '@/common/contracts/dubbing';

/**
 * 配音功能的 backendClient 封装。
 */
export const dubbingApi = {
    saveTake: (params: { videoKey: string; sentenceIndex: number; audio: Uint8Array }): Promise<DubbingTakeVO> =>
        backendClient.call('dubbing/save-take', params),

    list: (videoKey: string): Promise<DubbingManifest | null> =>
        backendClient.call('dubbing/list', { videoKey }),

    clearSentence: (params: { videoKey: string; sentenceIndex: number }): Promise<void> =>
        backendClient.call('dubbing/clear-sentence', params),

    export: (params: {
        videoKey: string;
        videoPath: string;
        outputFolder: string;
        segments: Array<{ index: number; startSecond: number; endSecond: number }>;
    }): Promise<string> =>
        backendClient.call('dubbing/export', params),

    selectFolder: (options?: { defaultPath?: string; createDirectory?: boolean }): Promise<string[]> =>
        backendClient.call('system/select-folder', options ?? {}),

    openFolder: (path: string): Promise<void> =>
        backendClient.call('system/open-folder', { path }),
};

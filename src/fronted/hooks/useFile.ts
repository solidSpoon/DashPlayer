import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import MediaUtil from '@/common/utils/MediaUtil';
import StrUtil from '@/common/utils/str-util';

type UseFileState = {
    videoPath: string | null;
    videoId: string | null;
    subtitlePath: string | null;
    videoLoaded: boolean;
    srtHash: string | null;
};

type UseFileActions = {
    updateFile: (file: string) => void;
    loadedVideo: (file: string) => void;
    clear: () => void;
    clearSrt: () => void;
};

const useFile = create(
    subscribeWithSelector<UseFileState & UseFileActions>((set) => ({
        videoPath: null,
        subtitlePath: null,
        videoLoaded: false,
        videoId: null,
        projectId: null,
        srtHash: null,
        updateFile: (ph: string) => {
            if (MediaUtil.isMedia(ph)) {
                set({
                    videoPath: ph,
                    videoLoaded: false
                });
                if (StrUtil.isBlank(MediaUtil.fileName(ph))) {
                    document.title = MediaUtil.fileName(ph);
                }
            }
            if (MediaUtil.isSrt(ph)) {
                set((s) => ({
                    subtitlePath: ph,
                    srtHash: s.subtitlePath === ph ? s.srtHash : null,
                }));
            }
        },
        loadedVideo: (ph: string) => {
            set((s) => {
                return {
                    videoLoaded: s.videoPath === ph
                };
            });
        },
        clear: () => {
            set({
                videoPath: null,
                subtitlePath: null,
                videoLoaded: false,
                videoId: null,
                srtHash: null
            });
        },
        clearSrt: () => {
            set({
                subtitlePath: null,
                srtHash: null,
            });
        }
    }))
);

export default useFile;

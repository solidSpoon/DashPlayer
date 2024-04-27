import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import MediaUtil from '@/common/utils/MediaUtil';
import { strBlank } from '@/common/utils/Util';

type UseFileState = {
    videoPath: string | null;
    videoId: number | null;
    projectId: number | null;
    subtitlePath: string | null;
    videoLoaded: boolean;
    srtHash: string | null;
};

type UseFileActions = {
    updateFile: (file: string) => void;
    loadedVideo: (file: string) => void;
    clear: () => void;
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
                if (strBlank(MediaUtil.fileName(ph))) {
                    document.title = MediaUtil.fileName(ph);
                }
            }
            if (MediaUtil.isSrt(ph)) {
                set({
                    subtitlePath: ph
                });
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
                projectId: null,
                srtHash: null
            });
        }
    }))
);

export default useFile;

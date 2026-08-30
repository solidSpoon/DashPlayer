/**
 * 管理当前播放器绑定的视频、字幕和字幕哈希等文件上下文。
 */
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
    subtitleSessionId: string | null;
    /** 字幕重载令牌；递增时触发播放器按当前 subtitlePath 重建字幕上下文。 */
    subtitleReloadToken: number;
};

type UseFileActions = {
    updateFile: (file: string) => void;
    loadedVideo: (file: string) => void;
    clear: () => void;
    clearSrt: () => void;
    /** 递增重载令牌，用于在 subtitlePath 不变时强制重建字幕（如增量会话结束）。 */
    reloadSubtitles: () => void;
};

const useFile = create(
    subscribeWithSelector<UseFileState & UseFileActions>((set) => ({
        videoPath: null,
        subtitlePath: null,
        videoLoaded: false,
        videoId: null,
        projectId: null,
        srtHash: null,
        subtitleSessionId: null,
        subtitleReloadToken: 0,
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
            if (MediaUtil.isSubtitle(ph)) {
                set((s) => ({
                    subtitlePath: ph,
                    srtHash: s.subtitlePath === ph ? s.srtHash : null,
                    subtitleSessionId: s.subtitlePath === ph ? s.subtitleSessionId : null,
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
                srtHash: null,
                subtitleSessionId: null,
            });
        },
        clearSrt: () => {
            set({
                subtitlePath: null,
                srtHash: null,
                subtitleSessionId: null,
            });
        },
        reloadSubtitles: () => {
            set((s) => ({ subtitleReloadToken: s.subtitleReloadToken + 1 }));
        },
    }))
);

export default useFile;

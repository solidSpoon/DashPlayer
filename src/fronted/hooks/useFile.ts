import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import FileT, { FileType } from '../../common/types/FileT';
import { WatchProjectVideo } from '@/backend/db/tables/watchProjectVideos';
const api = window.electron;

type UseFileState = {
    videoFile: FileT | null;
    videoId: number | null;
    projectId: number | null;
    subtitleFile: FileT | null;
    videoLoaded: boolean;
    openedNum: number;
};

type UseFileActions = {
    updateFile: (file: FileT) => void;
    loadedVideo: (file: FileT) => void;
    clear: () => void;
};

const useFile = create(
    subscribeWithSelector<UseFileState & UseFileActions>((set) => ({
        videoFile: undefined,
        subtitleFile: undefined,
        videoLoaded: false,
        openedNum: 0,
        videoId: null,
        projectId: null,
        updateFile: (file: FileT) => {
            if (FileType.VIDEO === file.fileType) {
                set((ps) => {
                    return {
                        videoFile: file,
                        openedNum: ps.openedNum + 1,
                        videoLoaded: false,
                    };
                });
                if (file.fileName !== undefined) {
                    document.title = file.fileName;
                }
            }
            if (FileType.SUBTITLE === file.fileType) {
                set((ps) => {
                    return {
                        subtitleFile: file,
                        openedNum: ps.openedNum + 1,
                        currentVideo: {
                            subtitle_path: file.path,
                        } as WatchProjectVideo,
                    };
                });
            }
        },
        loadedVideo: (file: FileT) => {
            set((s) => {
                return {
                    videoLoaded: s.videoFile === file,
                };
            });
        },
        clear: () => {
            set((s) => {
                return {
                    videoFile: undefined,
                    subtitleFile: undefined,
                    videoLoaded: false,
                    openedNum: s.openedNum + 1,
                    currentVideo: undefined,
                };
            });
        },
    }))
);

export default useFile;

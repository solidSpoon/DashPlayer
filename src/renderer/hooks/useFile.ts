import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import FileT, { FileType } from '../lib/param/FileT';

type UseFileState = {
    videoFile: FileT | undefined;
    subtitleFile: FileT | undefined;
    videoLoaded: boolean;
    openedNum: number;
};

type UseFileActions = {
    updateFile: (file: FileT) => void;
    loadedVideo: (file: FileT) => void;
};

const useFile = create(
    subscribeWithSelector<UseFileState & UseFileActions>((set) => ({
        videoFile: undefined,
        subtitleFile: undefined,
        videoLoaded: false,
        openedNum: 0,
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
    }))
);

export default useFile;

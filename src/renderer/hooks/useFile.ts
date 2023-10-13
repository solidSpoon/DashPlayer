import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import FileT, { FileType } from '../lib/param/FileT';

type UseFileState = {
    videoFile: FileT | undefined;
    subtitleFile: FileT | undefined;
    loadedNum: number;
};

type UseFileActions = {
    updateFile: (file: FileT) => void;
};

const useFile = create(
    subscribeWithSelector<UseFileState & UseFileActions>((set) => ({
        videoFile: undefined,
        subtitleFile: undefined,
        loadedNum: 0,
        updateFile: (file: FileT) => {
            if (FileType.VIDEO === file.fileType) {
                set((ps) => {
                    return {
                        videoFile: file,
                        loadedNum: ps.loadedNum + 1,
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
                        loadedNum: ps.loadedNum + 1,
                    };
                });
            }
        },
    }))
);

export default useFile;

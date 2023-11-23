import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import FileT, { FileType } from '../lib/param/FileT';
import WatchProjectItem from '../components/WatchProjectItem';
import { pathToFile } from '../lib/FileParser';
import { WatchProjectVideo } from '../../db/entity/WatchProjectVideo';

type UseFileState = {
    videoFile: FileT | undefined;
    subtitleFile: FileT | undefined;
    currentVideo: WatchProjectVideo | undefined;
    videoLoaded: boolean;
    openedNum: number;
};

type UseFileActions = {
    updateFile: (file: FileT) => void;
    loadedVideo: (file: FileT) => void;
    playFile: (f: WatchProjectVideo) => void;
};

const useFile = create(
    subscribeWithSelector<UseFileState & UseFileActions>((set) => ({
        videoFile: undefined,
        subtitleFile: undefined,
        videoLoaded: false,
        openedNum: 0,
        currentVideo: undefined,
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
        playFile: async (f: WatchProjectVideo) => {
            const video = await pathToFile(f.video_path ?? '');
            const subtitle = await pathToFile(f.subtitle_path ?? '');
            useFile.getState().updateFile(video);
            useFile.getState().updateFile(subtitle);
            set((s) => {
                return {
                    currentVideo: f,
                };
            });
        },
    }))
);

export default useFile;

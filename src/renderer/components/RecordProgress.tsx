import { useEffect } from 'react';
import { ProgressParam } from '../../main/controllers/ProgressController';
import useFile from '../hooks/useFile';

interface RecordProgressParam {
    getCurrentProgress: () => number;
    getTotalTime: () => number;
}

const api = window.electron;

const RecordProgress = ({
    getCurrentProgress,
    getTotalTime,
}: RecordProgressParam) => {
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    const videoLoaded = useFile((s) => s.videoLoaded);
    useEffect(() => {
        async function method() {
            if (videoFile === undefined || getCurrentProgress() === undefined) {
                return;
            }
            if (!videoLoaded) {
                return;
            }
            const fileName = videoFile?.fileName;
            const progress = getCurrentProgress();
            if (fileName !== undefined) {
                const p: ProgressParam = {
                    fileName,
                    progress,
                    total: getTotalTime(),
                    filePath: videoFile.path,
                    subtitlePath: subtitleFile?.path,
                };
                await api.updateProgress(p);
            }
        }

        const interval = setInterval(method, 1000);
        return () => {
            clearInterval(interval);
        };
    }, [
        videoFile,
        getCurrentProgress,
        getTotalTime,
        subtitleFile?.path,
        videoLoaded,
    ]);
    return <></>;
};
export default RecordProgress;

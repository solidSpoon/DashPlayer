import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ProgressParam } from '../../main/controllers/ProgressController';
import useFile from '../hooks/useFile';
import usePlayerController from '../hooks/usePlayerController';

const api = window.electron;

const RecordProgress = () => {
    const { getExactPlayTime, duration } = usePlayerController(
        useShallow((s) => ({
            getExactPlayTime: s.getExactPlayTime,
            duration: s.duration,
        }))
    );
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    const videoLoaded = useFile((s) => s.videoLoaded);
    useEffect(() => {
        async function method() {
            if (videoFile === undefined || getExactPlayTime() === undefined) {
                return;
            }
            if (!videoLoaded) {
                return;
            }
            const fileName = videoFile?.fileName;
            const progress = getExactPlayTime();
            if (fileName !== undefined) {
                const p: ProgressParam = {
                    fileName,
                    progress,
                    total: duration,
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
        duration,
        getExactPlayTime,
        subtitleFile?.path,
        videoFile,
        videoLoaded,
    ]);
    return <></>;
};
export default RecordProgress;

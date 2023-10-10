import { useEffect } from 'react';
import FileT from '../lib/param/FileT';
import callApi from '../lib/apis/ApiWrapper';
import { ProgressParam } from '../../main/controllers/ProgressController';

interface RecordProgressParam {
    getCurrentProgress: () => number;
    videoFile: FileT | undefined;
    subtitleFile: FileT | undefined;
}

const api = window.electron;

const RecordProgress = ({
    videoFile,
    subtitleFile,
    getCurrentProgress,
}: RecordProgressParam) => {
    useEffect(() => {
        async function method() {
            if (videoFile === undefined || getCurrentProgress() === undefined) {
                return;
            }
            const fileName = videoFile?.fileName;
            const progress = getCurrentProgress();
            if (fileName !== undefined) {
                const p: ProgressParam = {
                    fileName,
                    progress,
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
    }, [videoFile, getCurrentProgress]);
    return <></>;
};
export default RecordProgress;

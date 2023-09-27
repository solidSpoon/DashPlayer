import { useEffect } from 'react';
import FileT from '../lib/param/FileT';
import callApi from '../lib/apis/ApiWrapper';

interface RecordProgressParam {
    getCurrentProgress: () => number;
    videoFile: FileT | undefined;
}

const api = window.electron;

const RecordProgress = ({
    videoFile,
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
                await api.updateProgress(fileName, progress);
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

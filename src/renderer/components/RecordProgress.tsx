import { useEffect } from 'react';
import FileT from '../lib/param/FileT';
import callApi from '../apis/ApiWrapper';

interface RecordProgressParam {
    getCurrentProgress: () => number;
    getCurrentVideoFile: () => FileT | undefined;
}

const RecordProgress = (props: RecordProgressParam) => {
    useEffect(() => {
        const { getCurrentVideoFile, getCurrentProgress } = props;

        async function method() {
            if (
                getCurrentVideoFile() === undefined ||
                getCurrentProgress() === undefined
            ) {
                return;
            }
            const fileName = getCurrentVideoFile()?.fileName;
            const progress = getCurrentProgress();
            if (fileName !== undefined) {
                await callApi('update-progress', [fileName, progress]);
            }
        }

        const interval = setInterval(method, 1000);
        return () => {
            clearInterval(interval);
        };
    }, [props]);
    return <></>;
};
export default RecordProgress;

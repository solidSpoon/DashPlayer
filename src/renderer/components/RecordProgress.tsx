import { useEffect } from "react";
import FileT from "../lib/param/FileT";

interface RecordProgressParam {
    getCurrentProgress: () => number;
    getCurrentVideoFile: () => FileT;
}

const RecordProgress = (props: RecordProgressParam) => {
    useEffect(() => {
        const { getCurrentVideoFile, getCurrentProgress } = props;

        function method() {
            if (
                getCurrentVideoFile() === undefined ||
                getCurrentProgress() === undefined
            ) {
                return;
            }
            console.log("update progress");
            const { fileName } = getCurrentVideoFile();
            const progress = getCurrentProgress();
            console.log("recordProgress", fileName, progress);
            window.electron.ipcRenderer.sendMessage("update-progress", [fileName, progress]);
            window.electron.ipcRenderer.once("update-progress", (result) => {
                console.log("update progress ", result);
            });
        }

        const interval = setInterval(method, 5000);
        return () => {
            clearInterval(interval);
        };
    }, [props]);
    return <></>;
};
export default RecordProgress;

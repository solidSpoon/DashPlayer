import { useState } from 'react';
import FileT, { FileType } from '../lib/param/FileT';

export default function useFile() {
    const [videoFile, setVideoFile] = useState<FileT | undefined>(undefined);
    const [subtitleFile, setSubtitleFile] = useState<FileT | undefined>(
        undefined
    );

    const updateFile = (file: FileT) => {
        if (FileType.VIDEO === file.fileType) {
            setVideoFile(file);
            if (file.fileName !== undefined) {
                document.title = file.fileName;
            }
        }
        if (FileType.SUBTITLE === file.fileType) {
            setSubtitleFile(file);
        }
    };

    return {
        videoFile,
        subtitleFile,
        updateFile,
    };
}

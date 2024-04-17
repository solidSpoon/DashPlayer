// ".mp4,.webm,.wav,.srt"

import {strBlank} from "@/common/utils/Util";

export const ACCEPTED_FILE_TYPES = '.mp4,.webm,.wav,.srt,.mp3,.m4a';

export const isMidea = (path: string): boolean => {
    if (strBlank(path)) {
        return false;
    }
    return (
        path.endsWith('.mp4') || path.endsWith('.wav') || path.endsWith('.webm') || path.endsWith('.mp3') || path.endsWith('.m4a')
    );
};

export const isSrt = (path: string): boolean => {
    if (strBlank(path)) {
        return false;
    }
    return path.endsWith('.srt');
};

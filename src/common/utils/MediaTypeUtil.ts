// ".mp4,.webm,.wav,.srt"

import {strBlank} from "@/common/utils/Util";

export const ACCEPTED_FILE_TYPES = '.mp4,.webm,.wav,.srt,.mp3,.m4a';


export default class MediaTypeUtil {
    public static isSrt(path: string): boolean {
        if (strBlank(path)) {
            return false;
        }
        return path.endsWith('.srt');
    }


    public static isVideo(path: string): boolean {
        if (strBlank(path)) {
            return false;
        }
        return path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.wav');
    }

    public static isAudio(path: string): boolean {
        if (strBlank(path)) {
            return false;
        }
        return path.endsWith('.mp3') || path.endsWith('.m4a');
    }
    public static isMedia(path: string): boolean {
        return MediaTypeUtil.isVideo(path) || MediaTypeUtil.isAudio(path);
    }
}

export const isMedia = (path: string): boolean => {
    return MediaTypeUtil.isMedia(path);
};



export const isSrt = (path: string): boolean => {
    return MediaTypeUtil.isSrt(path);
};

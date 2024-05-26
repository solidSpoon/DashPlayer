// ".mp4,.webm,.wav,.srt"

import {strBlank} from "@/common/utils/Util";

export const SupportedVideoFormats = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];
export const UnsupportedVideoFormats = ['.mkv'];
export const SupportedAudioFormats = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.wma', '.aac'];
export const SupportedSubtitleFormats = ['.srt'];
export const AllFormats = [...SupportedVideoFormats, ...UnsupportedVideoFormats, ...SupportedAudioFormats, ...SupportedSubtitleFormats];
export const SupportedFormats = [...SupportedVideoFormats, ...SupportedAudioFormats, ...SupportedSubtitleFormats];
export default class MediaUtil {
    public static isSrt(path: string): boolean {
        if (strBlank(path)) {
            return false;
        }
        return path.endsWith('.srt');
    }

    public static supported(path: string): boolean {
        if (strBlank(path)) {
            return false;
        }
        return SupportedFormats.some(f => path.endsWith(f));
    }

    public static isVideo(path: string): boolean {
        if (strBlank(path)) {
            return false;
        }
        // SupportedVideoFormats and UnsupportedVideoFormats
        return [...SupportedVideoFormats,...UnsupportedVideoFormats].some(f => path.endsWith(f));
    }

    public static isAudio(path: string): boolean {
        if (strBlank(path)) {
            return false;
        }
        return SupportedAudioFormats.some(f => path.endsWith(f));
    }
    public static isMedia(path: string): boolean {
        return MediaUtil.isVideo(path) || MediaUtil.isAudio(path);
    }

    public static fileName(path: string): string {
        if (strBlank(path)) {
            return '';
        }
        const fileSeparator = path.lastIndexOf('/') > 0 ? '/' : '\\';
        return path.substring(path.lastIndexOf(fileSeparator) + 1);
    }
}

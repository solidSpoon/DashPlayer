// ".mp4,.webm,.wav,.srt"

export const ACCEPTED_FILE_TYPES = '.mp4,.webm,.wav,.srt,.mp3,.m4a';

export const isMidea = (path: string): boolean => {
    return (
        path.endsWith('.mp4') || path.endsWith('.wav') || path.endsWith('.webm') || path.endsWith('.mp3') || path.endsWith('.m4a')
    );
};

export const isSrt = (path: string): boolean => {
    return path.endsWith('.srt');
};

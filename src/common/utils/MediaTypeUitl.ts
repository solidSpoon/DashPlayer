// ".mp4,.webm,.wav,.srt"

export const ACCEPTED_FILE_TYPES = '.mp4,.webm,.wav,.srt';

export const isVideo = (path: string): boolean => {
    return (
        path.endsWith('.mp4') || path.endsWith('.wav') || path.endsWith('.webm')
    );
};

export const isSubtitle = (path: string): boolean => {
    return path.endsWith('.srt');
};

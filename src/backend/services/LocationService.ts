export enum LocationType {
    FAVORITE_CLIPS = 'favorite_clips',
    TEMP = 'temp',
    LOGS = 'logs',
    VIDEOS = 'videos',
    TEMP_OSS = 'temp_oss',
    DATA = 'data',
}

export enum ProgramType {
    FFMPEG = 'ffmpeg',
    FFPROBE = 'ffprobe',
    YT_DL = 'yt-dlp',
    LIB = 'lib',
}
export default interface LocationService {
    getStoragePath(type: LocationType): string;

    getProgramPath(type: ProgramType): string;

    listCollectionPaths(): string[];
}

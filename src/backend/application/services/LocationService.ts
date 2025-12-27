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
    LIB = 'lib',
}

export default interface LocationService {
    getDetailLibraryPath(type: LocationType): string;

    getBaseLibraryPath(): string;

    getBaseClipPath(): string;

    getThirdLibPath(type: ProgramType): string;

    listCollectionPaths(): string[];
}

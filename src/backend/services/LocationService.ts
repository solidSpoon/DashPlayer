import path from 'path';
export default class LocationService {
    private static readonly isDev = process.env.NODE_ENV === 'development';
    public static ffmpegPath() {
        return this.isDev ? path.resolve('lib/ffmpeg') : `${process.resourcesPath}/lib/ffmpeg`;
    }
    public static ffprobePath() {
        return this.isDev ? path.resolve('lib/ffprobe') : `${process.resourcesPath}/lib/ffprobe`;
    }

    public static ytDlPath() {
        return this.isDev ? path.resolve('lib/yt-dlp') : `${process.resourcesPath}/lib/yt-dlp`;
    }
    public static libPath() {
        return this.isDev ? path.resolve('lib') : `${process.resourcesPath}/lib`;
    }

    public static scriptPath() {
        return this.isDev ? path.resolve('scripts') : `${process.resourcesPath}/scripts`;
    }
}

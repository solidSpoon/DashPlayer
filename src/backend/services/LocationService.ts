export default class LocationService {
    private static readonly isDev = process.env.NODE_ENV === 'development';
    public static ffmpegPath() {
        return this.isDev ? 'lib/ffmpeg' : `${process.resourcesPath}/lib/ffmpeg`;
    }
    public static ffprobePath() {
        return this.isDev ? 'lib/ffprobe' : `${process.resourcesPath}/lib/ffprobe`;
    }
}

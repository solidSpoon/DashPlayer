import ffmpeg from "fluent-ffmpeg";
import ffmpeg_static from "ffmpeg-static";
import Lock from "@/common/utils/Lock";

export default class FfmpegService {
    static {
        ffmpeg.setFfmpegPath(ffmpeg_static);
    }

    /**
     * ffmpeg -y -ss {} -t {} -accurate_seek -i {} -codec copy  -avoid_negative_ts 1 {}
     *
     * -y：覆盖输出文件而不进行提示。这是通过.outputOptions('-y')实现的。
     * -ss：设置开始时间偏移。这是通过.setStartTime(startSecond)实现的。
     * -t：设置录制时间。这是通过.setDuration(endSecond - startSecond)实现的。
     * -accurate_seek：精确寻找。这是通过.outputOptions('-accurate_seek')实现的。
     * -i：输入文件路径。这是通过ffmpeg(inputFile)实现的。
     * -codec copy：复制原始编码。这是通过.outputOptions('-codec copy')实现的。
     * -avoid_negative_ts 1：避免负时间戳。这是通过.outputOptions('-avoid_negative_ts 1')实现的。
     * 输出文件路径。这是通过.output(outputFile)实现的。
     */
    public static async splitVideo({
                                       inputFile,
                                       startSecond,
                                       endSecond,
                                       outputFile
                                   }: {
        inputFile: string,
        startSecond: number,
        endSecond: number,
        outputFile: string
    }) {
        await Lock.sync('ffmpeg', async () => {
            await new Promise((resolve, reject) => {
                ffmpeg(inputFile)
                    .setStartTime(startSecond)
                    .setDuration(endSecond - startSecond)
                    .outputOptions('-y') // 覆盖输出文件而不进行提示
                    .outputOptions('-accurate_seek') // 精确寻找
                    .outputOptions('-codec copy') // 复制原始编码
                    .outputOptions('-avoid_negative_ts 1') // 避免负时间戳
                    .output(outputFile)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
        });
    }

    public static async toMp3({
                                  inputFile,
                                  outputFile
                              }: {
        inputFile: string,
        outputFile: string
    }) {
        await Lock.sync('ffmpeg', async () => {
            await new Promise((resolve, reject) => {
                ffmpeg(inputFile)
                    .audioBitrate(128) // Set audio bitrate to low quality
                    .format('mp3') // Convert to mp3 format
                    .output(outputFile)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
        });
    }


    public static async duration(filePath: string): Promise<number> {
        return await Lock.sync<number>('ffmpeg', async () => {
            return new Promise<number>((resolve, reject) => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata.format.duration);
                });
            });
        });
    }
}

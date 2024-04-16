import ffmpeg from "fluent-ffmpeg";
import ffmpeg_static from "ffmpeg-static";

export default class FfmpegService {
    static {
        ffmpeg.setFfmpegPath(ffmpeg_static);
    }

    /**
     * ffmpeg -y -ss {} -t {} -accurate_seek -i {} -codec copy  -avoid_negative_ts 1 {}
     * -y：覆盖输出文件而不进行提示
     * -ss：设置开始时间偏移
     * -t：设置录制时间
     * -accurate_seek：精确寻找
     * -i：输入文件路径
     * -codec copy：复制原始编码
     * -avoid_negative_ts 1：避免负时间戳
     * @param inputFile
     * @param startSecond
     * @param endSecond
     * @param outputFile
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
        await new Promise((resolve, reject) => {
            ffmpeg(inputFile)
                .setStartTime(startSecond)
                .setDuration(endSecond - startSecond)
                .outputOptions('-codec copy')
                .outputOptions('-avoid_negative_ts 1')
                .output(outputFile)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
    }
}

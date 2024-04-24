import ffmpeg from 'fluent-ffmpeg';
import ffmpeg_static from 'ffmpeg-static';
import ffprobe_static from 'ffprobe-static';
import Lock from '@/common/utils/Lock';
import TimeUtil from '@/common/utils/TimeUtil';
import { spawn } from 'child_process';

export default class FfmpegService {
    static {
        ffmpeg.setFfmpegPath(ffmpeg_static);
        ffmpeg.setFfprobePath(ffprobe_static.path);
    }

    /**
     * ffmpeg -ss [start_time] -i input.mp4 -to [duration] -c:v libx264 -c:a aac output.mp4
     *
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
            console.log('Splitting video...', startSecond);
            return new Promise((resolve, reject) => {
                const ff = spawn(ffmpeg_static, [
                    '-ss', startSecond.toString(),
                    '-i', inputFile,
                    '-to', (endSecond - startSecond).toString(),
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    outputFile
                ]);


                ff.on('close', (code) => {
                    console.log(`ffmpeg process exited with code ${code}`);
                    resolve(null);
                });

                ff.on('error', (error) => {
                    console.log('An error occurred while executing ffmpeg command:', error);
                    reject(error);
                });

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
        return await Lock.sync<number>('ffprobe', async () => {
            return new Promise<number>((resolve, reject) => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata.format.duration);
                });
            });
        });
    }


    // /**
    //  * 获取视频关键帧的时间戳
    //  */
    // public static async keyFrameTimestamps(filePath: string): Promise<number[]> {
    //     return new Promise((resolve, reject) => {
    //         ffmpeg.ffprobe(filePath, (err, metadata) => {
    //             if (err) {
    //                 reject(err);
    //                 return;
    //             }
    //             const keyFrames = metadata.streams
    //                 .filter(stream => stream.codec_type === 'video')
    //                 .flatMap(stream => stream.key_frame_pts || [])
    //                 .map(pts => pts / stream.time_base); // Convert PTS to seconds based on the time base
    //             resolve(keyFrames);
    //         });
    //     });
    // }


    /**
     * 截取视频的缩略图
     *
     * input: eg:视频文件路径 /a/b/c.mp4
     * output: eg:缩略图文件路径 /a/b/c.jpg
     */
    public static async thumbnail({
                                      inputFile,
                                      outputFileName,
                                      outputFolder,
                                      time
                                  }: {
        inputFile: string,
        outputFileName: string,
        outputFolder: string,
        time: number
    }): Promise<void> {
        const totalDuration = await FfmpegService.duration(inputFile);
        const timeStr = TimeUtil.secondToTimeStr(Math.min(time, totalDuration));
        console.log('timeStr', timeStr);
        await Lock.sync('ffmpeg', async () => {
            await new Promise((resolve, reject) => {
                ffmpeg(inputFile)
                    .screenshots({
                        timestamps: [timeStr],
                        filename: outputFileName,
                        folder: outputFolder,
                        size: '320x?'
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        });

    }
}

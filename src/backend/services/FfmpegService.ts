import ffmpeg from 'fluent-ffmpeg';
import ffmpeg_static from 'ffmpeg-static';
import ffprobe_static from 'ffprobe-static';
import Lock from '@/common/utils/Lock';
import TimeUtil from '@/common/utils/TimeUtil';
import {spawn} from 'child_process';
import a from '@/common/utils/a';
import path from "path";
import fs from "fs";

export default class FfmpegService {
    static {
        ffmpeg.setFfmpegPath(ffmpeg_static);
        ffmpeg.setFfprobePath(ffprobe_static.path);
    }

    /**
     * ffmpeg -y -ss {} -t {} -accurate_seek -i {} -codec copy  -avoid_negative_ts 1 {}
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
        console.log('splitVideo', inputFile, startSecond, endSecond, outputFile);
        await Lock.sync('ffmpeg', async () => {
            await new Promise((resolve, reject) => {
                const ff = spawn(ffmpeg_static, [
                    '-y',
                    '-ss', TimeUtil.secondToTimeStrWithMs(startSecond),
                    '-t', (endSecond - startSecond).toString(),
                    '-accurate_seek',
                    '-i', inputFile,
                    '-codec', 'copy',
                    '-avoid_negative_ts', '1',
                    outputFile
                ]);


                ff.on('close', (code) => {
                    console.log(`child process exited with code ${code}`);
                    resolve(null);
                });

                ff.on('error', (error) => {
                    console.log('An error occurred while executing ffmpeg command:', error);
                    reject(error);
                });
            });
        });
    }


    public static async splitMp3({
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

        console.log('splitMp3', inputFile, startSecond, endSecond, outputFile);
        await Lock.sync('ffmpeg', async () => {
                await new Promise((resolve, reject) => {
                        ffmpeg(inputFile)
                            .setStartTime(TimeUtil.secondToTimeStr(startSecond))
                            .setDuration(TimeUtil.secondToTimeStr(endSecond - startSecond))
                            .output(outputFile)
                            .on('end', resolve)
                            .on('error', reject)
                            .run();
                    }
                );
            }
        );
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


    /**
     * 获取视频关键帧的时间戳
     * F:\DashPlayer\node_modules\ffprobe-static\bin\win32\x64>ffprobe -read_intervals 500%510 -v error -skip_frame nokey -show_entries frame=pkt_pts_time -select_streams v -of csv=p=0 test.mp4
     * 496.533333
     * 501.600000
     * 506.666667
     */
    public static async keyFrameAt(filePath: string, time: number) {
        if (time <= 10) return 0;
        const out = await new Promise((resolve, reject) => {
            const ff = spawn(ffprobe_static.path, [
                '-read_intervals', `${time - 100}%${time}`,
                '-v', 'error',
                '-skip_frame', 'nokey',
                '-show_entries', 'frame=pkt_pts_time',
                '-select_streams', 'v',
                '-of', 'csv=p=0',
                filePath
            ]);

            let keyFrameTime: string = null;
            ff.stdout.on('data', (data) => {
                const str = data.toString();
                console.log('keyFrameAt', str);
                keyFrameTime = data.toString();
            });

            ff.on('close', (code) => {
                console.log(`ffprobe process exited with code ${code}`);
                resolve(keyFrameTime);
            });

            ff.on('error', (error) => {
                console.log('An error occurred while executing ffprobe command:', error);
                reject(error);
            });
        });
        return Number(out);
    }


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


    /**
     * ffmpeg -i input.mp4 -vn -f segment -segment_time 600 -acodec libmp3lame -qscale:a 9 output%d.mp3
     * @param inputFile
     * @param outputFolder
     * @param segmentTime
     */
    public static async splitToAudio({
                                         inputFile,
                                         outputFolder,
                                         segmentTime,
                                     }: {
        inputFile: string,
        outputFolder: string,
        segmentTime: number,
    }): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const outputFormat = path.join(outputFolder, 'output_%03d.mp3');
            ffmpeg(inputFile)
                .outputOptions([
                    '-vn',
                    '-f', 'segment',
                    '-segment_time', `${segmentTime}`,
                    '-acodec', 'libmp3lame',
                    '-qscale:a', '9'
                ])
                .output(outputFormat)
                .on('end', () => {
                    // Get the list of files in the output directory
                    fs.readdir(outputFolder, (err, files) => {
                        if (err) {
                            reject(err);
                        } else {
                            // Filter the files to only include .mp3 files
                            const outputFiles = files.filter(file => path.extname(file) === '.mp3')
                                .map(file => path.join(outputFolder, file));
                            resolve(outputFiles);
                        }
                    });
                })
                .on('error', reject)
                .run();
        });
    }
}

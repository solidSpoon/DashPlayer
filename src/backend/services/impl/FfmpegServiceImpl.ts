import { WaitLock } from '@/common/utils/Lock';
import TimeUtil from '@/common/utils/TimeUtil';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import FileUtil from '@/backend/utils/FileUtil';
import { inject, injectable, postConstruct } from 'inversify';
import TYPES from '@/backend/ioc/types';
import FfmpegService from '@/backend/services/FfmpegService';
import FfmpegTask from '@/backend/objs/FfmpegTask';
import DpTaskService from '@/backend/services/DpTaskService';
import CancelByUserError from '@/backend/errors/CancelByUserError';
import dpLog from '@/backend/ioc/logger';
import ffmpeg from 'fluent-ffmpeg';
import LocationService, { ProgramType } from '@/backend/services/LocationService';

@injectable()
export default class FfmpegServiceImpl implements FfmpegService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;
    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    /**
     * ffmpeg -y -ss {} -t {} -accurate_seek -i {} -codec copy  -avoid_negative_ts 1 {}
     *
     */
    @WaitLock('ffmpeg')
    @ErrorHandler()
    @logParams()
    public async splitVideo({
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

        const args = [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(startSecond),
            '-t', (endSecond - startSecond).toString(),
            '-accurate_seek',
            '-i', inputFile,
            '-codec', 'copy',
            '-avoid_negative_ts', '1',
            outputFile
        ];
        await this.runFfmpegCommand(args);
    }

    /**
     * ffmpeg.exe -i "In.mp4" -f segment -segment_times 00:00:06.165,00:00:14.293 -c copy -map 0 "Out_%%02d.mp4"
     */
    @WaitLock('ffmpeg')
    @logParams()
    public async splitVideoByTimes({
                                       inputFile,
                                       times,
                                       outputFolder,
                                       outputFilePrefix
                                   }: {
        inputFile: string,
        times: number[],
        outputFolder: string,
        outputFilePrefix: string
    }): Promise<string[]> {
        // 设置扩展名和输入相同
        const outputFormat = path.join(outputFolder, `${outputFilePrefix}_%03d${path.extname(inputFile)}`);
        const ffmpegCommand = ffmpeg(inputFile)
            .outputOptions([
                '-f', 'segment',
                '-segment_times', times.map(t => TimeUtil.secondToTimeStr(t)).join(','),
                '-c', 'copy',
                '-map', '0',
                '-reset_timestamps', '1'
            ])
            .output(outputFormat);
        await this.runFluentFfmpeg(ffmpegCommand);
        const files = await FileUtil.listFiles(outputFolder);
        // Filter the files to start with the output file prefix
        return files.filter(file => file.startsWith(outputFilePrefix))
            .map(file => path.join(outputFolder, file));
    }


    @WaitLock('ffprobe')
    @logParams()
    public async duration(filePath: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata.format.duration ?? 0);
            });
        });
    }


    /**
     * 截取视频的缩略图
     *
     * input: eg:视频文件路径 /a/b/c.mp4
     * output: eg:缩略图文件路径 /a/b/c.jpg
     */
    @WaitLock('ffmpeg')
    @logParams()
    public async thumbnail({
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
        const totalDuration = await this.duration(inputFile);
        const timeStr = TimeUtil.secondToTimeStr(Math.min(time, totalDuration));
        console.log('timeStr', timeStr);
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }
        const ffmpegCommand = ffmpeg(inputFile)
            .screenshots({
                timestamps: [timeStr],
                filename: outputFileName,
                folder: outputFolder,
                size: '320x?'
            });
        await new Promise<void>((resolve, reject) => {
            ffmpegCommand.on('end', () => resolve()).on('error', (err) => reject(err));
        });
    }


    /**
     * ffmpeg -i input.mp4 -vn -f segment -segment_time 600 -acodec libmp3lame -qscale:a 9 output%d.mp3
     * @param taskId
     * @param inputFile
     * @param outputFolder
     * @param segmentTime
     */
    @WaitLock('ffmpeg')
    @ErrorHandler()
    @logParams()
    public async splitToAudio({
                                  taskId,
                                  inputFile,
                                  outputFolder,
                                  segmentTime
                              }: {
        taskId: number,
        inputFile: string,
        outputFolder: string,
        segmentTime: number,
    }): Promise<string[]> {
        const outputFormat = path.join(outputFolder, 'output_%03d.mp3');
        const command = ffmpeg(inputFile)
            .outputOptions([
                '-vn',
                '-f', 'segment',
                '-segment_time', `${segmentTime}`,
                '-acodec', 'libmp3lame',
                '-qscale:a', '9'
            ])
            .output(outputFormat);

        this.dpTaskService.registerTask(taskId, new FfmpegTask(command));
        await this.runFluentFfmpeg(command);
        // Get the list of files in the output directory
        const files = await fs.promises.readdir(outputFolder);

        // Filter the files to only include .mp3 files
        return files
            .filter(file => path.extname(file) === '.mp3')
            .map(file => path.join(outputFolder, file));
    }

    /**
     * 视频转为mp4
     * ffmpeg -i input.mp4 -c:v libx264 -c:a aac output.mp4
     */
    @WaitLock('ffmpeg')
    @logParams()
    public async toMp4({
                           inputFile,
                           onProgress
                       }: {
        inputFile: string,
        onProgress?: (progress: number) => void
    }): Promise<string> {
        const output = inputFile.replace(path.extname(inputFile), '.mp4');
        const listener = (progress: { percent: number; }) => {
            if (progress.percent) {
                console.log('progress', progress.percent);
                if (onProgress) {
                    onProgress(progress.percent);
                }
            }
        };
        const ffmpegCommand = ffmpeg(inputFile)
            .output(output)
            .on('progress', listener);
        await this.runFluentFfmpeg(ffmpegCommand);
        return output;
    }

    /**
     * mkv转mp4
     * ffmpeg -i "vid.mkv" -map 0 -c copy -c:a aac "MP4/vid.mp4"
     * ffmpeg -i output.mkv -map 0:v -map 0:a -c:v copy -c:a aac -ac 1 output.mp4
     */
    @WaitLock('ffmpeg')
    @ErrorHandler()
    @logParams()
    public async mkvToMp4({
                              taskId,
                              inputFile,
                              onProgress
                          }: {
        taskId: number,
        inputFile: string,
        onProgress?: (progress: number) => void
    }): Promise<string> {
        const output = inputFile.replace(path.extname(inputFile), '.mp4');

        const command = ffmpeg(inputFile)
            .outputOptions([
                '-map', '0:v',
                '-map', '0:a',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-ac', '1'
            ])
            .output(output)
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log('progress', progress.percent);
                    if (onProgress) {
                        onProgress(progress.percent);
                    }
                }
            });
        this.dpTaskService.registerTask(taskId, new FfmpegTask(command));
        await this.runFluentFfmpeg(command);
        return output;
    }

    /**
     * 提取字幕
     * ffmpeg -i "vid.mkv" -map 0:s:m:language:eng? -map 0:s:0? -c:s srt "vid.srt"
     */
    @WaitLock('ffmpeg')
    @ErrorHandler()
    @logParams()
    public async extractSubtitles({
                                      taskId,
                                      inputFile,
                                      onProgress,
                                      en
                                  }: {
        taskId: number,
        inputFile: string,
        onProgress?: (progress: number) => void,
        en: boolean
    }): Promise<string> {
        const outputSubtitle = inputFile.replace(path.extname(inputFile), '.srt');
        const mapSrt = en ? '0:s:m:language:eng?' : '0:s:0?';
        const command = ffmpeg(inputFile)
            .outputOptions([
                '-map', mapSrt,
                '-c:s', 'srt' // 输出格式为 srt
            ])
            .output(outputSubtitle)
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log('progress', progress.percent);
                    if (onProgress) {
                        onProgress(progress.percent);
                    }
                }
            });
        this.dpTaskService.registerTask(taskId, new FfmpegTask(command));
        await this.runFluentFfmpeg(command);
        return outputSubtitle;
    }

    /**
     * 截取视频的一部分并保存到指定路径。
     * @param {string} inputPath - 原视频文件的路径。
     * @param {number} startTime - 截取开始时间（秒）。
     * @param {number} endTime - 截取结束时间（秒）。
     * @param {string} outputPath - 输出视频文件的路径。
     */
    @WaitLock('ffmpeg')
    @logParams()
    public async trimVideo(inputPath: string, startTime: number, endTime: number, outputPath: string) {
        const duration = endTime - startTime;
        const ffmpegCommand = ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(duration)
            .audioChannels(1)
            .videoCodec('libx265')
            .audioCodec('aac')
            .audioBitrate('64k')
            .outputOptions(['-crf 28', '-vf scale=640:-1'])
            .output(outputPath)
            .on('start', function(commandLine) {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            });
        await this.runFluentFfmpeg(ffmpegCommand);
    }

    private async runFluentFfmpeg(ffmpegCommand: ffmpeg.FfmpegCommand): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            ffmpegCommand
                .on('start', (commandLine) => {
                    dpLog.log('Spawned Ffmpeg with command:', commandLine);
                })
                .on('end', () => {
                    dpLog.log('Ffmpeg command completed successfully');
                    resolve();
                })
                .on('error', (error) => {
                    dpLog.error('An error occurred while executing ffmpeg command:', error);
                    reject(error);
                }).run();
        });
    }

    private async runFfmpegCommand(args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const ff = spawn(this.locationService.getProgramPath(ProgramType.FFMPEG), args);
            ff.on('close', (code) => {
                dpLog.log(`child process exited with code ${code}`);
                resolve();
            });
            ff.on('error', (error) => {
                dpLog.error('An error occurred while executing ffmpeg command:', error);
                reject(error);
            });
        });
    }

    @postConstruct()
    private init() {
        ffmpeg.setFfmpegPath(this.locationService.getProgramPath(ProgramType.FFMPEG));
        ffmpeg.setFfprobePath(this.locationService.getProgramPath(ProgramType.FFPROBE));
    }
}


function ErrorHandler() {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function(...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (e) {
                if (e instanceof Error && e.message === 'ffmpeg was killed with signal SIGKILL') {
                    throw new CancelByUserError();
                }
                throw e;
            }
        };
        return descriptor;
    };
}

function logParams() {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function(...args: any[]) {
            dpLog.log(`func-log Entering ${propertyKey} with arguments:`, args);
            const result = originalMethod.apply(this, args);
            dpLog.log(`func-log Exiting ${propertyKey} with value:`, result);
            return result;
        };

        return descriptor;
    };
}

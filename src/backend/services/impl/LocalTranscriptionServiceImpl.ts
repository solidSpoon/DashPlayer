import {injectable, inject} from 'inversify';
import {TranscriptionService} from '@/backend/services/TranscriptionService';
import SettingService from '@/backend/services/SettingService';
import SystemService from '@/backend/services/SystemService';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import LocationUtil from '@/backend/utils/LocationUtil';
import {LocationType} from '@/backend/services/LocationService';
import FfmpegService from '@/backend/services/FfmpegService';
import {getMainLogger} from '@/backend/ioc/simple-logger';
import objectHash from 'object-hash';
import SrtUtil, {SrtLine} from "@/common/utils/SrtUtil";
@injectable()
export class LocalTranscriptionServiceImpl implements TranscriptionService {
    private currentTaskId: number | null = null;
    private cancelRequested = false;

    private logger = getMainLogger('LocalTranscriptionService');

    // 动态获取路径方法
    constructor(
        @inject(TYPES.SettingService) private settingService: SettingService,
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.SystemService) private systemService: SystemService
    ) {
    }

    // 将任意音频转为 16k 单声道 WAV（whisper.cpp2 可直接读多格式，但转为标准更稳）
    private async ensureWavFormat(inputPath: string): Promise<string> {
        const tempDir = LocationUtil.staticGetStoragePath(LocationType.TEMP);
        await fsPromises.mkdir(tempDir, {recursive: true});
        const out = path.join(tempDir, `converted_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
        await this.ffmpegService.convertToWav(inputPath, out);
        return out;
    }


    private sendProgress(taskId: number, filePath: string, status: string, progress: number, result?: any) {
        this.systemService.callRendererApi('transcript/batch-result', {
            updates: [{
                filePath,
                taskId,
                status,
                progress,
                result
            }]
        });
    }

    public async transcribe(taskId: number, filePath: string): Promise<void> {
        this.currentTaskId = taskId;
        this.cancelRequested = false;


        let processedAudioPath: string | null = null;
        let tempFolder: string | null = null;

        try {
            this.sendProgress(taskId, filePath, 'init', 0);
            this.sendProgress(taskId, filePath, 'processing', 5, { message: '开始音频转录...' });

            // 音频预处理
            this.sendProgress(taskId, filePath, 'processing', 5, { message: '音频预处理（转换为 16k WAV）...' });
            processedAudioPath = await this.ensureWavFormat(filePath);

            // 创建临时文件夹
            const folderName = objectHash(filePath);
            tempFolder = path.join(LocationUtil.staticGetStoragePath(LocationType.TEMP), 'parakeet', folderName);
            await fsPromises.mkdir(tempFolder, {recursive: true});

            // 分割音频
            this.sendProgress(taskId, filePath, 'processing', 10, { message: '分割音频为小段落...' });
            const segmentFiles = await this.ffmpegService.splitToAudio({
                taskId,
                inputFile: processedAudioPath,
                outputFolder: tempFolder,
                segmentTime: 60, // 60秒一段
                onProgress: (progress) => {
                    const totalProgress = 10 + (progress * 0.2); // 10-30%
                    this.sendProgress(taskId, filePath, 'processing', Math.floor(totalProgress), { message: `分割音频 ${Math.floor(progress * 100)}%` });
                }
            });

            // 分段转录（串行处理）
            this.sendProgress(taskId, filePath, 'processing', 30, { message: `开始分段转录（共 ${segmentFiles.length} 段）...` });

            const transcribedSegments: Array<{ start: number; end: number; text: string }> = [];
            const allWords: Array<{ word: string; start: number; end: number }> = [];

            let currentOffset = 0;
            let completedCount = 0;

            for (let i = 0; i < segmentFiles.length; i++) {
                // 检查是否取消
                if (this.cancelRequested) {
                    throw new Error('Transcription cancelled by user');
                }

                const segmentFile = segmentFiles[i];
                const segmentDuration = await this.ffmpegService.duration(segmentFile);

                const progress = 30 + ((completedCount / segmentFiles.length) * 0.6); // 30-90%
                this.sendProgress(taskId, filePath, 'processing', Math.floor(progress), { message: `转录段落 ${i + 1}/${segmentFiles.length}...` });

                try {
                    const segmentResult = await this.transcribeSegment(
                        segmentFile,
                        currentOffset,
                        segmentDuration
                    );

                    if (segmentResult.text && segmentResult.words.length > 0) {
                        transcribedSegments.push({
                            start: currentOffset,
                            end: currentOffset + segmentDuration,
                            text: segmentResult.text
                        });
                        allWords.push(...segmentResult.words);
                    }

                    completedCount++;

                } catch (segmentError) {
                    this.logger.warn(`Failed to transcribe segment ${i + 1}`, segmentError);
                    // 继续处理下一个段落
                } finally {
                    currentOffset += segmentDuration;
                }
            }

            // 合并结果并生成SRT
            this.sendProgress(taskId, filePath, 'processing', 95, { message: '合并转录结果...' });

            // 用"词级时间轴"生成"细分句级/短句级"的字幕段
            const fineSegments = this.createSegmentsFromWordTimeline(allWords);

            // 生成SRT文件
            const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
            const srtContent = this.segmentsToSrt(fineSegments);
            fs.writeFileSync(srtFileName, srtContent);

            this.sendProgress(taskId, filePath, 'completed', 100, { srtPath: srtFileName });

        } catch (error) {
            if (this.cancelRequested) {
                this.sendProgress(taskId, filePath, 'cancelled', 0, { message: '转录任务已取消' });
            } else {
                this.sendProgress(taskId, filePath, 'failed', 0, { error: error instanceof Error ? error.message : String(error) });
            }
            throw error;
        } finally {
            this.currentTaskId = null;
            this.cancelRequested = false;

            // 清理临时文件
            try {
                if (processedAudioPath) await fsPromises.rm(processedAudioPath, {force: true});
                if (tempFolder) {
                    await fsPromises.rm(tempFolder, {recursive: true, force: true});
                }
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup temporary files', {cleanupError});
            }
        }
    }

    public cancel(taskId: number): boolean {
        if (this.currentTaskId === taskId) {
            this.cancelRequested = true;
            return true;
        }
        return false;
    }

    // 转录单个段落
    private async transcribeSegment(
        segmentPath: string,
        timeOffset: number,
        duration: number
    ): Promise<{
        text: string;
        words: Array<{ word: string; start: number; end: number }>;
    }> {
        try {
            const Echogarden = await import('echogarden');

            // 设置 whisper.cpp 可执行文件路径
            const {app} = await import('electron');
            const isPackaged = app.isPackaged;

            let basePath: string;
            if (isPackaged) {
                basePath = process.env.APP_PATH || path.join(app.getAppPath(), '..', '..', 'lib', 'whisper.cpp');
            } else {
                basePath = path.join(process.cwd(), 'lib', 'whisper.cpp');
            }

            const platform = process.platform; // 'darwin' | 'linux' | 'win32'
            const arch = process.arch;         // 'arm64' | 'x64' | ...
            const archDir = arch === 'arm64' ? 'arm64' : 'x64';

            let binaryPath: string;
            if (platform === 'darwin') {
                binaryPath = path.join(basePath, archDir, 'darwin', 'main');
            } else if (platform === 'linux') {
                binaryPath = path.join(basePath, archDir, 'linux', 'main');
            } else if (platform === 'win32') {
                binaryPath = path.join(basePath, archDir, 'win32', 'main.exe');
            } else {
                throw new Error(`Unsupported platform: ${platform} ${arch}`);
            }

            // 添加二进制存在性检查
            this.logger.debug('Resolve whisper.cpp binary', { basePath, platform, arch, binaryPath, exists: fs.existsSync(binaryPath) });
            if (!fs.existsSync(binaryPath)) {
                throw new Error(`whisper.cpp binary not found: ${binaryPath}`);
            }

            // 修正语言配置以匹配模型
            const result = await Echogarden.recognize(segmentPath, {
                engine: 'whisper.cpp',
                language: 'en',
                whisperCpp: {
                    model: 'base.en',
                    executablePath: binaryPath,
                    enableDTW: true,
                    enableFlashAttention: false,
                    splitCount: 1,
                    threadCount: 4
                }
            });

            // 处理结果，添加时间偏移
            const words = result.wordTimeline?.map((entry: any) => ({
                word: entry.text || '',
                start: (entry.startTime || 0) + timeOffset,
                end: (entry.endTime || 0) + timeOffset
            })) || [];

            return {
                text: result.transcript || '',
                words
            };

        } catch (error) {
            this.logger.error('Segment transcription failed', {segmentPath, timeOffset, error});
            throw error;
        }
    }

    // 从词级时间轴生成细分句级字幕段
    private createSegmentsFromWordTimeline(words: Array<{ word: string; start: number; end: number }>): Array<{ start: number; end: number; text: string }> {
        if (!words || words.length === 0) return [];

        const segments: Array<{ start: number; end: number; text: string }> = [];
        let currentSegment: { start: number; end: number; words: string[] } | null = null;

        for (const word of words) {
            const wordText = word.word.trim();
            if (!wordText) continue;

            // 判断是否需要新段落：句号、问号、感叹号，或者当前段落长度超过限制
            const needsNewSegment = !currentSegment ||
                wordText.match(/[.!?。！？]/) ||
                (currentSegment.words.length > 0 && currentSegment.end - currentSegment.start > 5000); // 5秒限制

            if (needsNewSegment) {
                if (currentSegment && currentSegment.words.length > 0) {
                    segments.push({
                        start: currentSegment.start,
                        end: currentSegment.end,
                        text: currentSegment.words.join(' ')
                    });
                }
                currentSegment = {
                    start: word.start,
                    end: word.end,
                    words: [wordText]
                };
            } else if (currentSegment) {
                currentSegment.words.push(wordText);
                currentSegment.end = word.end;
            }
        }

        // 添加最后一个段落
        if (currentSegment && currentSegment.words.length > 0) {
            segments.push({
                start: currentSegment.start,
                end: currentSegment.end,
                text: currentSegment.words.join(' ')
            });
        }

        return segments;
    }

    // 将segments转换为SRT格式
    private segmentsToSrt(segments: Array<{ start: number; end: number; text: string }>): string {
        const lines: SrtLine[] = segments.map((segment, index) => ({
            index: index + 1,
            start: segment.start,
            end: segment.end,
            contentEn: segment.text,
            contentZh: ''
        }));

        return SrtUtil.srtLinesToSrt(lines, {
            reindex: true,
        });
    }
}

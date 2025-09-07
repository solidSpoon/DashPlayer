import {injectable, inject} from 'inversify';
import {ParakeetService} from '@/backend/services/ParakeetService';
import SettingService from '@/backend/services/SettingService';
import DpTaskService from '@/backend/services/DpTaskService';
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


interface TranscriptionResult {
    text?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
    words?: Array<{ word: string; start: number; end: number }>;
    timestamps?: Array<{ token: string; start: number; end: number }>;
}

function isWindows() {
    return process.platform === 'win32';
}

async function isExecutable(p: string) {
    try {
        if (isWindows()) {
            // Windows 不区分可执行位，存在即可
            await fsPromises.access(p, fs.constants.F_OK);
            return true;
        }
        await fsPromises.access(p, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}


function binName() {
    if (isWindows()) {
        return 'whisper.exe';
    } else if (process.platform === 'darwin') {
        return 'whisper-cli';
    } else {
        return 'whisper';
    }
}

async function fileExists(p: string) {
    try {
        await fsPromises.access(p, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}


@injectable()
export class ParakeetServiceImpl implements ParakeetService {
    private initialized = false;
    private cancelFlags: Map<number, boolean> = new Map(); // 简单的取消标记

    private logger = getMainLogger('ParakeetServiceImpl');

    // 动态获取路径方法
    private getModelRoot(): string {
        return path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'whisper-asr');
    }

    private getModelPath(): string {
        return path.join(this.getModelRoot(), 'ggml-base.bin');
    }

    private getBinaryPath(): string {
        return path.join(this.getModelRoot(), binName());
    }

    constructor(
        @inject(TYPES.SettingService) private settingService: SettingService,
        @inject(TYPES.DpTaskService) private taskService: DpTaskService,
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.SystemService) private systemService: SystemService
    ) {
    }

    private async ensureDirs() {
        await fsPromises.mkdir(this.getModelRoot(), {recursive: true});
    }

    // 将任意音频转为 16k 单声道 WAV（whisper.cpp2 可直接读多格式，但转为标准更稳）
    private async ensureWavFormat(inputPath: string): Promise<string> {
        const tempDir = LocationUtil.staticGetStoragePath(LocationType.TEMP);
        await fsPromises.mkdir(tempDir, {recursive: true});
        const out = path.join(tempDir, `converted_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
        await this.ffmpegService.convertToWav(inputPath, out);
        return out;
    }

    async isModelDownloaded(): Promise<boolean> {
        const modelOk = await fileExists(this.getModelPath());
        const binOk = await fileExists(this.getBinaryPath());
        // 进一步校验可执行权限（POSIX）
        const execOk = binOk ? await isExecutable(this.getBinaryPath()) : false;
        return modelOk && binOk && execOk;
    }


    async initialize(): Promise<void> {
        if (this.initialized) return;

        // 初始化Echogarden服务
        // echogarden 库不需要显式初始化

        await this.ensureDirs();

        const ok = await this.isModelDownloaded();
        if (!ok) {
            throw new Error('whisper.cpp2 模型或可执行文件不存在，请确保模型文件已正确安装');
        }

        this.initialized = true;
    }

    // 参考 OpenAI Whisper 的分段转录方法
    async transcribeAudio(taskId: number, audioPath: string, filePath?: string): Promise<TranscriptionResult> {
        // 清除之前的取消标记
        this.cancelFlags.delete(taskId);

        // 发送开始状态
        this.systemService.callRendererApi('transcript/batch-result', {
            updates: [{
                filePath: filePath || '',
                taskId,
                status: 'processing',
                progress: 5,
                result: { message: '开始音频转录...' }
            }]
        });

        this.logger.info('TRANSCRIPTION METHOD CALLED', {taskId, audioPath});

        if (!this.initialized) {
            await this.initialize();
        }

        let processedAudioPath: string | null = null;
        let tempFolder: string | null = null;

        try {
            // 更新进度
            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath: filePath || '',
                    taskId,
                    status: 'processing',
                    progress: 5,
                    result: { message: '音频预处理（转换为 16k WAV）...' }
                }]
            });
            processedAudioPath = await this.ensureWavFormat(audioPath);

            // 创建临时文件夹（参考 WhisperService 的方式）
            const folderName = objectHash(audioPath);
            tempFolder = path.join(LocationUtil.staticGetStoragePath(LocationType.TEMP), 'parakeet', folderName);
            await fsPromises.mkdir(tempFolder, {recursive: true});

            // 更新进度
            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath: filePath || '',
                    taskId,
                    status: 'processing',
                    progress: 10,
                    result: { message: '分割音频为小段落...' }
                }]
            });
            this.logger.info('SPLITTING AUDIO INTO SEGMENTS', {tempFolder});

            // 使用 ffmpegService.splitToAudio 分割音频（60秒一段，参考 OpenAI）
            const segmentFiles = await this.ffmpegService.splitToAudio({
                taskId,
                inputFile: processedAudioPath,
                outputFolder: tempFolder,
                segmentTime: 60, // 60秒一段，与OpenAI相同
                onProgress: (progress) => {
                    const totalProgress = 10 + (progress * 0.2); // 10-30%
                    this.systemService.callRendererApi('transcript/batch-result', {
                        updates: [{
                            filePath: filePath || '',
                            taskId,
                            status: 'processing',
                            progress: Math.floor(totalProgress),
                            result: { message: `分割音频 ${Math.floor(progress * 100)}%` }
                        }]
                    });
                }
            });

            this.logger.info('AUDIO SPLITTING COMPLETED', {segments: segmentFiles.length});

            // 2. 分段转录
            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath: filePath || '',
                    taskId,
                    status: 'processing',
                    progress: 30,
                    result: { message: `开始分段转录（共 ${segmentFiles.length} 段）...` }
                }]
            });

            const transcribedSegments: Array<{ start: number; end: number; text: string }> = [];
            const allWords: Array<{ word: string; start: number; end: number }> = [];

            let currentOffset = 0;
            let completedCount = 0;

            for (let i = 0; i < segmentFiles.length; i++) {
                // 检查是否取消
                if (this.cancelFlags.get(taskId)) {
                    this.systemService.callRendererApi('transcript/batch-result', {
                        updates: [{
                            filePath: filePath || '',
                            taskId,
                            status: 'cancelled',
                            progress: 0,
                            result: { message: '转录任务已取消' }
                        }]
                    });
                    throw new Error('Transcription cancelled by user');
                }

                const segmentFile = segmentFiles[i];
                const segmentDuration = await this.ffmpegService.duration(segmentFile);

                const progress = 30 + ((completedCount / segmentFiles.length) * 0.6); // 30-90%

                this.systemService.callRendererApi('transcript/batch-result', {
                    updates: [{
                        filePath: filePath || '',
                        taskId,
                        status: 'processing',
                        progress: Math.floor(progress),
                        result: { message: `转录段落 ${i + 1}/${segmentFiles.length}...` }
                    }]
                });

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

                        this.logger.debug(`Segment ${i + 1} transcribed`, {
                            offset: currentOffset,
                            duration: segmentDuration,
                            words: segmentResult.words.length,
                            text: segmentResult.text.substring(0, 50) + '...'
                        });
                    }

                    completedCount++;

                } catch (segmentError) {
                    this.logger.warn(`Failed to transcribe segment ${i + 1}`, segmentError);
                    // 继续处理下一个段落
                } finally {
                    currentOffset += segmentDuration;
                }
            }

            // 3. 合并结果（保留粗段 transcribedSegments 仅用于调试/统计）
            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath: filePath || '',
                    taskId,
                    status: 'processing',
                    progress: 95,
                    result: { message: '合并转录结果...' }
                }]
            });

            // 用"词级时间轴"生成"细分句级/短句级"的字幕段
            // 注意：allWords 的时间已经在 transcribeSegment 里加了 timeOffset，是全局绝对时间
            const fineSegments = this.createSegmentsFromWordTimeline(allWords);

            // 组合文本，建议用细分段的文本拼接，而不是 60s 粗段
            const combinedText = fineSegments
                .map(s => s.text)
                .filter(t => t.trim().length > 0)
                .join(' ');

            this.logger.info('SEGMENTED TRANSCRIPTION COMPLETED', {
                segments: fineSegments.length,          // ← 用细分段数量
                totalWords: allWords.length,
                textLength: combinedText.length
            });

            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath: filePath || '',
                    taskId,
                    status: 'completed',
                    progress: 100,
                    result: { message: '转录完成' }
                }]
            });

            return {
                text: combinedText,
                segments: fineSegments,                  // ← 用细分段生成 SRT
                words: allWords,
                timestamps: allWords.map(w => ({ token: w.word, start: w.start, end: w.end })),
            };

        } catch (err) {
            const error = err as Error;

            if (error.message === 'Transcription cancelled by user') {
                // 取消是正常情况，不需要特殊处理
            } else {
                this.systemService.callRendererApi('transcript/batch-result', {
                    updates: [{
                        filePath: filePath || '',
                        taskId,
                        status: 'failed',
                        progress: 0,
                        result: { message: `转录失败: ${error.message}` }
                    }]
                });
            }

            this.logger.error('=== ERROR: Transcription failed ===');
            this.logger.error('Error message:', error.message);
            this.logger.error('Error stack:', error.stack);
            this.logger.error('Error name:', error.name);

            throw err;
        } finally {
            // 清理临时文件
            try {
                if (processedAudioPath) await fsPromises.rm(processedAudioPath, {force: true});
                // 清理临时文件夹
                if (tempFolder) {
                    await fsPromises.rm(tempFolder, {recursive: true, force: true});
                }
            } catch (error) {
                this.logger.warn('Failed to cleanup temporary files', {error});
            }
        }
    }

    // 转录单个段落（简化版本）
    private async transcribeSegment(
        segmentPath: string,
        timeOffset: number,
        duration: number
    ): Promise<{
        text: string;
        words: Array<{ word: string; start: number; end: number }>;
    }> {
        this.logger.debug('Transcribing segment', {
            timeOffset,
            duration,
            segmentPath
        });

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

            const platform = process.platform;
            const arch = process.arch;

            let binaryPath: string;
            if (platform === 'darwin') {
                const archDir = arch === 'arm64' ? 'arm64' : 'x64';
                binaryPath = path.join(basePath, archDir, 'darwin', 'main');
            } else if (platform === 'linux') {
                const archDir = arch === 'arm64' ? 'arm64' : 'x64';
                binaryPath = path.join(basePath, archDir, 'linux', 'main');
            } else if (platform === 'win32') {
                const archDir = arch === 'arm64' ? 'arm64' : 'x64';
                binaryPath = path.join(basePath, archDir, 'win32', 'main.exe');
            } else {
                throw new Error(`Unsupported platform: ${platform} ${arch}`);
            }

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

            // 提取词级时间戳并应用时间偏移
            const words: Array<{ word: string; start: number; end: number }> = [];

            if (result.wordTimeline && result.wordTimeline.length > 0) {
                for (const entry of result.wordTimeline) {
                    const word = entry.text || ''; // 只使用 text 属性
                    const startTime = (entry.startTime || 0) + timeOffset;
                    const endTime = (entry.endTime || startTime + 0.5) + timeOffset;

                    if (word.trim()) {
                        words.push({
                            word: word.trim(),
                            start: Math.max(0, startTime),
                            end: Math.max(startTime, endTime)
                        });
                    }
                }
            }

            // 生成分段文本
            const text = words.map(w => w.word).join(' ');

            return {
                text,
                words
            };

        } catch (error) {
            this.logger.error('Segment transcription failed', error);
            throw error;
        }
    }

    async generateSrtFromResult(taskId: number, audioPath: string, outputPath: string, transcriptionResult: any): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        this.logger.debug(`=== SRT GENERATION DEBUG ===`);
        this.logger.debug(`Input audioPath: ${audioPath}`);
        this.logger.debug(`Output outputPath: ${outputPath}`);
        this.logger.debug(`Task ID: ${taskId}`);

        this.taskService.process(taskId, {progress: '准备生成 SRT...'});

        try {
            this.logger.debug('Step 1: Preparing SRT generation...');
            // 使用提供的转录结果或重新转录
            let result;
            if (transcriptionResult) {
                this.logger.debug('Using provided transcription result');
                result = transcriptionResult;
            } else {
                this.logger.debug('No transcription result provided, transcribing audio...');
                result = await this.transcribeAudio(taskId, audioPath);
            }

            this.logger.debug('Step 2: Transcription data ready');
            this.logger.debug(`Segments count: ${result.segments?.length || 0}`);
            this.logger.debug(`Words count: ${result.words?.length || 0}`);
            this.logger.debug(`Has text: ${!!result.text}`);

            if (!result.segments || result.segments.length === 0) {
                throw new Error('No segments available for SRT generation');
            }

            this.logger.debug('Step 3: Generating SRT content...');
            // 生成SRT格式内容
            const srtContent = this.segmentsToSrt(result.segments);

            this.logger.debug(`Step 4: SRT content generated, length: ${srtContent.length}`);
            this.logger.debug(`SRT preview: ${srtContent.substring(0, 200)}...`);

            this.logger.debug('Step 5: Writing SRT file...');
            // 使用专门的SRT写入方法（包含CRLF和BOM处理）
            await this.writeSrtFile(outputPath, srtContent);

            // 验证文件是否写入成功
            const fileExists = await fsPromises.access(outputPath).then(() => true).catch(() => false);
            const fileStats = fileExists ? await fsPromises.stat(outputPath) : null;

            this.logger.debug('Step 6: SRT file write verification');
            this.logger.debug(`File exists: ${fileExists}`);
            this.logger.debug(`File size: ${fileStats?.size || 0}`);

            if (!fileExists || !fileStats || fileStats.size === 0) {
                throw new Error(`SRT file write failed. Exists: ${fileExists}, Size: ${fileStats?.size}`);
            }

            this.logger.debug('=== SRT GENERATION SUCCESS ===');
            this.taskService.process(taskId, {progress: '字幕生成完成'});
        } catch (e) {
            const msg = (e as Error)?.message || String(e);
            this.logger.error('=== SRT GENERATION FAILED ===');
            this.logger.error('Error:', msg);
            this.logger.error('Stack:', (e as Error)?.stack);
            this.taskService.process(taskId, {progress: `字幕生成失败：${msg}`});
            throw e;
        }
    }

    // 新增：统一换行 + 可选 BOM
    private toCRLF(input: string): string {
        // 先把所有行结束统一成 \n，再转为 \r\n
        return input.replace(/\r\n|\r|\n/g, '\n').replace(/\n/g, '\r\n');
    }

    private withBOM(input: string): string {
        // 加 UTF-8 BOM
        return '\ufeff' + input;
    }

    // 将segments转换为SRT格式
    // 将segments转换为SRT格式
    private segmentsToSrt(segments: Array<{ start: number; end: number; text: string }>): string {
        const blocks = segments.map((segment, index) => {
            const startTime = this.formatSrtTime(segment.start);
            const endTime = this.formatSrtTime(segment.end);
            const text = (segment.text || '').trim();
            // 每个条目以 \r\n 结尾，条目之间留一个空行（即额外的 \r\n）
            return `${index + 1}\r\n${startTime} --> ${endTime}\r\n${text}\r\n`;
        });

        // 用 \r\n 连接条目，确保条目间空行，并在末尾补一个 \r\n
        const srt = blocks.join('\r\n') + '\r\n';
        return srt;
    }

    // 在写文件前调用规范化与加 BOM（更通用稳妥）
    private async writeSrtFile(outputPath: string, content: string) {
        this.logger.debug(`=== SRT WRITE DEBUG ===`);
        this.logger.debug(`Output path: ${outputPath}`);
        this.logger.debug(`Input content length: ${content.length}`);
        this.logger.debug(`Content preview: ${content.substring(0, 100)}...`);

        const crlf = this.toCRLF(content);
        this.logger.debug(`After CRLF conversion length: ${crlf.length}`);

        // 去掉可能的多余空行，并确保条目之间只有一个空行
        const normalized = crlf.replace(/\r\n\r\n\r\n+/g, '\r\n\r\n');
        this.logger.debug(`After normalization length: ${normalized.length}`);

        // 加 BOM（很多 Windows 播放器/编辑器更兼容）
        const finalContent = this.withBOM(normalized);
        this.logger.debug(`Final content with BOM length: ${finalContent.length}`);
        this.logger.debug(`First 20 bytes: ${Array.from(finalContent.substring(0, 20)).map(b => b.charCodeAt(0).toString(16)).join(' ')}`);

        try {
            await fsPromises.writeFile(outputPath, finalContent, 'utf8');
            this.logger.debug('SRT file write completed successfully');

            // 验证写入的文件
            const writtenContent = await fsPromises.readFile(outputPath, 'utf8');
            this.logger.debug(`Verification - written file length: ${writtenContent.length}`);
            this.logger.debug(`Verification - first 20 bytes: ${Array.from(writtenContent.substring(0, 20)).map(b => b.charCodeAt(0).toString(16)).join(' ')}`);

        } catch (writeError) {
            this.logger.error('SRT file write failed:', writeError);
            throw writeError;
        }

        this.logger.debug(`=== SRT WRITE COMPLETE ===`);
    }

    // 格式化时间为SRT格式 (HH:MM:SS,mmm)
    private formatSrtTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
    }

    // 提取词级别时间轴
    private extractWordTimeline(timeline: any[]): Array<{ word: string; start: number; end: number }> {
        const words: Array<{ word: string; start: number; end: number }> = [];

        if (!Array.isArray(timeline) || timeline.length === 0) {
            return words;
        }

        for (const entry of timeline) {
            try {
                // 处理不同格式的时间轴条目
                const word = entry.text || entry.word || entry.token || '';
                const startTime = entry.startTime || entry.start || entry.begin || 0;
                const endTime = entry.endTime || entry.end || entry.finish || startTime + 0.5;

                if (word.trim() && typeof startTime === 'number' && typeof endTime === 'number') {
                    words.push({
                        word: word.trim(),
                        start: Math.max(0, startTime),
                        end: Math.max(startTime, endTime)
                    });
                }
            } catch (error) {
                this.logger.warn('Error processing timeline entry:', {error, entry});
            }
        }

        // 按开始时间排序
        words.sort((a, b) => a.start - b.start);

        // 验证时间轴的连续性
        for (let i = 1; i < words.length; i++) {
            if (words[i].start < words[i - 1].end) {
                // 修复重叠的时间戳
                words[i].start = words[i - 1].end;
            }
        }

        return words;
    }


    // 基于词级别时间轴创建分段
    private createSegmentsFromWordTimeline(words: Array<{ word: string; start: number; end: number }>): Array<{
        start: number;
        end: number;
        text: string
    }> {
        const segments: Array<{ start: number; end: number; text: string }> = [];

        if (words.length === 0) return segments;

        let currentSegment: { words: typeof words; start: number; end: number } = {
            words: [],
            start: words[0].start,
            end: words[0].end
        };

        for (const word of words) {
            currentSegment.words.push(word);
            currentSegment.end = word.end;

            // 分段条件检查
            const shouldSplit = this.shouldSplitSegment(currentSegment.words, word);

            if (shouldSplit) {
                // 创建分段
                const segmentText = currentSegment.words.map(w => w.word).join(' ').trim();
                if (segmentText.length > 0) {
                    segments.push({
                        start: currentSegment.start,
                        end: currentSegment.end,
                        text: segmentText
                    });
                }

                // 开始新分段
                const nextIndex = words.indexOf(word) + 1;
                if (nextIndex < words.length) {
                    currentSegment = {
                        words: [],
                        start: words[nextIndex].start,
                        end: words[nextIndex].end
                    };
                }
            }
        }

        // 处理最后一个分段
        if (currentSegment.words.length > 0) {
            const segmentText = currentSegment.words.map(w => w.word).join(' ').trim();
            if (segmentText.length > 0) {
                segments.push({
                    start: currentSegment.start,
                    end: currentSegment.end,
                    text: segmentText
                });
            }
        }

        return segments;
    }

    // 判断是否需要分段
    private shouldSplitSegment(words: Array<{ word: string; start: number; end: number }>, currentWord: {
        word: string
    }): boolean {
        const currentText = words.map(w => w.word).join(' ');

        // 1. 基于时长（最大8秒）
        if (words.length > 0) {
            const duration = words[words.length - 1].end - words[0].start;
            if (duration >= 8.0) return true;
        }

        // 2. 基于词数（最多15个词）
        if (words.length >= 15) return true;

        // 3. 基于字符数（最多100个字符）
        if (currentText.length >= 100) return true;

        // 4. 基于句子结束符号
        const sentenceEnders = /[.!?。！？]+$/;
        if (sentenceEnders.test(currentWord.word) && words.length >= 3) return true;

        // 5. 基于子句符号
        const clauseBreakers = /[,;，；]+$/;
        if (clauseBreakers.test(currentWord.word) && words.length >= 8) return true;

        return false;
    }


    // 取消转录任务
    cancelTranscription(taskId: number): boolean {
        if (this.cancelFlags.has(taskId)) {
            return false; // 已经取消了
        }
        this.cancelFlags.set(taskId, true);
        this.logger.info('Cancel requested for task', { taskId });
        return true;
    }

    // 获取任务状态
    getTaskStatus(taskId: number): any {
        return {
            cancelled: this.cancelFlags.get(taskId) || false
        };
    }

    // 获取所有活跃任务
    getActiveTasks(): any[] {
        // 简化实现，返回空数组
        return [];
    }

    dispose(): void {
        this.initialized = false;
        this.cancelFlags.clear();
    }
}

export default ParakeetServiceImpl;

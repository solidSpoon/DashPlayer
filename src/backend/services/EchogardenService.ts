import { injectable, inject } from 'inversify';
import { ipcMain } from 'electron';
import * as Echogarden from 'echogarden/dist/api/API.js';
import {
    encodeRawAudioToWave,
    decodeWaveToRawAudio,
    ensureRawAudio,
    getRawAudioDuration,
    trimAudioStart,
    trimAudioEnd,
    AudioSourceParam,
} from 'echogarden/dist/audio/AudioUtilities.js';
import { wordTimelineToSegmentSentenceTimeline } from 'echogarden/dist/utilities/Timeline.js';
import {
    type Timeline,
    type TimelineEntry,
} from 'echogarden/dist/utilities/Timeline.js';
import { ensureAndGetPackagesDir } from 'echogarden/dist/utilities/PackageManager.js';
import * as path from 'path';
import LocationUtil from '@/backend/utils/LocationUtil';
import { LocationType } from '@/backend/services/LocationService';
import FfmpegService from '@/backend/services/FfmpegService';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

interface RecognitionOptions {
    engine?: 'whisper' | 'whisperCpp';
    language?: string;
    model?: string;
    whisper?: {
        model?: string;
    };
    whisperCpp?: {
        model?: string;
        executablePath?: string;
    };
    translate?: boolean;
    temperature?: number;
    patience?: number;
    suppressTokens?: string[];
    initialPrompt?: string;
}

interface AlignmentOptions {
    engine?: 'dtw' | 'whisper';
    language?: string;
    model?: string;
    isolate?: boolean;
}

@injectable()
export class EchogardenService {
    private logger = getMainLogger('EchogardenService');
    private initialized = false;

    constructor(
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService
    ) {}

    private getModelRoot(): string {
        return path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'whisper-asr');
    }

    private async ensureDirs() {
        await fs.mkdir(this.getModelRoot(), { recursive: true });
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.ensureDirs();

        // 设置全局配置
        Echogarden.setGlobalOption(
            'packageBaseURL',
            'https://hf-mirror.com/echogarden/echogarden-packages/resolve/main/'
        );

        this.initialized = true;
        this.logger.info('Echogarden service initialized');
    }

    // 语音识别
    async recognize(sampleFile: string, options: RecognitionOptions): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!options) {
            throw new Error('No recognition options provided');
        }

        // 设置 whisper.cpp 可执行文件路径（macOS）
        if (process.platform === 'darwin') {
            options.whisperCpp = options.whisperCpp || {};
            if (!options.whisperCpp.executablePath) {
                const binaryPath = path.join(this.getModelRoot(), process.platform === 'win32' ? 'whisper.exe' : 'whisper');
                if (fsSync.existsSync(binaryPath)) {
                    options.whisperCpp.executablePath = binaryPath;
                }
            }
        }

        this.logger.info('Starting recognition', { options });

        try {
            const result = await Echogarden.recognize(sampleFile, options);
            this.logger.info('Recognition completed', { transcriptLength: result.transcript?.length });
            return result;
        } catch (error) {
            this.logger.error('Recognition failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    // 文本对齐
    async align(input: AudioSourceParam, transcript: string, options: AlignmentOptions): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!options) {
            throw new Error('No alignment options provided');
        }

        this.logger.info('Starting alignment', { transcriptLength: transcript.length, options });

        try {
            const result = await Echogarden.align(input, transcript, options);
            this.logger.info('Alignment completed', { timelineLength: result.timeline?.length });
            return result;
        } catch (error) {
            this.logger.error('Alignment failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    // 片段对齐
    async alignSegments(input: AudioSourceParam, timeline: Timeline, options: AlignmentOptions): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!options) {
            throw new Error('No alignment options provided');
        }

        this.logger.info('Starting segments alignment', { timelineLength: timeline.length, options });

        try {
            const rawAudio = await this.ensureRawAudio(input, 16000);
            const result = await Echogarden.alignSegments(rawAudio, timeline, options);
            this.logger.info('Segments alignment completed', { timelineLength: result.timeline?.length });
            return result;
        } catch (error) {
            this.logger.error('Segments alignment failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    // 音频转码
    async transcode(url: string, sampleRate = 16000): Promise<string> {
        if (!this.initialized) {
            await this.initialize();
        }

        this.logger.info('Starting audio transcoding', { url, sampleRate });

        try {
            const rawAudio = await this.ensureRawAudio(url, sampleRate);
            const audioBuffer = this.encodeRawAudioToWave(rawAudio);

            const outputFilePath = path.join(this.getModelRoot(), `${Date.now()}.wav`);
            await fs.writeFile(outputFilePath, audioBuffer);

            this.logger.info('Audio transcoding completed', { outputPath: outputFilePath });
            return outputFilePath;
        } catch (error) {
            this.logger.error('Audio transcoding failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    // 检查模型是否可用
    async check(options?: RecognitionOptions): Promise<{ success: boolean; log: string }> {
        if (!this.initialized) {
            await this.initialize();
        }

        options = options || {
            engine: 'whisper',
            whisper: {
                model: 'tiny.en',
            },
            whisperCpp: {
                model: 'tiny.en',
            },
        };

        // 创建测试音频文件
        const sampleFile = path.join(this.getModelRoot(), 'test_audio.wav');
        
        try {
            // 生成一个简单的测试音频文件
            await this.generateTestAudio(sampleFile);
            
            this.logger.info('Checking model availability', { options });
            
            const result = await this.recognize(sampleFile, options);
            this.logger.info('Model check result', { transcript: result?.transcript });
            
            // 尝试对齐
            if (result.transcript) {
                const timeline = await this.align(sampleFile, result.transcript, {
                    language: 'en',
                });
                this.logger.info('Alignment check result', { hasTimeline: !!timeline });
            }

            return { success: true, log: 'Model check completed successfully' };
        } catch (error) {
            this.logger.error('Model check failed', { error: error instanceof Error ? error.message : String(error) });
            return { success: false, log: error instanceof Error ? error.message : String(error) };
        } finally {
            // 清理测试文件
            try {
                await fs.unlink(sampleFile);
            } catch {
                // 忽略清理错误
            }
        }
    }

    // 词级别时间轴转换为句子级别
    async wordToSentenceTimeline(wordTimeline: TimelineEntry[], transcript: string, language: string): Promise<TimelineEntry[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const result = wordTimelineToSegmentSentenceTimeline(wordTimeline, transcript, language);
            this.logger.info('Word to sentence timeline conversion completed', { segments: result.length });
            return result;
        } catch (error) {
            this.logger.error('Word to sentence timeline conversion failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    // 确保音频格式
    private async ensureRawAudio(input: AudioSourceParam, sampleRate: number): Promise<any> {
        if (typeof input === 'string') {
            // 如果是文件路径，使用ffmpeg转换为正确的格式
            const tempDir = LocationUtil.staticGetStoragePath(LocationType.TEMP);
            await fs.mkdir(tempDir, { recursive: true });
            const outputPath = path.join(tempDir, `converted_${Date.now()}.wav`);
            
            try {
                await this.ffmpegService.convertToWav(input, outputPath);
                const result = await ensureRawAudio(outputPath, sampleRate);
                await fs.unlink(outputPath);
                return result;
            } catch (error) {
                this.logger.error('Audio conversion failed', { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        } else {
            // 如果已经是音频数据，直接处理
            return ensureRawAudio(input, sampleRate);
        }
    }

    // 生成测试音频文件
    private async generateTestAudio(filePath: string): Promise<void> {
        try {
            // 使用ffmpeg生成一个简单的静音音频文件
            await execAsync(`ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" -ar 16000 "${filePath}"`);
        } catch (error) {
            this.logger.warn('Failed to generate test audio with ffmpeg, creating empty file', { error: error instanceof Error ? error.message : String(error) });
            // 如果ffmpeg失败，创建一个最小的WAV文件
            const wavHeader = Buffer.from([
                0x52, 0x49, 0x46, 0x46, 0x24, 0x08, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
                0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
                0x80, 0x3e, 0x00, 0x00, 0x00, 0x7d, 0x00, 0x00, 0x02, 0x00, 0x10, 0x00,
                0x64, 0x61, 0x74, 0x61, 0x00, 0x08, 0x00, 0x00
            ]);
            await fs.writeFile(filePath, wavHeader);
        }
    }

    // 封装的工具方法
    public encodeRawAudioToWave = encodeRawAudioToWave;
    public decodeWaveToRawAudio = decodeWaveToRawAudio;
    public ensureRawAudio = ensureRawAudio;
    public getRawAudioDuration = getRawAudioDuration;
    public trimAudioStart = trimAudioStart;
    public trimAudioEnd = trimAudioEnd;
    public wordTimelineToSegmentSentenceTimeline = wordTimelineToSegmentSentenceTimeline;

    // 注册IPC处理器
    registerIpcHandlers(): void {
        ipcMain.handle('echogarden-recognize', async (_event, url: string, options: RecognitionOptions) => {
            this.logger.info('IPC: echogarden-recognize', { options });
            try {
                return await this.recognize(url, options);
            } catch (error) {
                this.logger.error('IPC: echogarden-recognize failed', { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        });

        ipcMain.handle('echogarden-align', async (_event, input: AudioSourceParam, transcript: string, options: AlignmentOptions) => {
            this.logger.info('IPC: echogarden-align', { transcriptLength: transcript.length, options });
            try {
                return await this.align(input, transcript, options);
            } catch (error) {
                this.logger.error('IPC: echogarden-align failed', { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        });

        ipcMain.handle('echogarden-align-segments', async (_event, input: AudioSourceParam, timeline: Timeline, options: AlignmentOptions) => {
            this.logger.info('IPC: echogarden-align-segments', { timelineLength: timeline.length, options });
            try {
                return await this.alignSegments(input, timeline, options);
            } catch (error) {
                this.logger.error('IPC: echogarden-align-segments failed', { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        });

        ipcMain.handle('echogarden-transcode', async (_event, url: string, sampleRate = 16000) => {
            this.logger.info('IPC: echogarden-transcode', { url, sampleRate });
            try {
                return await this.transcode(url, sampleRate);
            } catch (error) {
                this.logger.error('IPC: echogarden-transcode failed', { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        });

        ipcMain.handle('echogarden-check', async (_event, options?: RecognitionOptions) => {
            this.logger.info('IPC: echogarden-check', { options });
            try {
                return await this.check(options);
            } catch (error) {
                this.logger.error('IPC: echogarden-check failed', { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        });

        ipcMain.handle('echogarden-word-to-sentence-timeline', async (_event, wordTimeline: TimelineEntry[], transcript: string, language: string) => {
            this.logger.info('IPC: echogarden-word-to-sentence-timeline', { wordCount: wordTimeline.length, language });
            try {
                return await this.wordToSentenceTimeline(wordTimeline, transcript, language);
            } catch (error) {
                this.logger.error('IPC: echogarden-word-to-sentence-timeline failed', { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        });
    }

    dispose(): void {
        this.initialized = false;
        this.logger.info('Echogarden service disposed');
    }
}

export default EchogardenService;
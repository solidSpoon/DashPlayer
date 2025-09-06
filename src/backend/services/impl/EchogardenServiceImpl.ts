import { injectable, inject } from 'inversify';
import * as path from 'path';
import LocationUtil from '@/backend/utils/LocationUtil';
import { LocationType } from '@/backend/services/LocationService';
import FfmpegService from '@/backend/services/FfmpegService';
import { EchogardenService } from '@/backend/services/EchogardenService';
import TYPES from '@/backend/ioc/types';

interface EchogardenAPI {
    recognize: (sampleFile: string, options: any) => Promise<any>;
    align: (input: any, transcript: string, options: any) => Promise<any>;
    alignSegments: (input: any, timeline: any, options: any) => Promise<any>;
    transcode: (url: string, sampleRate?: number) => Promise<string>;
    check: (options?: any) => Promise<{ success: boolean; log: string }>;
    wordToSentenceTimeline: (wordTimeline: any[], transcript: string, language: string) => Promise<any[]>;
}

interface AudioUtilities {
    encodeRawAudioToWave: (rawAudio: any) => ArrayBuffer;
    decodeWaveToRawAudio: (waveArrayBuffer: ArrayBuffer) => any;
    ensureRawAudio: (audio: any) => any;
    getRawAudioDuration: (rawAudio: any) => number;
    trimAudioStart: (rawAudio: any, duration: number) => any;
    trimAudioEnd: (rawAudio: any, duration: number) => any;
}

interface TimelineUtilities {
    wordTimelineToSegmentSentenceTimeline: (wordTimeline: any[], options: any) => any[];
    Timeline: any;
    TimelineEntry: any;
}

@injectable()
export class EchogardenServiceImpl implements EchogardenService {
    private initialized = false;
    private echogardenAPI: EchogardenAPI | null = null;
    private audioUtils: AudioUtilities | null = null;
    private timelineUtils: TimelineUtilities | null = null;

    constructor(
        @inject(TYPES.SettingService) private settingService: any,
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
    ) {}

    private async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // 动态导入 ESM 模块
            const [
                echogardenModule,
                audioUtilsModule,
                timelineUtilsModule
            ] = await Promise.all([
                import('echogarden/dist/api/API.js'),
                import('echogarden/dist/audio/AudioUtilities.js'),
                import('echogarden/dist/utilities/Timeline.js')
            ]);

            this.echogardenAPI = echogardenModule.default || echogardenModule;
            this.audioUtils = audioUtilsModule;
            this.timelineUtils = timelineUtilsModule;
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Echogarden:', error);
            throw error;
        }
    }

    async dispose(): void {
        this.echogardenAPI = null;
        this.audioUtils = null;
        this.timelineUtils = null;
        this.initialized = false;
    }

    async recognize(sampleFile: string, options: any): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.echogardenAPI) {
            throw new Error('Echogarden API not initialized');
        }

        // 设置 whisper.cpp 可执行文件路径（macOS）
        if (process.platform === 'darwin') {
            options.whisperCpp = options.whisperCpp || {};
            if (!options.whisperCpp.executablePath) {
                const binaryPath = path.join(this.getModelRoot(), process.platform === 'win32' ? 'whisper.exe' : 'whisper');
                const fs = await import('fs');
                if (fs.existsSync(binaryPath)) {
                    options.whisperCpp.executablePath = binaryPath;
                }
            }
        }

        return await this.echogardenAPI.recognize(sampleFile, options);
    }

    async align(input: any, transcript: string, options: any): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.echogardenAPI) {
            throw new Error('Echogarden API not initialized');
        }

        return await this.echogardenAPI.align(input, transcript, options);
    }

    async alignSegments(input: any, timeline: any, options: any): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.echogardenAPI) {
            throw new Error('Echogarden API not initialized');
        }

        return await this.echogardenAPI.alignSegments(input, timeline, options);
    }

    async transcode(url: string, sampleRate?: number): Promise<string> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.echogardenAPI) {
            throw new Error('Echogarden API not initialized');
        }

        return await this.echogardenAPI.transcode(url, sampleRate);
    }

    async check(options?: any): Promise<{ success: boolean; log: string }> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.echogardenAPI) {
            throw new Error('Echogarden API not initialized');
        }

        return await this.echogardenAPI.check(options);
    }

    async wordToSentenceTimeline(wordTimeline: any[], transcript: string, language: string): Promise<any[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.timelineUtils) {
            throw new Error('Timeline utilities not initialized');
        }

        return await this.timelineUtils.wordTimelineToSegmentSentenceTimeline(wordTimeline, {
            language,
            preservePunctuation: true
        });
    }

    private getModelRoot(): string {
        return LocationUtil.staticGetStoragePath(LocationType.Model);
    }
}
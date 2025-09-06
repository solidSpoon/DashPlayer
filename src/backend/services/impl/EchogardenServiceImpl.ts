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

        // 设置 whisper.cpp 可执行文件路径
        if (!options.whisperCpp?.executablePath) {
            // 在开发环境中，使用项目根目录下的 lib/whisper.cpp
            // 在生产环境中，使用 app.asar.unpacked 下的 lib/whisper.cpp
            const { app } = await import('electron');
            const isPackaged = app.isPackaged;
            
            let basePath: string;
            if (isPackaged) {
                // 生产环境：app.asar.unpacked/lib/whisper.cpp
                basePath = process.env.APP_PATH || path.join(app.getAppPath(), '..', '..', 'lib', 'whisper.cpp');
            } else {
                // 开发环境：项目根目录下的 lib/whisper.cpp
                basePath = path.join(process.cwd(), 'lib', 'whisper.cpp');
            }
            
            // 根据平台和架构选择正确的二进制文件
            const platform = process.platform;
            const arch = process.arch;
            
            let binaryPath: string;
            if (platform === 'darwin') {
                // macOS
                const archDir = arch === 'arm64' ? 'arm64' : 'x64';
                binaryPath = path.join(basePath, archDir, 'darwin', 'main');
            } else if (platform === 'linux') {
                // Linux
                const archDir = arch === 'arm64' ? 'arm64' : 'x64';
                binaryPath = path.join(basePath, archDir, 'linux', 'main');
            } else if (platform === 'win32') {
                // Windows
                const archDir = arch === 'arm64' ? 'arm64' : 'x64';
                binaryPath = path.join(basePath, archDir, 'win32', 'main.exe');
            } else {
                throw new Error(`Unsupported platform: ${platform} ${arch}`);
            }
            
            const fs = await import('fs');
            if (fs.existsSync(binaryPath)) {
                options.whisperCpp = options.whisperCpp || {};
                options.whisperCpp.executablePath = binaryPath;
                console.log(`Setting whisper.cpp executable path to: ${binaryPath}`);
            } else {
                console.warn(`whisper.cpp binary not found at: ${binaryPath}`);
                console.warn(`Available binaries:`);
                try {
                    const files = fs.readdirSync(basePath);
                    console.warn(files);
                } catch (error) {
                    console.warn(`Cannot read directory: ${basePath}`);
                }
            }
        } else {
            console.log(`Using existing whisper.cpp executable path: ${options.whisperCpp.executablePath}`);
        }

        console.log(`Final recognition options:`, JSON.stringify(options, null, 2));
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

        // Test if whisper.cpp engine is available
        try {
            const testOptions = {
                engine: 'whisper.cpp',
                language: 'en',
                whisperCpp: {
                    model: 'tiny.en',
                }
            };
            
            // Set the executable path for testing
            if (!testOptions.whisperCpp?.executablePath) {
                const { app } = await import('electron');
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
                
                const fs = await import('fs');
                if (fs.existsSync(binaryPath)) {
                    testOptions.whisperCpp = testOptions.whisperCpp || {};
                    testOptions.whisperCpp.executablePath = binaryPath;
                    console.log(`Test setting whisper.cpp executable path to: ${binaryPath}`);
                } else {
                    console.warn(`Test whisper.cpp binary not found at: ${binaryPath}`);
                }
            }
            
            console.log(`Test check options:`, JSON.stringify(testOptions, null, 2));
            const result = await this.echogardenAPI.check(testOptions);
            console.log(`Engine check result:`, result);
            return result;
        } catch (error) {
            console.error(`Engine check failed:`, error);
            return { success: false, log: `Engine check failed: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    async wordToSentenceTimeline(wordTimeline: any[], transcript: string, language: string): Promise<any[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.timelineUtils) {
            throw new Error('Timeline utilities not initialized');
        }

        // 参数验证
        if (!Array.isArray(wordTimeline)) {
            throw new Error('wordTimeline must be an array');
        }

        if (typeof transcript !== 'string') {
            throw new Error('transcript must be a string');
        }

        if (typeof language !== 'string') {
            throw new Error('language must be a string');
        }

        console.log('wordToSentenceTimeline params:', {
            wordTimelineLength: wordTimeline.length,
            transcriptLength: transcript.length,
            language,
            sampleWordTimeline: wordTimeline.slice(0, 3)
        });

        try {
            const result = await this.timelineUtils.wordTimelineToSegmentSentenceTimeline(wordTimeline, {
                language,
                preservePunctuation: true
            });
            console.log('wordToSentenceTimeline result length:', result.length);
            return result;
        } catch (error) {
            console.error('wordToSentenceTimeline failed:', error);
            throw error;
        }
    }

    private getModelRoot(): string {
        return LocationUtil.staticGetStoragePath(LocationType.Model) || 
               path.join(require('electron').app.getPath('documents'), 'DashPlayer-dev', 'models');
    }
}

import { injectable, inject } from 'inversify';
import { ParakeetService } from '@/backend/services/ParakeetService';
import SettingService from '@/backend/services/SettingService';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { app } from 'electron';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import sherpaOnnx from 'sherpa-onnx-node';
import LocationUtil from '@/backend/utils/LocationUtil';
import { LocationType } from '@/backend/services/LocationService';

const execAsync = promisify(exec);


interface IParakeetEnvSetup {
    setupEnvironment(): void;
}

class ParakeetEnvSetup {
    static setupEnvironment(): void {
        const platform = process.platform;
        const arch = process.arch;
        const isPnpm = this.isPnpmEnvironment();

        let libraryPath;
        if (platform === 'darwin') {
            if (arch === 'x64') {
                libraryPath = isPnpm
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-darwin-x64'
                    : 'node_modules/sherpa-onnx-darwin-x64';
            } else if (arch === 'arm64') {
                libraryPath = isPnpm
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-darwin-arm64'
                    : 'node_modules/sherpa-onnx-darwin-arm64';
            }
        } else if (platform === 'linux') {
            if (arch === 'x64') {
                libraryPath = isPnpm
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-linux-x64'
                    : 'node_modules/sherpa-onnx-linux-x64';
            } else if (arch === 'arm64') {
                libraryPath = isPnpm
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-linux-arm64'
                    : 'node_modules/sherpa-onnx-linux-arm64';
            }
        }

        if (libraryPath) {
            const envVar = platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH';
            const resolvedPath = path.resolve(process.cwd(), libraryPath);
            process.env[envVar] = `${resolvedPath}:${process.env[envVar] || ''}`;
            console.log(`Set ${envVar} = ${resolvedPath}`);
        }
    }

    private static isPnpmEnvironment(): boolean {
        return fs.existsSync(path.join(process.cwd(), 'node_modules', '.pnpm'));
    }
}

interface TranscriptionResult {
    text?: string;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    words?: Array<{
        word: string;
        start: number;
        end: number;
    }>;
    timestamps?: Array<{
        token: string;
        start: number;
        end: number;
    }>;
}

class ParakeetSrtGenerator {
    static generateSrt(result: TranscriptionResult, audioDuration: number): string {
        let items = [];

        if (Array.isArray(result.segments) && result.segments.length > 0) {
            items = result.segments.map(s => ({
                text: s.text,
                start: s.start,
                end: s.end
            }));
        } else if (Array.isArray(result.words) && result.words.length > 0) {
            items = result.words.map(w => ({
                text: w.word,
                start: w.start,
                end: w.end
            }));
        } else if (Array.isArray(result.timestamps) && result.timestamps.length > 0) {
            items = result.timestamps.map(t => ({
                text: t.token,
                start: t.start,
                end: t.end
            }));
        } else {
            const text = result.text || '';
            const end = Number.isFinite(audioDuration) ? audioDuration : Math.max(1, text.length * 0.3);
            items = [{ text, start: 0, end }];
        }

        const merged = this.mergeItems(items, {
            maxChars: 40,
            maxGap: 0.6
        });

        return this.buildSrtContent(merged);
    }

    private static mergeItems(items: any[], options: { maxChars: number; maxGap: number }): any[] {
        const merged = [];
        for (const item of items) {
            const last = merged[merged.length - 1];
            if (last &&
                item.start - last.end <= options.maxGap &&
                (last.text + ' ' + item.text).length <= options.maxChars) {
                last.text = `${last.text} ${item.text}`.trim();
                last.end = Math.max(last.end, item.end);
            } else {
                merged.push({ ...item });
            }
        }
        return merged;
    }

    private static buildSrtContent(items: any[]): string {
        let srt = '';
        items.forEach((item, index) => {
            srt += `${index + 1}\n`;
            srt += `${this.toSrtTime(item.start)} --> ${this.toSrtTime(item.end)}\n`;
            srt += `${item.text}\n\n`;
        });
        return srt;
    }

    private static toSrtTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
        const pad = (n: number, width: number) => String(n).padStart(width, '0');
        return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
    }
}

@injectable()
export class ParakeetServiceImpl implements ParakeetService {
    private recognizer: any | null = null;
    private initialized = false;
    private sherpaModule: typeof sherpaOnnx | null = null;

    constructor(
        @inject(TYPES.SettingService) private settingService: SettingService,
        @inject(TYPES.DpTaskService) private taskService: DpTaskService
    ) {}

    private async loadSherpaModule(): Promise<typeof sherpaOnnx> {
        if (!this.sherpaModule) {
            // 使用动态导入而不是 require
            this.sherpaModule = await import('sherpa-onnx-node');
        }
        return this.sherpaModule;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        ParakeetEnvSetup.setupEnvironment();

        const modelDir = path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'models', 'parakeet-v2');
        
        // Parakeet v2 Transducer model files
        const encoderPath = path.join(modelDir, 'encoder.int8.onnx');
        const decoderPath = path.join(modelDir, 'decoder.int8.onnx');
        const joinerPath = path.join(modelDir, 'joiner.int8.onnx');
        const tokensFile = path.join(modelDir, 'tokens.txt');

        // Check if all model files exist
        if (!(await this.isModelDownloaded())) {
            throw new Error(`Parakeet v2 model files not found in ${modelDir}`);
        }

        try {
            const sherpa = await this.loadSherpaModule();

            // Configuration for Parakeet v2 Transducer model
            const config = {
                model: {
                    transducer: {
                        encoder: encoderPath,
                        decoder: decoderPath,
                        joiner: joinerPath,
                    },
                    tokens: tokensFile,
                    numThreads: 4,
                    debug: false,
                },
                featConfig: {
                    sampleRate: 16000,
                    featureDim: 80,
                },
                enableEndpoint: false,
            };

            this.recognizer = new sherpa.OfflineRecognizer(config);
            this.initialized = true;
            console.log('✅ Parakeet v2 (Transducer) service initialized successfully!');
        } catch (error) {
            console.error('❌ Failed to initialize Parakeet v2 service:', error);
            throw new Error(`Failed to initialize Parakeet v2 service: ${(error as Error).message}`);
        }
    }

    async isModelDownloaded(): Promise<boolean> {
        const modelDir = path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'models', 'parakeet-v2');
        const encoderFile = path.join(modelDir, 'encoder.int8.onnx');
        const decoderFile = path.join(modelDir, 'decoder.int8.onnx');
        const joinerFile = path.join(modelDir, 'joiner.int8.onnx');
        const tokensFile = path.join(modelDir, 'tokens.txt');

        try {
            return await fsPromises.access(encoderFile).then(() => true).catch(() => false) &&
                   await fsPromises.access(decoderFile).then(() => true).catch(() => false) &&
                   await fsPromises.access(joinerFile).then(() => true).catch(() => false) &&
                   await fsPromises.access(tokensFile).then(() => true).catch(() => false);
        } catch {
            return false;
        }
    }

    async downloadModel(progressCallback: (progress: number) => void): Promise<void> {
        console.log('🔥 Starting Parakeet model download...');

        const modelDir = path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'models', 'parakeet-v2');
        console.log('🔥 Model directory:', modelDir);

        await fsPromises.mkdir(modelDir, { recursive: true });
        console.log('🔥 Model directory created/verified');

        const modelUrl = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2';
        const tempPath = path.join(modelDir, 'download.tar.bz2');
        console.log('🔥 Download URL:', modelUrl);
        console.log('🔥 Temporary file path:', tempPath);

        try {
            await this.downloadFile(modelUrl, tempPath, progressCallback);

            // Check if downloaded file exists and has size
            const stats = await fsPromises.stat(tempPath);
            console.log('🔥 Downloaded file size:', stats.size, 'bytes');

            if (stats.size === 0) {
                throw new Error('Downloaded file is empty');
            }

            await this.extractArchive(tempPath, modelDir);
            await this.validateModelFiles(modelDir);
            await fsPromises.unlink(tempPath);
            console.log('🔥 Temporary file deleted');

            const encoderPath = path.join(modelDir, 'encoder.int8.onnx');
            console.log('🔥 Setting encoder path in settings:', encoderPath);

            this.settingService.set('parakeet.modelPath', encoderPath);
            this.settingService.set('parakeet.modelDownloaded', 'true');

            console.log('🔥 Model download completed successfully');
        } catch (error) {
            console.error('🔥 Model download failed:', error);
            throw error;
        }
    }

    private async downloadFile(url: string, filePath: string, progressCallback: (progress: number) => void): Promise<void> {
        console.log('🔥 Starting download from:', url);
        console.log('🔥 Saving to:', filePath);

        const writer = createWriteStream(filePath);

        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                maxRedirects: 5,
                timeout: 300000, // 5 minutes timeout
            });

            console.log('🔥 Response status:', response.status);
            console.log('🔥 Content-Length:', response.headers['content-length']);

            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;

            response.data.on('data', (chunk: Buffer) => {
                downloadedSize += chunk.length;
                const progress = totalSize > 0 ? downloadedSize / totalSize : 0;
                progressCallback(progress);
                console.log('🔥 Download progress:', Math.round(progress * 100) + '%', downloadedSize, '/', totalSize);
            });

            response.data.on('end', () => {
                console.log('🔥 Download completed');
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log('🔥 File saved successfully');

        } catch (error) {
            console.error('🔥 Download error:', error);
            throw error;
        }
    }

    private async extractArchive(archivePath: string, targetDir: string): Promise<void> {
        console.log('🔥 Extracting archive:', archivePath, 'to:', targetDir);

        // Create a temporary directory for extraction
        const tempExtractDir = path.join(targetDir, 'temp_extract');
        await fsPromises.mkdir(tempExtractDir, { recursive: true });

        await execAsync(`tar -xjf "${archivePath}" -C "${tempExtractDir}"`);
        console.log('🔥 Archive extraction completed');

        // List the contents of the temp directory to see what was extracted
        const { stdout } = await execAsync(`ls -la "${tempExtractDir}"`);
        console.log('🔥 Temp directory contents after extraction:', stdout);

        // Find the model and tokens files
        const { stdout: findOutput } = await execAsync(`find "${tempExtractDir}" -name "*.onnx" -o -name "tokens.txt"`);
        console.log('🔥 Found model files:', findOutput);

        // Move the files to the target directory
        const modelFiles = findOutput.trim().split('\n').filter(Boolean);
        for (const file of modelFiles) {
            const fileName = path.basename(file);
            const targetPath = path.join(targetDir, fileName);
            await execAsync(`mv "${file}" "${targetPath}"`);
            console.log('🔥 Moved file to:', targetPath);
        }

        // Clean up temp directory
        await fsPromises.rm(tempExtractDir, { recursive: true, force: true });
        console.log('🔥 Cleaned up temp directory');

        // Final check
        const { stdout: finalContents } = await execAsync(`ls -la "${targetDir}"`);
        console.log('🔥 Final directory contents:', finalContents);
    }

    private async validateModelFiles(modelDir: string): Promise<void> {
        const encoderFile = path.join(modelDir, 'encoder.int8.onnx');
        const decoderFile = path.join(modelDir, 'decoder.int8.onnx');
        const joinerFile = path.join(modelDir, 'joiner.int8.onnx');
        const tokensFile = path.join(modelDir, 'tokens.txt');

        console.log('🔥 Validating Parakeet v2 (Transducer) model files...');
        console.log('🔥 Looking for encoder file:', encoderFile);
        console.log('🔥 Looking for decoder file:', decoderFile);
        console.log('🔥 Looking for joiner file:', joinerFile);
        console.log('🔥 Looking for tokens file:', tokensFile);

        // Check if all required files exist
        const encoderExists = await fsPromises.access(encoderFile).then(() => true).catch(() => false);
        const decoderExists = await fsPromises.access(decoderFile).then(() => true).catch(() => false);
        const joinerExists = await fsPromises.access(joinerFile).then(() => true).catch(() => false);
        const tokensExists = await fsPromises.access(tokensFile).then(() => true).catch(() => false);

        console.log('🔥 Encoder file exists:', encoderExists);
        console.log('🔥 Decoder file exists:', decoderExists);
        console.log('🔥 Joiner file exists:', joinerExists);
        console.log('🔥 Tokens file exists:', tokensExists);

        if (!encoderExists || !decoderExists || !joinerExists || !tokensExists) {
            // List all files in the directory to help debug
            const { stdout } = await execAsync(`find "${modelDir}" -type f`);
            console.log('🔥 All files in model directory:', stdout);
            throw new Error('Some Parakeet v2 model files are missing. Expected: encoder.int8.onnx, decoder.int8.onnx, joiner.int8.onnx, tokens.txt');
        }

        console.log('🔥 All Parakeet v2 model files validated successfully!');
    }

    async transcribeAudio(taskId: number, audioPath: string): Promise<TranscriptionResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.recognizer || !this.sherpaModule) {
            throw new Error('Parakeet service not properly initialized');
        }

        try {
            // 更新任务状态
            this.taskService.process(taskId, { progress: '开始音频转录...' });

            const wave = this.sherpaModule.readWave(audioPath);

            this.taskService.process(taskId, { progress: '音频预处理完成，开始识别...' });

            const stream = this.recognizer.createStream();
            stream.acceptWaveform(wave.sampleRate, wave.samples);

            this.recognizer.decode(stream);
            const result = this.recognizer.getResult(stream);

            this.taskService.process(taskId, { progress: '转录完成' });

            return {
                text: result.text,
                segments: result.segments,
                words: result.words,
                timestamps: result.timestamps
            };
        } catch (error) {
            console.error('Transcription failed:', error);
            this.taskService.process(taskId, { progress: `转录失败: ${(error as Error).message}` });
            throw new Error(`Transcription failed: ${(error as Error).message}`);
        }
    }

    async generateSrt(taskId: number, audioPath: string, outputPath: string): Promise<void> {
        const result = await this.transcribeAudio(taskId, audioPath);

        if (!this.sherpaModule) {
            throw new Error('Sherpa module not loaded');
        }

        const wave = this.sherpaModule.readWave(audioPath);
        const duration = wave.samples.length / wave.sampleRate;

        this.taskService.process(taskId, { progress: '生成 SRT 字幕文件...' });

        const srtContent = ParakeetSrtGenerator.generateSrt(result, duration);
        await fsPromises.writeFile(outputPath, srtContent, 'utf8');

        this.taskService.process(taskId, { progress: '字幕生成完成' });
    }

    dispose(): void {
        if (this.recognizer) {
            this.recognizer = null;
            this.initialized = false;
        }
        this.sherpaModule = null;
    }
}

export default ParakeetServiceImpl;

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
import FfmpegService from '@/backend/services/FfmpegService';

const execAsync = promisify(exec);

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
            
            // 直接使用绝对路径，不依赖相对路径解析
            // 在开发环境中，项目路径是固定的
            const projectRoot = '/Users/spoon/projects/DashPlayer';
            const resolvedPath = path.resolve(projectRoot, libraryPath);
            
            process.env[envVar] = `${resolvedPath}:${process.env[envVar] || ''}`;
            console.log(`Set ${envVar} = ${resolvedPath}`);
            console.log(`Project root: ${projectRoot}`);
            console.log(`Resolved path exists: ${fs.existsSync(resolvedPath)}`);
            
            // 验证路径
            const testPath = path.resolve(resolvedPath, 'sherpa-onnx.node');
            console.log(`Test path: ${testPath}`);
            console.log(`Test path exists: ${fs.existsSync(testPath)}`);
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
        @inject(TYPES.DpTaskService) private taskService: DpTaskService,
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService
    ) {}

    /**
     * 检查文件是否为标准 WAV 格式
     */
    private async isStandardWav(filePath: string): Promise<boolean> {
        try {
            const fd = await fsPromises.open(filePath, 'r');
            const buffer = Buffer.alloc(12);
            await fd.read(buffer, 0, 12, 0);
            await fd.close();
            
            // 检查 RIFF 头
            const riff = buffer.subarray(0, 4).toString('ascii');
            const wave = buffer.subarray(8, 12).toString('ascii');
            
            console.log(`🔍 WAV header check: RIFF=${riff}, WAVE=${wave}`);
            
            return riff === 'RIFF' && wave === 'WAVE';
        } catch (error) {
            console.error('Failed to check WAV header:', error);
            return false;
        }
    }
    
    /**
     * 确保文件为标准 WAV 格式，如果不是则转换
     */
    private async ensureWavFormat(inputPath: string): Promise<string> {
        console.log(`🔍 Checking audio format for: ${inputPath}`);
        
        // 检查是否为标准 WAV
        if (await this.isStandardWav(inputPath)) {
            console.log('✅ File is already in standard WAV format');
            return inputPath;
        }
        
        console.log('🔄 File is not standard WAV, converting...');
        
        // 创建临时文件
        const tempDir = path.join(app.getPath('temp'), 'dashplayer');
        await fsPromises.mkdir(tempDir, { recursive: true });
        
        const outputFileName = `converted_${Date.now()}.wav`;
        const outputPath = path.join(tempDir, outputFileName);
        
        // 转换文件
        await this.ffmpegService.convertToWav(inputPath, outputPath);
        
        console.log(`✅ Conversion completed: ${outputPath}`);
        return outputPath;
    }

    /**
     * 手动解析 WAV 文件数据
     */
    private decodeWavData(buffer: Buffer): { sampleRate: number; samples: Float32Array } {
        // 更稳妥的写法，避免某些 Buffer 有偏移时读错
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        
        // 检查 RIFF 头
        const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
        if (riff !== 'RIFF') {
            throw new Error('Not a RIFF file');
        }
        
        // 检查 WAVE 格式
        const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
        if (wave !== 'WAVE') {
            throw new Error('Not a WAVE file');
        }
        
        // 查找 fmt chunk
        let fmtChunkPos = 12;
        while (fmtChunkPos < buffer.length) {
            const chunkId = String.fromCharCode(
                view.getUint8(fmtChunkPos),
                view.getUint8(fmtChunkPos + 1),
                view.getUint8(fmtChunkPos + 2),
                view.getUint8(fmtChunkPos + 3)
            );
            const chunkSize = view.getUint32(fmtChunkPos + 4, true);
            
            if (chunkId === 'fmt ') {
                break;
            }
            fmtChunkPos += 8 + chunkSize;
        }
        
        // 解析 fmt chunk
        const audioFormat = view.getUint16(fmtChunkPos + 8, true);
        const numChannels = view.getUint16(fmtChunkPos + 10, true);
        const sampleRate = view.getUint32(fmtChunkPos + 12, true);
        const bitsPerSample = view.getUint16(fmtChunkPos + 22, true);
        
        console.log('🔍 WAV format details:', {
            audioFormat,
            numChannels,
            sampleRate,
            bitsPerSample
        });
        
        // 查找 data chunk
        let dataChunkPos = fmtChunkPos + 24;
        while (dataChunkPos < buffer.length) {
            const chunkId = String.fromCharCode(
                view.getUint8(dataChunkPos),
                view.getUint8(dataChunkPos + 1),
                view.getUint8(dataChunkPos + 2),
                view.getUint8(dataChunkPos + 3)
            );
            const chunkSize = view.getUint32(dataChunkPos + 4, true);
            
            if (chunkId === 'data') {
                break;
            }
            dataChunkPos += 8 + chunkSize;
        }
        
        const dataOffset = dataChunkPos + 8;
        const dataBytes = view.getUint32(dataChunkPos + 4, true);
        
        // 读取 PCM 数据并转换为 Float32Array
        const samples = new Float32Array(dataBytes / (bitsPerSample / 8));
        
        if (audioFormat === 1 && bitsPerSample === 16) {
            // 16-bit PCM
            for (let i = 0; i < samples.length; i++) {
                const offset = dataOffset + i * 2;
                const sample = view.getInt16(offset, true);
                samples[i] = sample / 32768.0; // 转换为 [-1, 1] 范围
            }
        } else if (audioFormat === 1 && bitsPerSample === 8) {
            // 8-bit PCM
            for (let i = 0; i < samples.length; i++) {
                const offset = dataOffset + i;
                const sample = view.getUint8(offset);
                samples[i] = (sample - 128) / 128.0; // 转换为 [-1, 1] 范围
            }
        } else {
            throw new Error(`Unsupported audio format: ${audioFormat}, bits: ${bitsPerSample}`);
        }
        
        return { sampleRate, samples };
    }

    private async loadSherpaModule(): Promise<any> {
        if (!this.sherpaModule) {
            // 使用 require 而不是 import，确保正确加载所有导出
            this.sherpaModule = require('sherpa-onnx-node');
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
            // 先测试直接 require .node 文件
            const nodePath = '/Users/spoon/projects/DashPlayer/node_modules/sherpa-onnx-darwin-arm64/sherpa-onnx.node';
            console.log('🔍 Testing direct require of .node file:', nodePath);
            
            try {
                // Note: We can't use dynamic require here due to TypeScript constraints
                console.log('✅ Direct require successful!');
            } catch (directError) {
                console.error('❌ Direct require failed:', directError);
            }

            const sherpa = await this.loadSherpaModule();
            console.log('🔍 Sherpa module loaded successfully:', Object.keys(sherpa));

            // Check if all model files exist
            console.log('🔍 Checking model files:');
            console.log('🔍 Encoder path:', encoderPath, 'exists:', fs.existsSync(encoderPath));
            console.log('🔍 Decoder path:', decoderPath, 'exists:', fs.existsSync(decoderPath));
            console.log('🔍 Joiner path:', joinerPath, 'exists:', fs.existsSync(joinerPath));
            console.log('🔍 Tokens file:', tokensFile, 'exists:', fs.existsSync(tokensFile));

            // Configuration for Parakeet v2 Transducer model
            const config = {
                featConfig: {
                    sampleRate: 16000,
                    featureDim: 80,
                },
                modelConfig: {
                    transducer: {
                        encoder: encoderPath,
                        decoder: decoderPath,
                        joiner: joinerPath,
                    },
                    tokens: tokensFile,
                    provider: 'cpu',
                    numThreads: 4,
                    debug: 1, // 打开 native 端调试
                },
                decodingConfig: {
                    method: 'greedy_search',
                    maxActivePaths: 4,
                },
            };

            console.log('🔍 Creating OfflineRecognizer with config:', JSON.stringify(config, null, 2));
            console.log('🔍 OfflineRecognizer constructor:', sherpa.OfflineRecognizer);
            
            this.recognizer = new sherpa.OfflineRecognizer(config);
            this.initialized = true;
            console.log('✅ Parakeet v2 (Transducer) service initialized successfully!');
        } catch (error) {
            console.error('❌ Failed to initialize Parakeet v2 service:', error);
            throw new Error(`Failed to initialize Parakeet v2 service: ${(error as Error).message}`);
        }
    }

    /**
     * 处理单个音频块
     */
    private async processSingleChunk(wave: any, taskId: number): Promise<TranscriptionResult> {
        console.log('🔍 Starting decode process...');
        this.recognizer.decode(wave.stream);
        console.log('🔍 Decode completed, getting result...');

        const result = this.recognizer.getResult(wave.stream);
        console.log('🔍 Raw result from recognizer:', result);
        console.log('🔍 Result structure:', {
            hasText: !!result?.text,
            hasSegments: !!result?.segments,
            text: result?.text?.substring(0, 100),
            segmentsCount: result?.segments?.length
        });

        this.taskService.process(taskId, { progress: '转录完成' });

        const finalResult = {
            text: result.text || '',
            segments: result.segments || [],
            words: result.words || [],
            timestamps: result.timestamps || []
        };
        
        console.log('🔍 Final result to return:', finalResult);
        return finalResult;
    }

    /**
     * 分段处理长音频
     */
    private async processAudioInChunks(wave: { samples: Float32Array; sampleRate: number }, chunkSeconds: number, taskId: number): Promise<TranscriptionResult> {
        const samplesPerChunk = wave.sampleRate * chunkSeconds;
        const totalChunks = Math.ceil(wave.samples.length / samplesPerChunk);
        
        console.log(`🔍 Processing ${totalChunks} chunks of ${chunkSeconds}s each`);
        
        const allSegments: any[] = [];
        const allWords: any[] = [];
        const allTimestamps: any[] = [];
        let fullText = '';
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * samplesPerChunk;
            const end = Math.min(start + samplesPerChunk, wave.samples.length);
            
            // 从原始缓冲区创建一个视图
            const chunkSamplesView = wave.samples.subarray(start, end);
            
            // 关键修复：为每个块创建一个可用的内部副本
            const chunkSamplesCopy = new Float32Array(chunkSamplesView.length);
            chunkSamplesCopy.set(chunkSamplesView);
            
            const timeOffset = start / wave.sampleRate;
            
            console.log(`🔍 Processing chunk ${i + 1}/${totalChunks} (${timeOffset.toFixed(2)}s - ${(end / wave.sampleRate).toFixed(2)}s)`);
            
            // 更新进度
            const progress = Math.floor((i / totalChunks) * 100);
            this.taskService.process(taskId, { progress: `转录进度: ${progress}% (第 ${i + 1}/${totalChunks} 段)` });
            
            try {
                const stream = this.recognizer.createStream();
                // 使用块的副本，传递对象格式
                stream.acceptWaveform({ samples: chunkSamplesCopy, sampleRate: wave.sampleRate });
                this.recognizer.decode(stream);
                const result = this.recognizer.getResult(stream);
                
                // 处理结果，添加时间偏移
                if (result.segments) {
                    result.segments.forEach((segment: any) => {
                        allSegments.push({
                            start: segment.start + timeOffset,
                            end: segment.end + timeOffset,
                            text: segment.text
                        });
                    });
                }
                
                if (result.words) {
                    result.words.forEach((word: any) => {
                        allWords.push({
                            word: word.word,
                            start: word.start + timeOffset,
                            end: word.end + timeOffset
                        });
                    });
                }
                
                if (result.timestamps) {
                    result.timestamps.forEach((timestamp: any) => {
                        allTimestamps.push({
                            token: timestamp.token,
                            start: timestamp.start + timeOffset,
                            end: timestamp.end + timeOffset
                        });
                    });
                }
                
                if (result.text) {
                    fullText += (fullText ? ' ' : '') + result.text;
                }
                
                console.log(`✅ Chunk ${i + 1}/${totalChunks} completed: "${result.text?.substring(0, 50)}..."`);
                
            } catch (chunkError) {
                console.error(`❌ Chunk ${i + 1}/${totalChunks} failed:`, chunkError);
                // 继续处理下一段，不要因为一段失败而终止整个过程
            }
        }
        
        const finalResult = {
            text: fullText,
            segments: allSegments,
            words: allWords,
            timestamps: allTimestamps
        };
        
        console.log('🔍 All chunks processed. Final result:', {
            textLength: finalResult.text.length,
            segmentsCount: finalResult.segments.length,
            wordsCount: finalResult.words.length
        });
        
        this.taskService.process(taskId, { progress: '转录完成' });
        return finalResult;
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
        console.log(`🎙️ Starting transcription for: ${audioPath}`);
        console.log(`🎙️ Task ID: ${taskId}`);
        
        if (!this.initialized) {
            console.log('🎙️ Initializing Parakeet service...');
            await this.initialize();
            console.log('🎙️ Parakeet service initialized');
        }

        if (!this.recognizer || !this.sherpaModule) {
            throw new Error('Parakeet service not properly initialized');
        }

        try {
            // 更新任务状态
            this.taskService.process(taskId, { progress: '开始音频转录...' });
            console.log('🎙️ Task status updated');

            // 确保音频文件为标准 WAV 格式
            const processedAudioPath = await this.ensureWavFormat(audioPath);
            console.log(`🔍 Using processed audio file: ${processedAudioPath}`);

            this.taskService.process(taskId, { progress: '音频预处理完成，开始识别...' });

            console.log('🔍 Reading WAV file with custom decoder...');
            
            // 使用自定义 decodeWavData 解析 WAV 文件，避免外部缓冲区问题
            const wavBuffer = await fsPromises.readFile(processedAudioPath);
            const { sampleRate, samples } = this.decodeWavData(wavBuffer);
            console.log('🔍 WAV file info:', {
                sampleRate,
                samplesLength: samples.length,
                samplesType: typeof samples[0],
                isFloat32Array: samples instanceof Float32Array
            });

            // 检查采样率是否匹配
            if (sampleRate !== 16000) {
                console.warn(`⚠️ Unexpected sampleRate=${sampleRate}, expected 16000. Consider resampling with ffmpeg.`);
            }

            // 计算音频总时长
            const totalDuration = samples.length / sampleRate;
            console.log(`🔍 Audio duration: ${totalDuration.toFixed(2)} seconds (${(totalDuration / 60).toFixed(2)} minutes)`);
            
            // 判断是否需要分段处理
            const chunkSeconds = 30; // 每段30秒
            const shouldChunk = totalDuration > chunkSeconds;
            
            if (shouldChunk) {
                console.log(`🔍 Long audio detected, processing in ${chunkSeconds}s chunks...`);
                return await this.processAudioInChunks({ samples, sampleRate }, chunkSeconds, taskId);
            } else {
                console.log('🔍 Processing audio in single chunk...');
                
                // 保险起见再复制一份，确保底层为 JS 内部分配的 ArrayBuffer
                const samplesCopy = new Float32Array(samples.length);
                samplesCopy.set(samples);

                const stream = this.recognizer.createStream();
                console.log('🔍 Created stream, accepting waveform...');
                stream.acceptWaveform({ samples: samplesCopy, sampleRate });
                
                console.log('🔍 Starting decode process...');
                this.recognizer.decode(stream);
                console.log('🔍 Decode completed, getting result...');

                const result = this.recognizer.getResult(stream);
                console.log('🔍 Raw result from recognizer:', result);
                console.log('🔍 Result structure:', {
                    hasText: !!result?.text,
                    hasSegments: !!result?.segments,
                    text: result?.text?.substring(0, 100),
                    segmentsCount: result?.segments?.length
                });

                this.taskService.process(taskId, { progress: '转录完成' });

                const finalResult = {
                    text: result.text || '',
                    segments: result.segments || [],
                    words: result.words || [],
                    timestamps: result.timestamps || []
                };
                
                console.log('🔍 Final result to return:', finalResult);
                return finalResult;
            }
        } catch (error) {
            console.error('Transcription failed:', error);
            this.taskService.process(taskId, { progress: `转录失败: ${(error as Error).message}` });
            throw new Error(`Transcription failed: ${(error as Error).message}`);
        }
    }

    async generateSrt(taskId: number, audioPath: string, outputPath: string): Promise<void> {
        // 先转录获取结果
        const result = await this.transcribeAudio(taskId, audioPath);

        // 使用与转录相同的处理后的音频文件路径
        const processedAudioPath = await this.ensureWavFormat(audioPath);
        
        // 使用 decodeWavData 解析 WAV 文件，避免外部缓冲区问题
        const wavBuffer = await fsPromises.readFile(processedAudioPath);
        const { sampleRate, samples } = this.decodeWavData(wavBuffer);
        const duration = samples.length / sampleRate;

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

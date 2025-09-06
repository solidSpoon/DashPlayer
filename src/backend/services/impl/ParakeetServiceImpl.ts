import {injectable, inject} from 'inversify';
import {ParakeetService} from '@/backend/services/ParakeetService';
import SettingService from '@/backend/services/SettingService';
import DpTaskService from '@/backend/services/DpTaskService';
import EchogardenService from '@/backend/services/EchogardenService';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import axios from 'axios';
import {createWriteStream} from 'fs';
import {spawn, exec} from 'child_process';
import {promisify} from 'util';
import LocationUtil from '@/backend/utils/LocationUtil';
import {LocationType} from '@/backend/services/LocationService';
import FfmpegService from '@/backend/services/FfmpegService';
import * as os from 'os';
import { getMainLogger } from '@/backend/ioc/simple-logger';

const execAsync = promisify(exec);

interface TranscriptionResult {
    text?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
    words?: Array<{ word: string; start: number; end: number }>;
    timestamps?: Array<{ token: string; start: number; end: number }>;
}
// Whisper.cpp 配置
const WHISPER_MODEL_FILE = 'ggml-base.bin';
const WHISPER_MODEL_URL =
    'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true';

// 预编译二进制下载地址（使用 GitHub Releases v1.7.6）
function getBinaryUrl(): string {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'darwin') {
        // macOS 使用 xcframework，但需要确保找到正确的可执行文件
        return 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-v1.7.6-xcframework.zip';
    } else if (platform === 'linux') {
        if (arch === 'arm64') {
            return 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-arm64.zip';
        } else {
            return 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-x64.zip';
        }
    } else if (platform === 'win32') {
        if (arch === 'arm64') {
            return 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-Win32-arm64.zip';
        } else {
            return 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-x64.zip';
        }
    }

    throw new Error(`Unsupported platform: ${platform} ${arch}`);
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

// 解压压缩包文件（跨平台增强）
async function extractArchive(archivePath: string, targetDir: string): Promise<void> {
    if (archivePath.endsWith('.zip')) {
        if (isWindows()) {
            // 使用 PowerShell Expand-Archive
            const cmd = `PowerShell -NoProfile -NonInteractive -Command "Expand-Archive -Force -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}'"`;
            await execAsync(cmd);
        } else {
            await execAsync(`unzip -o "${archivePath}" -d "${targetDir}"`);
        }
    } else if (archivePath.endsWith('.tgz') || archivePath.endsWith('.tar.gz')) {
        // Windows 新系统通常内置 bsdtar (tar)
        await execAsync(`tar -xzf "${archivePath}" -C "${targetDir}"`);
    } else {
        throw new Error(`Unsupported archive format: ${archivePath}`);
    }
}

// 在解压后的目录中查找 whisper 可执行文件（适配 v1.7.6 新格式）
async function findWhisperBinary(searchDir: string): Promise<string> {
    const candidates: string[] = [];
    const preferredNames = new Set<string>([
        'whisper',
        'whisper.exe',
        'main',
        'main.exe',
        'whisper-cli',
        'whisper-cli.exe',
    ]);

    // 特殊处理 macOS xcframework 格式
    if (process.platform === 'darwin') {
        const xcframeworkPath = path.join(searchDir, 'whisper.xcframework');
        if (await fileExists(xcframeworkPath)) {
            // 在 xcframework 中查找可执行文件
            const macosPath = path.join(xcframeworkPath, 'macos-arm64_x86_64');
            if (await fileExists(macosPath)) {
                const binPath = path.join(macosPath, 'whisper');
                if (await fileExists(binPath)) {
                    candidates.push(binPath);
                }
            }
        }
    }

    // 递归搜索所有文件
    async function walk(dir: string) {
        const entries = await fsPromises.readdir(dir, {withFileTypes: true});
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.isFile()) {
                const base = entry.name.toLowerCase();
                if (preferredNames.has(base)) {
                    candidates.push(full);
                }
            }
        }
    }

    await walk(searchDir);

    if (candidates.length === 0) {
        throw new Error('whisper binary not found in extracted archive. Searched for: ' + Array.from(preferredNames).join(', '));
    }

    // 优先返回直接可执行的文件
    for (const file of candidates) {
        if (await isExecutable(file).catch(() => false)) {
            return file;
        }
    }

    // 如果没有可执行的，返回第一个候选
    return candidates[0];
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


// 简单 SRT 解析 -> segments
function parseSrt(content: string): Array<{ start: number; end: number; text: string }> {
    const lines = content.replace(/\r/g, '').split('\n');
    const segments: Array<{ start: number; end: number; text: string }> = [];

    function timeToSec(t: string) {
        const [hh, mm, rest] = t.split(':');
        const [ss, ms] = rest.split(',');
        const h = parseInt(hh, 10);
        const m = parseInt(mm, 10);
        const s = parseInt(ss, 10);
        const milli = parseInt(ms, 10);
        if ([h, m, s, milli].some((x) => Number.isNaN(x))) return NaN;
        return h * 3600 + m * 60 + s + milli / 1000;
    }

    let i = 0;
    while (i < lines.length) {
        if (!lines[i]?.trim()) {
            i++;
            continue;
        }
        const idxLine = lines[i++].trim();
        if (!/^\d+$/.test(idxLine)) {
            continue;
        }

        const timeLine = lines[i++] || '';
        const m = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (!m) {
            while (i < lines.length && lines[i]?.trim()) i++;
            i++;
            continue;
        }
        const start = timeToSec(m[1]);
        const end = timeToSec(m[2]);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            while (i < lines.length && lines[i]?.trim()) i++;
            i++;
            continue;
        }

        const textLines: string[] = [];
        while (i < lines.length && lines[i]?.trim()) {
            textLines.push(lines[i++]);
        }
        i++; // skip blank line

        segments.push({
            start,
            end,
            text: textLines.join('\n').trim(),
        });
    }
    return segments;
}

@injectable()
export class ParakeetServiceImpl implements ParakeetService {
    private initialized = false;

    // 防并发下载（同一进程内）
    private downloadingPromise: Promise<void> | null = null;

    private logger = getMainLogger('ParakeetServiceImpl');

    // 动态获取路径方法
    private getModelRoot(): string {
        return path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'whisper-asr');
    }

    private getModelPath(): string {
        return path.join(this.getModelRoot(), WHISPER_MODEL_FILE);
    }

    private getBinaryPath(): string {
        return path.join(this.getModelRoot(), binName());
    }

    constructor(
        @inject(TYPES.SettingService) private settingService: SettingService,
        @inject(TYPES.DpTaskService) private taskService: DpTaskService,
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.EchogardenService) private echogardenService: EchogardenService
    ) {}

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

    async checkModelDownloaded(): Promise<boolean> {
        return this.isModelDownloaded();
    }

    // 检查模型是否可用
    async checkModel(): Promise<{ success: boolean; log: string }> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            return await this.echogardenService.check({
                engine: 'whisper.cpp',
                whisperCpp: {
                    model: 'base.en',
                }
            });
        } catch (error) {
            this.logger.error('Model check failed', { error: error instanceof Error ? error.message : String(error) });
            return { success: false, log: error instanceof Error ? error.message : String(error) };
        }
    }

    // 下载模型文件（带进度），同时确保可执行文件存在（若无则自动构建）
    async downloadModel(progressCallback: (progress: number) => void): Promise<void> {
        if (this.downloadingPromise) {
            await this.downloadingPromise;
            progressCallback(1);
            return;
        }

        const runner = (async () => {
            if (await this.checkModelDownloaded()) {
                progressCallback(1);
                return;
            }

            await this.ensureDirs();

            const MODEL_WEIGHT = 0.95;

            // 1) 模型
            if (!(await fileExists(this.getModelPath()))) {
                await this.downloadFile(WHISPER_MODEL_URL, this.getModelPath(), (p) => {
                    progressCallback(Math.min(1, p * MODEL_WEIGHT));
                });
            } else {
                progressCallback(MODEL_WEIGHT);
            }

            // 2) 二进制
            if (!(await fileExists(this.getBinaryPath()))) {
                this.taskService.process(0, {progress: '正在获取 whisper.cpp2 可执行文件...'});
                await this.downloadBinary();
                try {
                    await fsPromises.chmod(this.getBinaryPath(), 0o755);
                } catch {
                    //
                }
            }

            progressCallback(1);
            this.settingService.set('whisper.modelDownloaded', 'true');
        })();

        this.downloadingPromise = runner.finally(() => {
            this.downloadingPromise = null;
        });

        await this.downloadingPromise;
    }

    // 通用流式下载（原子写入 + 简易重试，进度回调 0~1）
    private async downloadFile(url: string, filePath: string, progressCallback: (progress: number) => void): Promise<void> {
        const maxRetry = 2;
        const dir = path.dirname(filePath);
        await fsPromises.mkdir(dir, {recursive: true});

        for (let attempt = 0; attempt <= maxRetry; attempt++) {
            const tmpPath = `${filePath}.part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            let writer: fs.WriteStream | null = null;

            try {
                writer = createWriteStream(tmpPath);
                const response = await axios({
                    method: 'GET',
                    url,
                    responseType: 'stream',
                    maxRedirects: 5,
                    timeout: 600000, // 10分钟
                    validateStatus: (s) => s >= 200 && s < 400,
                });

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;

                response.data.on('data', (chunk: Buffer) => {
                    downloadedSize += chunk.length;
                    const p = totalSize > 0 ? downloadedSize / totalSize : 0;
                    progressCallback(p);
                    this.taskService.process(0, {progress: `模型/二进制下载中：${Math.round(p * 100)}%`});
                });

                const finishPromise = new Promise<void>((resolve, reject) => {
                    writer!.on('finish', resolve);
                    writer!.on('error', reject);
                });

                response.data.pipe(writer);
                await finishPromise;

                // 校验非空
                const st = await fsPromises.stat(tmpPath);
                if (!st.size) {
                    throw new Error('下载文件为空：' + url);
                }

                // 原子替换
                await fsPromises.rename(tmpPath, filePath);

                // 下载成功后退出重试循环
                return;
            } catch (e) {
                if (attempt >= maxRetry) {
                    const error = e as Error;
                    // 针对401错误提供更具体的建议
                    if (error.message.includes('401') || error.message.includes('403')) {
                        throw new Error('下载失败：访问被拒绝 (401/403)。可能是下载源需要认证或暂时不可用，请稍后重试或检查网络连接。');
                    } else if (error.message.includes('404')) {
                        throw new Error('下载失败：文件不存在 (404)。可能是下载链接已变更，请稍后重试。');
                    } else if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i.test(error.message)) {
                        throw new Error('下载失败：网络连接问题。请检查网络连接并稍后重试。');
                    } else {
                        throw e;
                    }
                }
                // 清理临时文件，继续重试
                try {
                    if (writer) {
                        writer.close();
                    }
                } catch {
                    //
                }
                try {
                    await fsPromises.rm(tmpPath, {force: true});
                } catch {
                    //
                }
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            } finally {
                // 最终保障：清理残留 .part
                try {
                    const files = await fsPromises.readdir(dir);
                    await Promise.all(
                        files
                            .filter((f) => f.startsWith(path.basename(filePath) + '.part_'))
                            .map((f) => fsPromises.rm(path.join(dir, f), {force: true}))
                    );
                } catch {
                    //
                }
            }
        }
    }

    // 下载预编译的 whisper.cpp2 可执行文件
    private async downloadBinary(): Promise<void> {
        const tempRoot = LocationUtil.staticGetStoragePath(LocationType.TEMP);
        const extractDir = path.join(tempRoot, 'whisper_extract_' + Date.now() + '_' + Math.random().toString(36).slice(2));
        const archivePath = path.join(tempRoot, 'whisper_binary_' + Date.now() + (isWindows() ? '.zip' : '.tgz'));

        await fsPromises.mkdir(extractDir, {recursive: true});

        try {
            const binaryUrl = getBinaryUrl();
            this.taskService.process(0, {progress: '正在下载 whisper.cpp2 预编译二进制...'});

            await this.downloadFile(binaryUrl, archivePath, (progress) => {
                this.taskService.process(0, {progress: `二进制下载中：${Math.round(progress * 100)}%`});
            });

            this.taskService.process(0, {progress: '正在解压二进制文件...'});
            await extractArchive(archivePath, extractDir);

            this.taskService.process(0, {progress: '正在查找可执行文件...'});
            const extractedBinary = await findWhisperBinary(extractDir);

            this.taskService.process(0, {progress: '正在安装可执行文件...'});
            await fsPromises.copyFile(extractedBinary, this.getBinaryPath());

            try {
                await fsPromises.chmod(this.getBinaryPath(), 0o755);
            } catch {
                //
            }

            this.taskService.process(0, {progress: '二进制文件安装完成'});
        } catch (e) {
            const error = e as Error;
            this.logger.error('Binary download failed', { error: error.message });

            if (error.message.includes('404')) {
                throw new Error('下载预编译二进制失败：文件不存在 (404)。可能是网络问题或版本已更新，请稍后重试。');
            } else if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i.test(error.message)) {
                throw new Error('下载预编译二进制失败：无法连接到服务器。请检查网络连接。');
            } else {
                throw new Error('下载预编译二进制失败：' + error.message);
            }
        } finally {
            // 清理临时文件
            try {
                await fsPromises.rm(archivePath, {force: true});
            } catch {
                //
            }
            try {
                await fsPromises.rm(extractDir, {recursive: true, force: true});
            } catch {
                //
            }
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // 初始化Echogarden服务
        await this.echogardenService.initialize();

        await this.ensureDirs();

        const ok = await this.isModelDownloaded();
        if (!ok) {
            throw new Error('whisper.cpp2 模型或可执行文件不存在，请先调用 downloadModel() 下载');
        }

        this.initialized = true;
    }

    // 运行 whisper.cpp2 CLI 进行转录，产出 SRT 文件
    private async runWhisperCpp(inputWavPath: string, lang?: string): Promise<{ srtPath: string; base: string }> {
        const tempDir = LocationUtil.staticGetStoragePath(LocationType.TEMP);
        await fsPromises.mkdir(tempDir, {recursive: true});
        const base = path.join(tempDir, `whisper_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        const srtPath = `${base}.srt`;

        const args = [
            '-m',
            this.getModelPath(),
            '-f',
            inputWavPath,
            '-osrt',
            '-of',
            base,
            '-nt',
        ];

        if (lang && lang !== 'auto') {
            args.push('-l', lang);
        }

        const binaryPath = this.getBinaryPath();

        // 检查二进制文件是否存在且有执行权限
        try {
            await fsPromises.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
            this.logger.info('Binary file exists and is executable', { binaryPath });

            // 检查文件大小
            const stats = await fsPromises.stat(binaryPath);
            this.logger.info('Binary file size', { size: stats.size });

            // 在macOS上检查架构兼容性
            if (process.platform === 'darwin') {
                this.logger.debug('Checking binary architecture on macOS');
                try {
                    const { stdout } = await execAsync(`file "${binaryPath}"`);
                    this.logger.debug('File type info', { stdout });

                    const { stdout: archOut } = await execAsync(`lipo -info "${binaryPath}"`);
                    this.logger.debug('Architecture info', { archOut });

                    // 检查当前系统架构
                    const currentArch = process.arch;
                    this.logger.debug('Current process arch', { currentArch });

                    // 检查是否包含当前架构
                    if (archOut.includes(currentArch)) {
                        this.logger.debug('Binary supports current architecture');
                    } else {
                        this.logger.warn('Binary may not support current architecture');
                    }
                } catch (fileError) {
                    this.logger.warn('Could not check binary architecture', { error: fileError instanceof Error ? fileError.message : String(fileError) });
                }
            }

        } catch (error) {
            this.logger.error('Binary file check failed', { error: error instanceof Error ? error.message : String(error) });
            throw new Error(`whisper二进制文件不存在或无执行权限: ${binaryPath}. 错误: ${error}`);
        }

        const threads = Math.max(1, Math.min(4, os.cpus()?.length || 2));
        args.push('-t', String(threads));

        let stderrBuf = '';
        this.logger.info('Starting whisper.cpp2', { binaryPath, args: args.join(' ') });

        await new Promise<void>((resolve, reject) => {
            this.logger.debug('Spawn options', { platform: process.platform, arch: process.arch });

            // 在macOS上尝试多种方法
            let child;
            if (process.platform === 'darwin') {
                this.logger.debug('Trying different execution methods for macOS');

                // 方法1: 直接spawn
                try {
                    const spawnOptions = {
                        stdio: ['ignore', 'pipe', 'pipe'] as const,
                        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin' }
                    };
                    this.logger.debug('Method 1: Direct spawn');
                    child = spawn(binaryPath, args, spawnOptions);
                } catch (spawnError) {
                    this.logger.debug('Method 1 failed, trying Method 2');

                    // 方法2: 使用shell
                    try {
                        const shellArgs = [binaryPath, ...args].map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ');
                        this.logger.debug('Method 2: Shell execution');
                        child = spawn('/bin/bash', ['-c', shellArgs], {
                            stdio: ['ignore', 'pipe', 'pipe'] as const
                        });
                    } catch (shellError) {
                        this.logger.debug('Method 2 failed, trying Method 3');

                        // 方法3: 使用绝对路径
                        try {
                            const absoluteBinary = path.resolve(binaryPath);
                            const absoluteArgs = args.map(arg => arg.includes(' ') ? `"${arg}"` : arg);
                            const shellArgs2 = [absoluteBinary, ...absoluteArgs].join(' ');
                            this.logger.debug('Method 3: Absolute path shell execution');
                            child = spawn('/bin/bash', ['-c', shellArgs2], {
                                stdio: ['ignore', 'pipe', 'pipe'] as const
                            });
                        } catch (absError) {
                            this.logger.error('All execution methods failed');
                            reject(absError);
                            return;
                        }
                    }
                }
            } else {
                // 非macOS平台
                const spawnOptions = { stdio: ['ignore', 'pipe', 'pipe'] as const };
                child = spawn(binaryPath, args, spawnOptions);
            }

            child.stdout.on('data', () => {
                // 需要的话可以解析 stdout
            });

            child.stderr.on('data', (d) => {
                const line = d.toString();
                stderrBuf += line;
                this.logger.debug('whisper.cpp2 stderr', { line });
            });

            child.on('error', (error) => {
                this.logger.error('whisper.cpp2 spawn error', { error: error.message });
                this.logger.error('Error details', {
                    message: error.message,
                    code: error.code,
                    errno: error.errno,
                    path: error.path,
                    spawnargs: error.spawnargs
                });
                reject(error);
            });
            child.on('close', (code) => {
                this.logger.info('whisper.cpp2 exited', { code });
                if (code === 0) resolve();
                else reject(new Error(`whisper.cpp 退出码：${code}${stderrBuf ? `，stderr: ${stderrBuf}` : ''}`));
            });
        });

        if (!(await fileExists(srtPath))) {
            throw new Error('whisper.cpp2 未生成 SRT 文件');
        }
        return {srtPath, base};
    }

    async transcribeAudio(taskId: number, audioPath: string): Promise<TranscriptionResult> {
        this.taskService.process(taskId, {progress: '开始音频转录...'});
        this.logger.info('TRANSCRIPTION METHOD CALLED', { taskId, audioPath }); // 确保能看到这个日志
        
        if (!this.initialized) {
            await this.initialize();
        }

        // 记录初始内存使用情况

        let processedAudioPath: string | null = null;

        try {
            this.taskService.process(taskId, {progress: '音频预处理（转换为 16k WAV）...'});
            processedAudioPath = await this.ensureWavFormat(audioPath);

            this.taskService.process(taskId, {progress: 'Echogarden 开始识别...'});
            this.logger.info('STARTING ECHOGARDEN RECOGNITION', { processedAudioPath });

            let recognitionResult: any;
            try {
                // 使用Echogarden进行语音识别，启用DTW生成词级时间戳
                this.logger.debug('Calling echogardenService.recognize with DTW enabled...');
                recognitionResult = await this.echogardenService.recognize(processedAudioPath, {
                    engine: 'whisper.cpp',
                    language: 'en',
                    whisperCpp: {
                        model: 'base.en',
                        enableDTW: true,              // 启用DTW算法生成精确词级时间戳
                        enableFlashAttention: false,   // 确保DTW不被禁用
                        splitCount: 1,                 // 提高时间准确性
                        threadCount: 4                  // 根据CPU核心数调整
                    }
                });
                this.logger.info('ECHOGARDEN RECOGNITION COMPLETED', { 
                    hasResult: !!recognitionResult,
                    hasWordTimeline: !!(recognitionResult as any)?.wordTimeline,
                    wordTimelineLength: (recognitionResult as any)?.wordTimeline?.length || 0
                });

            } catch (recognitionError) {
                this.logger.error('ECHOGARDEN RECOGNITION FAILED', { 
                    error: recognitionError instanceof Error ? recognitionError.message : String(recognitionError),
                    stack: recognitionError instanceof Error ? recognitionError.stack : undefined
                });
                throw recognitionError;
            }

            this.taskService.process(taskId, {progress: '处理识别结果...'});

  
            let segments: Array<{ start: number; end: number; text: string }> = [];
            let words: Array<{ word: string; start: number; end: number }> = [];

            // 检查recognitionResult的结构（使用项目logger）
            this.logger.debug('Recognition result', {
                hasWordTimeline: !!recognitionResult.wordTimeline,
                wordTimelineLength: recognitionResult.wordTimeline?.length || 0,
                hasTimeline: !!recognitionResult.timeline,
                timelineLength: recognitionResult.timeline?.length || 0,
                transcriptLength: recognitionResult.transcript?.length || 0,
                language: recognitionResult.language
            });

            // 直接使用whisper.cpp + DTW生成的词级时间戳
          this.taskService.process(taskId, {progress: '处理DTW词级时间戳...'});

          this.logger.debug('=== DEBUG: DTW Word-level Timeline Processing ===');
          this.logger.debug('Recognition result keys:', Object.keys(recognitionResult).slice(0, 20)); // Limit to first 20 keys
          this.logger.debug('WordTimeline exists:', !!recognitionResult.wordTimeline);
          this.logger.debug('WordTimeline length:', recognitionResult.wordTimeline?.length || 0);
          this.logger.debug('Timeline exists:', !!recognitionResult.timeline);
          this.logger.debug('Transcript length:', recognitionResult.transcript?.length || 0);

          // 优先使用whisper.cpp + DTW直接生成的词级时间戳
          if (recognitionResult.wordTimeline && recognitionResult.wordTimeline.length > 0) {
              this.logger.debug('Using whisper.cpp DTW word timeline directly');

              // 提取词级别时间轴
              words = this.extractWordTimeline(recognitionResult.wordTimeline);

              if (words.length > 0) {
                  this.logger.debug('Successfully extracted word-level timeline');
                  this.logger.debug('Words count:', words.length);
                  this.logger.debug('Sample word:', words[0]);

                  // 使用Echogarden的wordToSentenceTimeline进行智能分句
                  this.taskService.process(taskId, {progress: '智能分句处理...'});

                  try {
                      this.logger.debug('Calling wordToSentenceTimeline...');
                      const sentenceTimeline = await this.echogardenService.wordToSentenceTimeline(
                          words,
                          recognitionResult.transcript || words.map(w => w.word).join(' '),
                          'en'
                      );

                      this.logger.debug('wordToSentenceTimeline returned:', {
                          timelineLength: sentenceTimeline?.length || 0,
                          firstEntry: sentenceTimeline?.[0],
                          lastEntry: sentenceTimeline?.[sentenceTimeline?.length - 1]
                      });

                      segments = sentenceTimeline.map((entry: any) => ({
                          start: entry.startTime || entry.start || 0,
                          end: entry.endTime || entry.end || 0,
                          text: entry.text || entry.sentence || ''
                      })).filter(s => s.text && s.end > s.start);

                      this.logger.debug('Word-to-sentence segmentation completed');
                      this.logger.debug('Segments count:', segments.length);
                      this.logger.debug('Segments before filter:', sentenceTimeline?.length || 0);
                      this.logger.debug('Segments after filter:', segments.length);

                      if (segments.length === 0) {
                          this.logger.warn('No segments after filtering, checking sample entries:');
                          for (let i = 0; i < Math.min(3, (sentenceTimeline || []).length); i++) {
                              const entry = sentenceTimeline[i];
                              this.logger.warn(`Entry ${i}:`, {
                                  text: entry.text || entry.sentence,
                                  start: entry.startTime || entry.start,
                                  end: entry.endTime || entry.end,
                                  hasText: !!(entry.text || entry.sentence),
                                  validTime: !!(entry.endTime || entry.end) > !!(entry.startTime || entry.start)
                              });
                          }
                      }

                  } catch (sentenceError) {
                      this.logger.warn('wordToSentenceTimeline failed, using local segmentation:', sentenceError);
                      segments = this.createSegmentsFromWordTimeline(words);
                  }

              } else {
                  throw new Error('Failed to extract valid words from wordTimeline');
              }

          } else {
              throw new Error('No wordTimeline available - DTW-based word-level timestamps are required');
          }

            // 安全的文本拼接
            let text: string;
            try {
                if (recognitionResult.transcript) {
                    text = recognitionResult.transcript;
                } else {
                    // 分块拼接避免超大字符串
                    const chunkSize = 100;
                    let combinedText = '';
                    for (let i = 0; i < segments.length; i += chunkSize) {
                        const chunk = segments.slice(i, i + chunkSize);
                        combinedText += chunk.map(s => s.text).join(' ') + ' ';
                        if (combinedText.length > 1000000) { // 限制最大1MB
                            this.logger.warn('Text concatenation exceeding 1MB, stopping early');
                            break;
                        }
                    }
                    text = combinedText.trim();
                }
            } catch (error) {
                this.logger.error('Error concatenating text:', error);
                text = 'Text processing failed';
            }

            // 记录最终内存使用情况
            this.logger.debug(`Segments count: ${segments.length}, Words count: ${words.length}, Text length: ${text.length}`);

            this.taskService.process(taskId, {progress: '转录完成'});

            return {
                text,
                segments,
                words,
                timestamps: words.map(w => ({ token: w.word, start: w.start, end: w.end })),
            };
        } catch (err) {
            const error = err as Error;
            this.logger.error('=== ERROR: Transcription failed ===');
            this.logger.error('Error message:', error.message);
            this.logger.error('Error stack:', error.stack);
            this.logger.error('Error name:', error.name);

            this.taskService.process(taskId, {progress: `转录失败: ${error.message}`});
            throw err;
        } finally {
            // 清理临时文件
            try {
                if (processedAudioPath) await fsPromises.rm(processedAudioPath, {force: true});
            } catch {
                //
            }
        }
    }

    async generateSrt(taskId: number, audioPath: string, outputPath: string): Promise<void> {
        return this.generateSrtFromResult(taskId, audioPath, outputPath, null);
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
                this.logger.warn('Error processing timeline entry:', error, entry);
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
    private createSegmentsFromWordTimeline(words: Array<{ word: string; start: number; end: number }>): Array<{ start: number; end: number; text: string }> {
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
    private shouldSplitSegment(words: Array<{ word: string }>, currentWord: { word: string }): boolean {
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


    dispose(): void {
        this.initialized = false;
    }
}

export default ParakeetServiceImpl;

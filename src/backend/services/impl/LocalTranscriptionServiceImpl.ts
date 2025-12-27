// @/backend/services/impl/LocalTranscriptionServiceImpl.ts
import {injectable, inject} from 'inversify';
import {TranscriptionService} from '@/backend/services/TranscriptionService';
import SettingService from '@/backend/services/SettingService';
import RendererGateway from '@/backend/services/RendererGateway';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import LocationUtil from '@/backend/utils/LocationUtil';
import {LocationType} from '@/backend/services/LocationService';
import FfmpegService from '@/backend/services/FfmpegService';
import {getMainLogger} from '@/backend/ioc/simple-logger';
import objectHash from 'object-hash';
import SrtUtil, {SrtLine} from '@/common/utils/SrtUtil';
import {DpTaskState} from "@/backend/infrastructure/db/tables/dpTask";

@injectable()
export class LocalTranscriptionServiceImpl implements TranscriptionService {
    // 当前正在处理的文件路径
    private activeFilePath: string | null = null;

    // 被请求取消的文件集合
    private cancelled = new Set<string>();

    // 队列：一次只处理一个任务
    private processing = false;
    private queue: Array<string> = [];

    // 记录每个文件的 Promise 控制器
    private deferred = new Map<string, { resolve: () => void; reject: (e: any) => void }>();

    private logger = getMainLogger('LocalTranscriptionService');
    private activeWhisperProcess: ChildProcess | null = null;
    private whisperHelpCache: string | null = null;

    constructor(
        @inject(TYPES.SettingService) private settingService: SettingService,
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.RendererGateway) private rendererGateway: RendererGateway
    ) {}

    private async ensureWavFormat(inputPath: string): Promise<string> {
        const tempDir = LocationUtil.staticGetStoragePath(LocationType.TEMP);
        await fsPromises.mkdir(tempDir, {recursive: true});
        const out = path.join(tempDir, `converted_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
        await this.ffmpegService.convertToWav(inputPath, out);
        return out;
    }

    private sendProgress(taskId: number, filePath: string, status: string, progress: number, result?: any) {
        // 将进度信息合并到 message 字段中
        const finalResult = result || {};
        if (progress !== undefined && progress !== null) {
            finalResult.message = `[${progress}%] ${finalResult.message || ''}`.trim();
        }

        this.rendererGateway.fireAndForget('transcript/batch-result', {
            updates: [{
                filePath,
                taskId,
                status,
                result: finalResult
            }]
        });
    }

    // 队列入口：仅排队文件路径
    public async transcribe(filePath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // 检查是否已经在队列中或正在处理
            if (this.queue.includes(filePath) || this.activeFilePath === filePath) {
                this.sendProgress(0, filePath, DpTaskState.FAILED, 0, {
                    message: '该文件已在转录队列中或正在处理'
                });
                reject(new Error('File already in queue or processing'));
                return;
            }

            // 为该文件保存回调
            this.deferred.set(filePath, { resolve, reject });

            // 将文件加入队列
            this.queue.push(filePath);

            // 如果当前已在处理任务，则提示排队
            if (this.processing || this.activeFilePath !== null || this.queue.length > 1) {
                this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 0, {
                    message: '已加入队列，等待前一个文件转录完成...'
                });
            }

            // 触发队列处理
            this.pump().catch(err => this.logger.error('pump failed', { err }));
        });
    }

    // 队列调度器：一次只处理一个任务
    private async pump(): Promise<void> {
        if (this.processing) return;

        const next = this.queue.shift();
        if (!next) return;

        this.processing = true;
        const filePath = next;

        try {
            await this.doTranscribe(filePath);
            this.deferred.get(filePath)?.resolve();
        } catch (e) {
            this.deferred.get(filePath)?.reject(e);
        } finally {
            this.deferred.delete(filePath);
            this.cancelled.delete(filePath); // 清理取消标记
            this.processing = false;

            // 继续下一个
            await this.pump();
        }
    }

    // doTranscribe：使用按文件路径的取消检查
    private async doTranscribe(filePath: string): Promise<void> {
        this.activeFilePath = filePath;

        let processedAudioPath = '';
        let tempFolder: string | null = null;

        try {
            // 开始
            this.sendProgress(0, filePath, DpTaskState.INIT, 0);
            if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');

            this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 5, { message: '开始音频转录...' });

            // 预处理
            if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');
            this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 5, { message: '音频预处理（转换为 16k WAV）...' });
            processedAudioPath = await this.ensureWavFormat(filePath);

            // 引擎选择（按配置，不做兜底）
            const transcriptionEngine = await this.settingService.getCurrentTranscriptionProvider();

            this.logger.info('Transcription config', {
                transcriptionEngine,
            });

            // 临时目录
            // 包含时间戳，避免同一文件并发任务相互覆盖
            const folderName = objectHash(`${filePath}::${Date.now()}`);
            tempFolder = path.join(LocationUtil.staticGetStoragePath(LocationType.TEMP), 'parakeet', folderName);
            await fsPromises.mkdir(tempFolder, {recursive: true});

            // 本地 whisper.cpp CLI 走内置语言自动检测（-l auto），无需额外语言检测步骤
            if (transcriptionEngine !== 'whisper') {
                throw new Error('Local transcription is not enabled by configuration.');
            }
            await this.transcribeWithWhisperCppCli({
                filePath,
                processedAudioPath,
                tempFolder,
            });
            return;

        } catch (error) {
            if (this.isCancelled(filePath)) {
                this.sendProgress(0, filePath, DpTaskState.CANCELLED, 0, { message: '转录任务已取消' });
            } else {
                this.sendProgress(0, filePath, DpTaskState.FAILED, 0, { error: error instanceof Error ? error.message : String(error) });
            }
            throw error;
        } finally {
            this.activeFilePath = null;
            this.activeWhisperProcess = null;

            // 清理临时文件
            try {
                // processedAudioPath 可能为同一路径（已转 WAV），谨慎删除
                if (processedAudioPath) await fsPromises.rm(processedAudioPath, {force: true});
                if (tempFolder) await fsPromises.rm(tempFolder, {recursive: true, force: true});
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup temporary files', {cleanupError});
            }
        }
    }

    private resolveWhisperCppExecutablePath(): string {
        const isDev = process.env.NODE_ENV === 'development';
        const basePath = isDev ? path.resolve('lib', 'whisper.cpp') : path.join(process.resourcesPath, 'lib', 'whisper.cpp');

        const platform = process.platform;
        const platformDir = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
        const archDir = process.arch === 'arm64' ? 'arm64' : 'x64';

        const candidates: string[] = [];
        if (platform === 'win32') {
            candidates.push(
                path.join(basePath, archDir, platformDir, 'whisper-cli.exe'),
                path.join(basePath, archDir, platformDir, 'main.exe'),
            );
        } else {
            candidates.push(
                path.join(basePath, archDir, platformDir, 'whisper-cli'),
                path.join(basePath, archDir, platformDir, 'main'),
            );
        }

        for (const p of candidates) {
            if (fs.existsSync(p)) return p;
        }

        throw new Error(`whisper.cpp executable not found: ${candidates.join(', ')}`);
    }

    private async getWhisperCppHelp(executablePath: string): Promise<string> {
        if (this.whisperHelpCache) return this.whisperHelpCache;

        const helpText = await new Promise<string>((resolve) => {
            const child = spawn(executablePath, ['-h'], { stdio: ['ignore', 'pipe', 'pipe'] });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => (stdout += String(d)));
            child.stderr.on('data', (d) => (stderr += String(d)));
            child.on('close', () => resolve((stdout || stderr || '').toString()));
        });

        this.whisperHelpCache = helpText;
        return helpText;
    }

    private async transcribeWithWhisperCppCli(opts: { filePath: string; processedAudioPath: string; tempFolder: string }): Promise<void> {
        const { filePath, processedAudioPath, tempFolder } = opts;

        const executablePath = this.resolveWhisperCppExecutablePath();
        const help = await this.getWhisperCppHelp(executablePath);
        const supportsVadFlag = /--vad\b/.test(help);
        const supportsVadModelFlag = /\s-vm\b/.test(help) || /--vad-model\b/.test(help);

        const modelSize = (await this.settingService.get('whisper.modelSize')) === 'large' ? 'large' : 'base';
        const enableVad = true;
        const vadModel = 'silero-v6.2.0' as const;

        const whisperModelTag = modelSize === 'large' ? 'large-v3' : 'base';
        const modelsRoot = LocationUtil.staticGetStoragePath('models');
        const modelPath = path.join(modelsRoot, 'whisper', `ggml-${whisperModelTag}.bin`);
        if (!fs.existsSync(modelPath)) {
            throw new Error(`本地 Whisper 模型未下载：${modelSize}。请在【设置 → 服务配置 → Whisper 本地字幕识别】中下载模型后再转录。`);
        }

        let vadModelPath: string | null = null;
        if (enableVad) {
            if (!supportsVadFlag) {
                this.logger.warn('whisper.cpp binary does not support VAD flags; please update whisper-cli for --vad support');
                this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 12, { message: '当前 whisper.cpp 不支持静音检测参数，将跳过静音检测' });
            } else if (supportsVadModelFlag) {
                vadModelPath = path.join(modelsRoot, 'whisper-vad', `ggml-${vadModel}.bin`);
                if (!fs.existsSync(vadModelPath)) {
                    throw new Error(`静音检测模型未下载。请在【设置 → 服务配置 → Whisper 本地字幕识别】中下载静音检测模型后再转录。`);
                }
            }
        }

        if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');

        const outPrefix = path.join(tempFolder, 'whispercpp_out');
        const outSrt = `${outPrefix}.srt`;

        const args: string[] = [
            '-m', modelPath,
            '-f', processedAudioPath,
            '-l', 'auto',
            '-osrt',
            '-of', outPrefix,
            ...(help.includes('--print-progress') || help.includes('-pp') ? ['-pp'] : []),
        ];

        if (enableVad && supportsVadFlag) {
            args.push('--vad');
            if (vadModelPath && supportsVadModelFlag) {
                args.push('-vm', vadModelPath);
            }
        }

        this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 10, { message: 'whisper.cpp 正在识别...' });
        const progressFromWhisperPercent = (p: number) => Math.max(10, Math.min(90, Math.floor(10 + p * 0.8)));
        let lastReportedProgress = 10;
        let lastProgressUpdateAt = 0;
        let hasSeenWhisperPercent = false;
        const maybeReportProgress = (percent: number) => {
            const now = Date.now();
            if (!Number.isFinite(percent)) return;
            const boundedPercent = Math.max(0, Math.min(100, Math.floor(percent)));
            const progress = progressFromWhisperPercent(boundedPercent);
            const shouldUpdate =
                progress > lastReportedProgress ||
                (now - lastProgressUpdateAt > 1500 && progress >= lastReportedProgress);
            if (!shouldUpdate) return;
            hasSeenWhisperPercent = true;
            lastReportedProgress = progress;
            lastProgressUpdateAt = now;
            this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, progress, { message: 'whisper.cpp 正在识别...' });
        };

        try {
            await new Promise<void>((resolve, reject) => {
                const child = spawn(executablePath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
                this.activeWhisperProcess = child;

                let stderr = '';
                // eslint-disable-next-line no-control-regex
                const ansiRegex = new RegExp('\\x1b\\[[0-9;]*m', 'g');
                const stripAnsi = (s: string) => s.replace(ansiRegex, '');
                const percentRegexGlobal = /(\d{1,3})%/g;
                const floatProgressRegexGlobal = /\bprogress\s*=\s*(\d*\.\d+)\b/gi;

                const scanForPercent = (text: string) => {
                    const clean = stripAnsi(text);
                    let m: RegExpExecArray | null;
                    while ((m = percentRegexGlobal.exec(clean)) !== null) {
                        maybeReportProgress(Number(m[1]));
                    }
                    while ((m = floatProgressRegexGlobal.exec(clean)) !== null) {
                        const v = Number(m[1]);
                        if (!Number.isFinite(v)) continue;
                        if (v >= 0 && v <= 1.01) {
                            maybeReportProgress(v * 100);
                        }
                    }
                };

                child.stdout.on('data', (d) => {
                    scanForPercent(String(d));
                });
                child.stderr.on('data', (d) => {
                    const chunk = String(d);
                    stderr += chunk;
                    scanForPercent(chunk);
                });

                const heartbeat = setInterval(() => {
                    if (this.isCancelled(filePath)) return;
                    if (hasSeenWhisperPercent) return;
                    const now = Date.now();
                    if (now - lastProgressUpdateAt < 8000) return;
                    lastProgressUpdateAt = now;
                    this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, lastReportedProgress, { message: 'whisper.cpp 正在识别...' });
                }, 4000);

                child.on('error', reject);
                child.on('close', (code) => {
                    clearInterval(heartbeat);
                    if (code === 0) resolve();
                    else reject(new Error(`whisper.cpp exit code ${code}: ${stderr.slice(-2000)}`));
                });
            });
        } finally {
            this.activeWhisperProcess = null;
        }

        if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');
        if (!fs.existsSync(outSrt)) {
            throw new Error(`whisper.cpp did not generate srt output: ${outSrt}`);
        }

        this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 95, { message: '整理字幕文件...' });
        const srtContentRaw = await fsPromises.readFile(outSrt, 'utf-8');
        const parsedLines = SrtUtil.parseSrt(srtContentRaw);

        const SHIFT_SECONDS = -0.2;
        const shiftedLines: SrtLine[] = parsedLines
            .map((l, idx) => ({
                index: idx + 1,
                start: Math.max(0, l.start + SHIFT_SECONDS),
                end: Math.max(0, l.end + SHIFT_SECONDS),
                contentEn: l.contentEn,
                contentZh: l.contentZh,
            }))
            .filter(l => l.end > l.start);

        const finalSrt = SrtUtil.srtLinesToSrt(shiftedLines, { reindex: true });
        const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
        await fsPromises.writeFile(srtFileName, finalSrt);

        this.sendProgress(0, filePath, DpTaskState.DONE, 100, { srtPath: srtFileName });
    }

    // 取消逻辑：按文件路径取消
    public cancel(filePath: string): boolean {
        // 标记为已取消
        this.cancelled.add(filePath);

        // 如果在排队中，直接移出队列并回调
        const idx = this.queue.indexOf(filePath);
        if (idx >= 0) {
            this.queue.splice(idx, 1);
            try {
                this.sendProgress(0, filePath, DpTaskState.CANCELLED, 0, { message: '转录任务已取消（尚未开始）' });
            } catch {
                //
            }
            this.deferred.get(filePath)?.reject(new Error('Transcription cancelled by user'));
            this.deferred.delete(filePath);
            this.cancelled.delete(filePath);
            return true;
        }

        // 如果是当前任务，doTranscribe 会在检查点自行退出
        if (this.activeFilePath === filePath) {
            try {
                this.activeWhisperProcess?.kill('SIGKILL');
            } catch {
                //
            }
            return true;
        }

        // 任务不存在，清理取消标记并返回 false
        this.cancelled.delete(filePath);
        return false;
    }

    private isCancelled(filePath: string): boolean {
        return this.cancelled.has(filePath);
    }



    private createSegmentsFromWordTimeline(words: Array<{ word: string; start: number; end: number }>): Array<{ start: number; end: number; text: string }> {
        if (!words || words.length === 0) return [];

        const MAX_DURATION_S = 6.5;
        const MAX_WORDS = 16;
        const MAX_CHARS = 80;
        const GAP_BREAK_S = 0.6;

        const SENTENCE_ENDERS = /[.!?。！？]+$/;
        const CLAUSE_BREAKERS = /[,;:，；：、]+$/;
        const PUNCT_ONLY = /^[,.;:!?，。！？；：、]+$/;

        const calcAppendLen = (currentLen: number, currentCount: number, token: string): number => {
            if (!token) return 0;
            if (PUNCT_ONLY.test(token)) return token.length;
            return currentCount > 0 ? (1 + token.length) : token.length;
        };

        const joinTokens = (tokens: string[]): string => {
            let out = '';
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (!t) continue;
                if (PUNCT_ONLY.test(t)) {
                    out += t;
                } else {
                    out += (out.length > 0 ? ' ' : '') + t;
                }
            }
            return out.replace(/\s{2,}/g, ' ').trim();
        };

        const segments: Array<{ start: number; end: number; text: string }> = [];
        let current: { start: number; end: number; tokens: string[]; nonPunctWordCount: number; charLen: number } | null = null;
        let prevEnd = words[0].start;

        for (const w of words) {
            const t = (w.word || '').trim();
            if (!t) { prevEnd = w.end; continue; }

            if (current && (w.start - prevEnd) >= GAP_BREAK_S) {
                const text = joinTokens(current.tokens);
                if (text) segments.push({ start: current.start, end: current.end, text });
                current = null;
            }

            if (!current) {
                current = { start: w.start, end: w.end, tokens: [], nonPunctWordCount: 0, charLen: 0 };
            }

            const addLen = calcAppendLen(current.charLen, current.tokens.length, t);
            const wouldCharLen = current.charLen + addLen;
            const wouldNonPunctCount = current.nonPunctWordCount + (PUNCT_ONLY.test(t) ? 0 : 1);
            const wouldEnd = w.end;
            const wouldDuration = wouldEnd - current.start;

            const willExceed = wouldDuration > MAX_DURATION_S || wouldNonPunctCount > MAX_WORDS || wouldCharLen > MAX_CHARS;

            if (willExceed) {
                const text = joinTokens(current.tokens);
                if (text) segments.push({ start: current.start, end: current.end, text });
                current = { start: w.start, end: w.end, tokens: [t], nonPunctWordCount: PUNCT_ONLY.test(t) ? 0 : 1, charLen: t.length };
                prevEnd = w.end;
                continue;
            }

            current.tokens.push(t);
            current.end = w.end;
            current.charLen = wouldCharLen;
            current.nonPunctWordCount = wouldNonPunctCount;

            if (SENTENCE_ENDERS.test(t)) {
                const text = joinTokens(current.tokens);
                if (text) segments.push({ start: current.start, end: current.end, text });
                current = null;
                prevEnd = w.end;
                continue;
            }

            if (CLAUSE_BREAKERS.test(t)) {
                const longEnough = current.nonPunctWordCount >= 8 || current.charLen >= Math.floor(MAX_CHARS * 0.65) || (current.end - current.start) >= (MAX_DURATION_S * 0.8);
                if (longEnough) {
                    const text = joinTokens(current.tokens);
                    if (text) segments.push({ start: current.start, end: current.end, text });
                    current = null;
                    prevEnd = w.end;
                    continue;
                }
            }

            prevEnd = w.end;
        }

        if (current && current.tokens.length > 0) {
            const text = joinTokens(current.tokens);
            if (text) segments.push({ start: current.start, end: current.end, text });
        }

        return segments.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && (s.text || '').trim().length > 0);
    }

    private segmentsToSrt(segments: Array<{ start: number; end: number; text: string }>): string {
        const lines: SrtLine[] = segments.map((segment, index) => ({
            index: index + 1,
            start: segment.start,
            end: segment.end,
            contentEn: segment.text,
            contentZh: ''
        }));
        return SrtUtil.srtLinesToSrt(lines, { reindex: true });
    }
}

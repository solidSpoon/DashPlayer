// @/backend/services/impl/LocalTranscriptionServiceImpl.ts
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
import SrtUtil, {SrtLine} from '@/common/utils/SrtUtil';
import {storeGet} from "@/backend/store";
import {VADOptions} from "echogarden";
import {DpTaskState} from "@/backend/db/tables/dpTask";

@injectable()
export class LocalTranscriptionServiceImpl implements TranscriptionService {
    // 正在执行的任务 ID
    private activeTaskId: number | null = null;

    // 被请求取消的任务集合（按 ID 管理）
    private cancelled = new Set<number>();

    // 队列：一次只处理一个任务
    private processing = false;
    private queue: Array<{ taskId: number; filePath: string }> = [];

    // 记录每个任务的 Promise 控制器，便于在取消/失败时回调
    private deferred = new Map<number, { resolve: () => void; reject: (e: any) => void }>();

    private logger = getMainLogger('LocalTranscriptionService');

    constructor(
        @inject(TYPES.SettingService) private settingService: SettingService,
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.SystemService) private systemService: SystemService
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
        
        this.systemService.callRendererApi('transcript/batch-result', {
            updates: [{
                filePath,
                taskId,
                status,
                result: finalResult
            }]
        });
    }

    // 队列入口：仅排队任务对象，不再排队"方法"
    public async transcribe(taskId: number, filePath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // 为该任务保存回调
            this.deferred.set(taskId, { resolve, reject });

            // 将任务加入队列
            this.queue.push({ taskId, filePath });

            // 如果当前已在处理任务，则提示排队
            if (this.processing || this.activeTaskId !== null || this.queue.length > 1) {
                this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 0, {
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
        const { taskId, filePath } = next;

        try {
            await this.doTranscribe(taskId, filePath);
            this.deferred.get(taskId)?.resolve();
        } catch (e) {
            this.deferred.get(taskId)?.reject(e);
        } finally {
            this.deferred.delete(taskId);
            this.cancelled.delete(taskId); // 清理取消标记
            this.processing = false;

            // 继续下一个
            await this.pump();
        }
    }

    // doTranscribe：使用按 ID 的取消检查，去掉全局布尔
    private async doTranscribe(taskId: number, filePath: string): Promise<void> {
        this.activeTaskId = taskId;

        let processedAudioPath: string | null = null;
        let tempFolder: string | null = null;

        try {
            // 开始
            this.sendProgress(taskId, filePath, DpTaskState.INIT, 0);
            if (this.isCancelled(taskId)) throw new Error('Transcription cancelled by user');

            this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 5, { message: '开始音频转录...' });

            // 预处理
            if (this.isCancelled(taskId)) throw new Error('Transcription cancelled by user');
            this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 5, { message: '音频预处理（转换为 16k WAV）...' });
            processedAudioPath = await this.ensureWavFormat(filePath);

            // 动态导入 Echogarden（避免 wasm 打包问题）
            const Echogarden = await import('echogarden');

            // 自动语言检测
            if (this.isCancelled(taskId)) throw new Error('Transcription cancelled by user');
            this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 7, { message: '自动检测语音语言...' });
            const langDetect = await Echogarden.detectSpeechLanguage(processedAudioPath, {
                engine: 'whisper',
                crop: true,
                vad: {
                    engine: 'silero',
                    activityThreshold: 0.4, // 降低阈值以提高检测灵敏度
                    silero: { frameDuration: 90, provider: 'cpu' }
                }
            });

            const detectedLanguage = (langDetect as any).detectedLanguage || (langDetect as any).language || 'en';
            this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 9, { message: `检测到语言：${detectedLanguage}` });

            // 引擎选择（按配置，不做兜底）
            const whisperTranscriptionEnabled = await this.settingService.get('whisper.enableTranscription') === 'true';
            const openaiTranscriptionEnabled = await this.settingService.get('services.openai.enableTranscription') === 'true';

            this.logger.info('Transcription config', {
                whisperTranscriptionEnabled,
                openaiTranscriptionEnabled,
            })

            const ak = storeGet('apiKeys.openAi.key');
            const ep = storeGet('apiKeys.openAi.endpoint');

            const recognitionConfig = await this.buildRecognitionConfig({
                language: detectedLanguage,
                whisperTranscriptionEnabled,
                openaiTranscriptionEnabled,
                openaiApiKey: ak,
                openaiEndpoint: ep
            });

            // 临时目录
            // 包含 taskId，避免同一文件并发任务相互覆盖
            const folderName = objectHash(`${filePath}::${taskId}`);
            tempFolder = path.join(LocationUtil.staticGetStoragePath(LocationType.TEMP), 'parakeet', folderName);
            await fsPromises.mkdir(tempFolder, {recursive: true});

            // VAD 切段
            if (this.isCancelled(taskId)) throw new Error('Transcription cancelled by user');
            this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 10, { message: '基于 VAD 时间线切段音频...' });

            const vadOptions: VADOptions = {
                engine: 'silero',
                activityThreshold: 0.4, // 降低阈值以提高检测灵敏度
                silero: { frameDuration: 90, provider: 'cpu' as const }
            };

            const result = await Echogarden.detectVoiceActivity(processedAudioPath, vadOptions);
            const timeline = (result as any)?.timeline ?? result; // 兼容部分版本直接返回 timeline

            // 基础调试：观察顶层key和 segments/ranges 情况
            this.logger.debug('VAD timeline shape', {
                keys: timeline ? Object.keys(timeline) : null,
                type: Array.isArray(timeline) ? 'array' : typeof timeline,
                preview: Array.isArray(timeline) ? timeline.slice(0, 3) : (timeline?.segments || timeline?.ranges || []).slice?.(0, 3)
            });

            // 使用新的归一化方法构建切段范围
            let ranges = this.normalizeVadSegments(timeline, {
                mergeGapSeconds: 0.4,
                maxSegmentSeconds: 60,
                padBefore: 0.10,
                padAfter: 0.20
            });

            this.logger.debug('VAD result analysis', {
                detectedRanges: ranges.length,
                totalDuration: ranges.reduce((acc, r) => acc + (r.end - r.start), 0)
            });

            let segmentFiles: string[] = [];
            let isVadMode = ranges.length > 0;

            if (isVadMode) {
                this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 10, {
                    message: `VAD 检测到 ${ranges.length} 个语音片段，正在切分音频...`
                });

                segmentFiles = await this.ffmpegService.splitAudioByTimeline({
                    inputFile: processedAudioPath,
                    ranges,
                    outputFolder: tempFolder,
                    outputFilePrefix: 'vad_segment_'
                });

                // 容错：若切段后没有文件（极端情况），回退到定长切段
                if (segmentFiles.length === 0) {
                    this.logger.warn('VAD produced ranges but no physical segments; fallback to fixed-size splitting');
                    isVadMode = false;
                }
            }

            if (!isVadMode) {
                // 回退：定长 60s 切段
                this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 10, {
                    message: `VAD 未检测到语音片段（共 ${ranges.length} 段），回退为 60s 定长切段...`
                });
                segmentFiles = await this.ffmpegService.splitToAudio({
                    taskId,
                    inputFile: processedAudioPath,
                    outputFolder: tempFolder,
                    segmentTime: 60
                });
                // 为后续偏移计算构造等量 ranges（按累积时间）
                ranges = [];
                let acc = 0;
                for (const sf of segmentFiles) {
                    const d = await this.ffmpegService.duration(sf);
                    ranges.push({ start: acc, end: acc + d });
                    acc += d;
                }
            }

            // 分段转录
            this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 30, { message: `开始分段转录（共 ${segmentFiles.length} 段）...` });

            const transcribedSegments: Array<{ start: number; end: number; text: string }> = [];
            const allWords: Array<{ word: string; start: number; end: number }> = [];

            for (let i = 0; i < segmentFiles.length; i++) {
                if (this.isCancelled(taskId)) throw new Error('Transcription cancelled by user');

                const segmentFile = segmentFiles[i];
                const segmentDuration = await this.ffmpegService.duration(segmentFile);

                // 让进度从 30% 平滑推进到 90%
                const progress = 30 + ((i + 1) / segmentFiles.length) * 60; // 30 -> 90
                this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, Math.floor(progress), { message: `转录段落 ${i + 1}/${segmentFiles.length}...` });

                // 偏移采用原始音频绝对起止时间（VAD 模式），回退模式则为累积时间（已在 ranges 构造）
                const offset = ranges[i]?.start ?? 0;
                const endAbs = ranges[i]?.end ?? (offset + segmentDuration);

                try {
                    const segmentResult = await this.transcribeSegmentWithConfig(
                        segmentFile,
                        offset,
                        segmentDuration,
                        recognitionConfig
                    );

                    // 保存粗粒度文本段（作为词轴失败时的兜底）
                    if (segmentResult.text && segmentResult.text.trim().length > 0) {
                        transcribedSegments.push({
                            start: offset,
                            end: endAbs,
                            text: segmentResult.text
                        });
                    }

                    // 追加词级时间轴
                    if (segmentResult.words?.length > 0) {
                        allWords.push(...segmentResult.words);
                    }
                } catch (segmentError) {
                    this.logger.warn(`Failed to transcribe segment ${i + 1}`, segmentError);
                }
            }

            // 合并结果并生成 SRT
            if (this.isCancelled(taskId)) throw new Error('Transcription cancelled by user');
            this.sendProgress(taskId, filePath, DpTaskState.IN_PROGRESS, 95, { message: '合并转录结果...' });

            let fineSegments: Array<{ start: number; end: number; text: string }> = [];

            if (allWords.length > 0) {
                // 优先用词级时间轴生成
                fineSegments = this.createSegmentsFromWordTimeline(allWords);
            }

            if (fineSegments.length === 0 && transcribedSegments.length > 0) {
                // 兜底：按物理段直接生成字幕（每段一条）
                fineSegments = transcribedSegments.map(s => ({
                    start: s.start,
                    end: s.end,
                    text: s.text
                }));
            }

            const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
            // 全局时间微调：字幕整体提前一点点（单位：秒，负值表示提前）
            const SHIFT_SECONDS = -0.2;
            const shiftedSegments = fineSegments
                .map(s => ({
                    start: Math.max(0, s.start + SHIFT_SECONDS),
                    end: Math.max(0, s.end + SHIFT_SECONDS),
                    text: s.text
                }))
                .filter(s => s.end > s.start);

            const srtContent = this.segmentsToSrt(shiftedSegments);
            await fsPromises.writeFile(srtFileName, srtContent);

            this.sendProgress(taskId, filePath, DpTaskState.DONE, 100, { srtPath: srtFileName });

        } catch (error) {
            if (this.isCancelled(taskId)) {
                this.sendProgress(taskId, filePath, DpTaskState.CANCELLED, 0, { message: '转录任务已取消' });
            } else {
                this.sendProgress(taskId, filePath, DpTaskState.FAILED, 0, { error: error instanceof Error ? error.message : String(error) });
            }
            throw error;
        } finally {
            this.activeTaskId = null;

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

    // 取消逻辑：按 ID 取消，既可取消当前任务，也可取消排队中的任务
    public cancel(taskId: number): boolean {
        // 标记为已取消
        this.cancelled.add(taskId);

        // 如果在排队中，直接移出队列并回调
        const idx = this.queue.findIndex(it => it.taskId === taskId);
        if (idx >= 0) {
            const item = this.queue.splice(idx, 1)[0];
            try {
                this.sendProgress(taskId, item.filePath, DpTaskState.CANCELLED, 0, { message: '转录任务已取消（尚未开始）' });
            } catch {
                //
            }
            this.deferred.get(taskId)?.reject(new Error('Transcription cancelled by user'));
            this.deferred.delete(taskId);
            this.cancelled.delete(taskId);
            return true;
        }

        // 如果是当前任务，doTranscribe 会在检查点自行退出
        if (this.activeTaskId === taskId) {
            return true;
        }

        // 任务不存在，清理取消标记并返回 false
        this.cancelled.delete(taskId);
        return false;
    }

    private isCancelled(taskId: number): boolean {
        return this.cancelled.has(taskId);
    }

    // 按配置构建识别参数（本地 whisper.cpp 或 OpenAI 云端）
    private async buildRecognitionConfig(opts: {
        language: string;
        whisperTranscriptionEnabled: boolean;
        openaiTranscriptionEnabled: boolean;
        openaiApiKey?: string;
        openaiEndpoint?: string;
    }): Promise<{
        engine: 'whisper.cpp' | 'openai-cloud';
        language: string;
        options: Record<string, any>;
    }> {
        const { language, whisperTranscriptionEnabled, openaiTranscriptionEnabled, openaiApiKey, openaiEndpoint } = opts;

        if (openaiTranscriptionEnabled && openaiApiKey) {
            this.logger.info('Using OpenAI Cloud transcription', { language, endpoint: openaiEndpoint ? 'custom' : 'default' });
            return {
                engine: 'openai-cloud',
                language,
                options: {
                    engine: 'openai-cloud',
                    language,
                    crop: true,
                    vad: {
                        engine: 'silero',
                        activityThreshold: 0.4,
                        silero: { frameDuration: 90, provider: 'cpu' }
                    },
                    openAICloud: {
                        apiKey: openaiApiKey,
                        baseURL: openaiEndpoint || undefined,
                        model: 'gpt-4o-mini-transcribe',
                        requestWordTimestamps: true
                    }
                }
            };
        }

        if (whisperTranscriptionEnabled) {
            const platform = process.platform;
            let whisperCppOptions: any = {
                model: language.startsWith('en') ? 'base.en' : 'base', // 沿用现有模型
                build: 'cpu',      // Win/Linux 自动下载
                enableGPU: false,  // 不做自适应切换
                threadCount: 4,
                splitCount: 1,
                enableDTW: true
            };

            if (platform === 'darwin') {
                // macOS 使用预置二进制
                const { app } = await import('electron');
                const isPackaged = app.isPackaged;

                let basePath: string;
                if (isPackaged) {
                    basePath = process.env.APP_PATH || path.join(app.getAppPath(), '..', '..', 'lib', 'whisper.cpp');
                } else {
                    basePath = path.join(process.cwd(), 'lib', 'whisper.cpp');
                }

                const arch = process.arch; // 'arm64' | 'x64' | ...
                const archDir = arch === 'arm64' ? 'arm64' : 'x64';
                const binaryPath = path.join(basePath, archDir, 'darwin', 'main');

                this.logger.debug('Resolve whisper.cpp binary (macOS)', {
                    basePath, platform, arch, binaryPath, exists: fs.existsSync(binaryPath)
                });
                if (!fs.existsSync(binaryPath)) {
                    throw new Error(`whisper.cpp binary not found on macOS: ${binaryPath}`);
                }

                whisperCppOptions = {
                    ...whisperCppOptions,
                    executablePath: binaryPath
                };
                delete whisperCppOptions.build;
            }

            return {
                engine: 'whisper.cpp',
                language,
                options: {
                    engine: 'whisper.cpp',
                    language,
                    crop: true,
                    vad: {
                        engine: 'silero',
                        activityThreshold: 0.4,
                        silero: { frameDuration: 90, provider: 'cpu' }
                    },
                    whisperCpp: whisperCppOptions
                }
            };
        }

        throw new Error('No transcription engine is enabled by configuration.');
    }

    // 分段识别（动态导入 Echogarden + 叠加绝对时间偏移）
    private async transcribeSegmentWithConfig(
        segmentPath: string,
        timeOffset: number,
        duration: number,
        recognitionConfig: {
            engine: 'whisper.cpp' | 'openai-cloud',
            language: string,
            options: Record<string, any>
        }
    ): Promise<{
        text: string;
        words: Array<{ word: string; start: number; end: number }>;
    }> {
        try {
            const Echogarden = await import('echogarden');
            const result = await Echogarden.recognize(segmentPath, recognitionConfig.options);

            // 兼容不同版本/模型返回字段：wordTimeline | words | wordTimestamps
            const rawWords =
                (result as any).wordTimeline && Array.isArray((result as any).wordTimeline) ? (result as any).wordTimeline :
                    (result as any).words && Array.isArray((result as any).words) ? (result as any).words :
                        (result as any).wordTimestamps && Array.isArray((result as any).wordTimestamps) ? (result as any).wordTimestamps :
                            [];
            const words = rawWords.map((entry: any) => {
                const text = entry.text ?? entry.word ?? '';
                const start = (entry.startTime ?? entry.start ?? 0) + timeOffset;
                const end = (entry.endTime ?? entry.end ?? 0) + timeOffset;
                return { word: text, start, end };
            });

            return {
                // 兼容 transcript | text
                text: (result as any).transcript || (result as any).text || '',
                words
            };
        } catch (error) {
            this.logger.error('Segment transcription failed', {segmentPath, timeOffset, error});
            throw error;
        }
    }

    /*
     * 归一化 VAD 时间线数据，兼容不同 Echogarden 版本的返回结构
     * 支持多种字段名和结构格式，避免因解析失败导致空结果
     */
    private normalizeVadSegments(
        timeline: any,
        opts: { mergeGapSeconds: number; maxSegmentSeconds: number; padBefore?: number; padAfter?: number }
    ): Array<{ start: number; end: number }> {
        if (!timeline) return [];

        const padBefore = Math.max(0, opts.padBefore ?? 0);
        const padAfter = Math.max(0, opts.padAfter ?? 0);

        const tryArray = (arr: any[]): Array<{ start: number; end: number }> => {
            return arr.map((s: any) => {
                // 兼容多种字段名
                const startRaw = s.start ?? s.startTime ?? s[0];
                const endRaw = s.end ?? s.endTime ?? s[1];
                const start = Number(startRaw);
                const end = Number(endRaw);
                return {
                    start: isFinite(start) ? Math.max(0, start - padBefore) : NaN,
                    end: isFinite(end) ? Math.max(0, end + padAfter) : NaN
                };
            })
                .filter(seg => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end > seg.start);
        };

        // 1) timeline 本身是数组
        let segments: Array<{ start: number; end: number }> = [];
        if (Array.isArray(timeline)) {
            segments = tryArray(timeline);
        } else if (timeline && typeof timeline === 'object') {
            // 2) 常见容器键
            const candidates = [
                timeline.segments,
                timeline.ranges,
                timeline.speechSegments,
                timeline.voiceSegments
            ].filter(Boolean) as any[];

            for (const c of candidates) {
                if (Array.isArray(c) && c.length > 0) {
                    segments = tryArray(c);
                    if (segments.length > 0) break;
                }
            }

            // 3) 极端情况：timeline.activity 帧级布尔序列（转换成段）
            if (segments.length === 0 && Array.isArray((timeline as any).activity)) {
                const activity = (timeline as any).activity as Array<{ time: number; isSpeech: boolean }>;
                let curStart: number | null = null;
                for (const a of activity) {
                    if (a.isSpeech && curStart == null) curStart = a.time;
                    if (!a.isSpeech && curStart != null) {
                        segments.push({ start: Math.max(0, curStart - padBefore), end: Math.max(0, a.time + padAfter) });
                        curStart = null;
                    }
                }
                if (curStart != null) {
                    const last = activity[activity.length - 1]?.time ?? curStart;
                    segments.push({ start: Math.max(0, curStart - padBefore), end: Math.max(0, last + padAfter) });
                }
            }
        }

        if (segments.length === 0) return [];

        // 合并近邻 + 限制最大时长
        segments.sort((a, b) => a.start - b.start);

        const merged: Array<{ start: number; end: number }> = [];
        let cur = { ...segments[0] };
        const flush = (start: number, end: number) => {
            let s = start;
            while (end - s > opts.maxSegmentSeconds) {
                merged.push({ start: s, end: s + opts.maxSegmentSeconds });
                s += opts.maxSegmentSeconds;
            }
            if (end > s) merged.push({ start: s, end });
        };

        for (let i = 1; i < segments.length; i++) {
            const seg = segments[i];
            const gap = seg.start - cur.end;
            if (gap <= opts.mergeGapSeconds && (seg.end - cur.start) <= opts.maxSegmentSeconds) {
                cur.end = Math.max(cur.end, seg.end);
            } else {
                flush(cur.start, cur.end);
                cur = { ...seg };
            }
        }
        flush(cur.start, cur.end);

        return merged;
    }

    /*
     * 从 VAD 时间线构建物理切段范围：
     * - 合并间隔 <= mergeGapSeconds 的邻近段
     * - 限制单段最大时长 maxSegmentSeconds
     * - 对每段增加左右 padding（避免切段丢字）
     * @deprecated 使用 normalizeVadSegments 替代
     */
    private buildVadRanges(
        timeline: any,
        opts: { mergeGapSeconds: number; maxSegmentSeconds: number; padBefore?: number; padAfter?: number }
    ) {
        const padBefore = Math.max(0, opts.padBefore ?? 0);
        const padAfter = Math.max(0, opts.padAfter ?? 0);

        const segments: Array<{ startTime: number; endTime: number }> = (timeline?.segments || [])
            .map((s: any) => ({
                startTime: Math.max(0, (s.startTime ?? 0) - padBefore),
                endTime: Math.max(0, (s.endTime ?? 0) + padAfter)
            }))
            .filter((s: any) => Number.isFinite(s.startTime) && Number.isFinite(s.endTime) && s.endTime > s.startTime);

        const out: Array<{ start: number; end: number }> = [];
        if (segments.length === 0) return out;

        segments.sort((a, b) => a.startTime - b.startTime);

        let curStart = segments[0].startTime;
        let curEnd = segments[0].endTime;

        const flush = (start: number, end: number) => {
            let s = start;
            while (end - s > opts.maxSegmentSeconds) {
                out.push({ start: s, end: s + opts.maxSegmentSeconds });
                s += opts.maxSegmentSeconds;
            }
            if (end > s) out.push({ start: s, end });
        };

        for (let i = 1; i < segments.length; i++) {
            const seg = segments[i];
            const gap = seg.startTime - curEnd;

            if (gap <= opts.mergeGapSeconds && (seg.endTime - curStart) <= opts.maxSegmentSeconds) {
                curEnd = Math.max(curEnd, seg.endTime);
            } else {
                flush(curStart, curEnd);
                curStart = seg.startTime;
                curEnd = seg.endTime;
            }
        }
        flush(curStart, curEnd);

        return out;
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
